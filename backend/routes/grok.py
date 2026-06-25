from flask import Blueprint, jsonify, request
import os
import json
from pathlib import Path
from datetime import datetime, date, timedelta, timezone

from openai import OpenAI
import chromadb
from werkzeug.utils import secure_filename

from db import get_db, safe_bootstrap
from permissions import current_uid
from routes.reports import (
    _DEFAULT_HOURLY_RATE,
    _OT_PREMIUM,
    _daily_hours,
    _overtime_by_user,
)
from routes.billing import swifty_access

bp = Blueprint("grok", __name__)


# --- Swifty fair-use limits (anti-abuse, applies even on Pro) ------------------
# Per-user message caps, configurable via env (SWIFTY_DAILY_LIMIT /
# SWIFTY_MONTHLY_LIMIT). Defaults are generous for normal use but stop a single
# user from running up xAI costs. Applies to everyone who passes the Pro gate
# (trial, Pro, grandfathered).
_SWIFTY_DAILY_DEFAULT = 50
_SWIFTY_MONTHLY_DEFAULT = 500


def _int_env(name, default):
    try:
        return int(os.environ.get(name) or default)
    except (TypeError, ValueError):
        return default


def _ensure_swifty_usage_table():
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS swifty_usage (
              user_id INTEGER NOT NULL,
              period_type TEXT NOT NULL,
              period_key TEXT NOT NULL,
              count INTEGER NOT NULL DEFAULT 0,
              PRIMARY KEY (user_id, period_type, period_key)
            )
            """
        )
        db.commit()


safe_bootstrap(_ensure_swifty_usage_table)


def _swifty_periods():
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%d"), now.strftime("%Y-%m")


def _swifty_usage_check(uid):
    """(allowed, message): compare the user's day/month message counts to caps.
    Never blocks on a counter-read failure (fails open)."""
    daily = _int_env("SWIFTY_DAILY_LIMIT", _SWIFTY_DAILY_DEFAULT)
    monthly = _int_env("SWIFTY_MONTHLY_LIMIT", _SWIFTY_MONTHLY_DEFAULT)
    day_key, month_key = _swifty_periods()
    try:
        with get_db() as db:
            d = db.execute(
                "SELECT count FROM swifty_usage WHERE user_id = ? AND period_type = 'day' AND period_key = ?",
                (uid, day_key),
            ).fetchone()
            m = db.execute(
                "SELECT count FROM swifty_usage WHERE user_id = ? AND period_type = 'month' AND period_key = ?",
                (uid, month_key),
            ).fetchone()
    except Exception:
        return True, None
    if d and d["count"] >= daily:
        return False, f"You've reached today's Swifty limit of {daily} messages. It resets tomorrow."
    if m and m["count"] >= monthly:
        return False, f"You've reached this month's Swifty limit of {monthly} messages. It resets at the start of next month."
    return True, None


def _swifty_usage_increment(uid):
    """Count one successful Swifty message against the user's day + month totals."""
    day_key, month_key = _swifty_periods()
    try:
        with get_db() as db:
            for pt, pk in (("day", day_key), ("month", month_key)):
                db.execute(
                    """
                    INSERT INTO swifty_usage (user_id, period_type, period_key, count)
                    VALUES (?, ?, ?, 1)
                    ON CONFLICT (user_id, period_type, period_key)
                    DO UPDATE SET count = swifty_usage.count + 1
                    """,
                    (uid, pt, pk),
                )
            db.commit()
    except Exception:
        pass


def chunk_text(text: str, chunk_size: int = 4000, overlap: int = 400) -> list[str]:
    """Split text into ~1000-token chunks (≈4000 chars) with overlap."""
    if len(text) <= chunk_size:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

S3_ROOT = Path(__file__).parent.parent / "s3"

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB per uploaded file


def _file_too_large(f) -> bool:
    """True if an uploaded werkzeug FileStorage exceeds MAX_UPLOAD_BYTES."""
    f.stream.seek(0, 2)
    size = f.stream.tell()
    f.stream.seek(0)
    return size > MAX_UPLOAD_BYTES


def get_user_dir(user_id: str) -> Path:
    """Get or create user's S3 proxy folder."""
    user_dir = S3_ROOT / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir


def get_chroma_path(user_id: str) -> Path:
    return get_user_dir(user_id) / "chroma"


def get_or_create_chroma(user_id: str):
    """Get ChromaDB client and collection for user."""
    chroma_path = get_chroma_path(user_id)
    client = chromadb.PersistentClient(path=str(chroma_path))
    try:
        coll = client.get_collection("tax_docs")
    except Exception:
        coll = client.create_collection("tax_docs")
    return client, coll


def reindex_user_chroma(user_id: str):
    """Rebuild ChromaDB with all files in user's folder (chunked)."""
    user_dir = get_user_dir(user_id)
    _, coll = get_or_create_chroma(user_id)
    # Clear existing
    try:
        coll.delete(where={})
    except Exception:
        pass

    docs = []
    metadatas = []
    ids = []
    for f in user_dir.iterdir():
        if f.is_file() and f.name != "chroma" and not f.name.startswith("."):
            try:
                content = f.read_text(errors="ignore")
            except Exception:
                content = f"[binary file: {f.name}]"
            # Chunk into ~1000 tokens each with overlap
            for i, chunk in enumerate(chunk_text(content)):
                docs.append(chunk)
                metadatas.append({"filename": f.name, "chunk": i, "uploaded_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat()})
                ids.append(f"{f.name}::{i}")
    if docs:
        coll.add(documents=docs, metadatas=metadatas, ids=ids)
    return len(docs)


@bp.route("/api/grok/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "file required"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "empty filename"}), 400
    if _file_too_large(f):
        return jsonify({"error": "file too large (max 10MB)"}), 413

    user_id = str(current_uid() or "")
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return jsonify({"error": "XAI_API_KEY not configured"}), 500

    try:
        # Save locally + reindex for RAG if user_id provided
        if user_id:
            user_dir = get_user_dir(user_id)
            safe_name = secure_filename(f.filename)
            if not safe_name:
                return jsonify({"error": "invalid filename"}), 400
            save_path = user_dir / safe_name
            f.save(str(save_path))
            reindex_user_chroma(user_id)
            f.stream.seek(0)  # reset for OpenAI upload

        client = OpenAI(
            api_key=api_key,
            base_url="https://api.x.ai/v1",
            timeout=60,
        )
        uploaded = client.files.create(
            file=(f.filename, f.stream, f.content_type or "application/octet-stream"),
            purpose="assistants",
        )
        return jsonify({"file_id": uploaded.id, "filename": uploaded.filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Swifty live-data helpers: read-only views of the caller's own data --------
# Identity always comes from current_uid() (the session), never from the request
# body or anything the model supplies, so Swifty can never read another user.

def _local_today_iso(tz_name):
    """The user's local calendar date (their company timezone) as YYYY-MM-DD."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo(tz_name or "America/New_York")).date().isoformat()
    except Exception:
        return datetime.now(timezone.utc).date().isoformat()


def _end_of_month(d):
    nxt = date(d.year + 1, 1, 1) if d.month == 12 else date(d.year, d.month + 1, 1)
    return nxt - timedelta(days=1)


def _pay_period_window(pay_period, today):
    """(start, end) YYYY-MM-DD for the pay period containing `today` (a date).
    Anchored deterministically so it works without a stored cycle-start date."""
    pp = (pay_period or "biweekly").lower()
    if pp == "weekly":
        start = today - timedelta(days=today.weekday())  # Monday
        end = start + timedelta(days=6)
    elif pp == "semimonthly":
        if today.day <= 15:
            start, end = today.replace(day=1), today.replace(day=15)
        else:
            start, end = today.replace(day=16), _end_of_month(today)
    elif pp == "monthly":
        start, end = today.replace(day=1), _end_of_month(today)
    else:  # biweekly (default): 14-day blocks anchored on a known Monday
        anchor = date(2024, 1, 1)
        idx = (today - anchor).days // 14
        start = anchor + timedelta(days=idx * 14)
        end = start + timedelta(days=13)
    return start.isoformat(), end.isoformat()


def _user_context(db, uid):
    row = db.execute(
        "SELECT u.first_name, u.last_name, u.job_role, u.hourly_rate, u.company_id, "
        "c.name AS company_name, c.pay_period, c.timezone "
        "FROM users u LEFT JOIN companies c ON c.id = u.company_id WHERE u.id = ?",
        (uid,),
    ).fetchone()
    return dict(row) if row else {}


def _user_hours(db, uid, start, end):
    """Worked hours for one user in [start, end], reusing the canonical reports
    math (clock_sessions + time_entries, with 8h/day & 40h/week overtime)."""
    daily = _daily_hours(db, start, end)
    mine = {k: v for k, v in daily.items() if k[0] == uid}
    total = round(sum(mine.values()), 2)
    overtime = round(_overtime_by_user(mine).get(uid, 0.0), 2)
    regular = round(max(0.0, total - overtime), 2)
    by_day = [
        {"date": d, "hours": round(h, 2)}
        for (u, d), h in sorted(mine.items(), key=lambda kv: kv[0][1])
    ]
    return {"total_hours": total, "regular_hours": regular, "overtime_hours": overtime, "by_day": by_day}


_SWIFTY_TOOLS = [
    {"type": "function", "function": {
        "name": "get_my_profile",
        "description": "The current user's name, job role, hourly rate, company, pay-period cadence, and timezone.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_clock_status",
        "description": "Whether the user is currently clocked in, since when (UTC), and hours already completed today.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_current_pay_period_hours",
        "description": "Hours the user has worked so far in their CURRENT pay period, with a regular/overtime split and estimated gross and net pay. Use this for 'how many hours have I worked this pay period'.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_hours_for_range",
        "description": "Total worked hours (regular + overtime) for an explicit date range.",
        "parameters": {"type": "object", "properties": {
            "start_date": {"type": "string", "description": "YYYY-MM-DD"},
            "end_date": {"type": "string", "description": "YYYY-MM-DD"},
        }, "required": ["start_date", "end_date"]},
    }},
    {"type": "function", "function": {
        "name": "get_recent_timesheets",
        "description": "The user's most recently submitted timesheets (period dates and total hours).",
        "parameters": {"type": "object", "properties": {"limit": {"type": "integer"}}},
    }},
]


def _build_swifty_tools(uid):
    """Bind the read-only data tools to one user id. Each opens its own short DB
    connection; every query is scoped to `uid`."""

    def get_my_profile(_args=None):
        with get_db() as db:
            ctx = _user_context(db, uid)
        return {
            "name": f"{ctx.get('first_name', '')} {ctx.get('last_name', '')}".strip(),
            "job_role": ctx.get("job_role"),
            "hourly_rate": ctx.get("hourly_rate") or _DEFAULT_HOURLY_RATE,
            "company": ctx.get("company_name"),
            "pay_period": ctx.get("pay_period") or "biweekly",
            "timezone": ctx.get("timezone"),
        }

    def get_clock_status(_args=None):
        with get_db() as db:
            ctx = _user_context(db, uid)
            row = db.execute(
                "SELECT id, clock_in FROM clock_sessions WHERE employee_id = ? AND clock_out IS NULL ORDER BY id DESC LIMIT 1",
                (uid,),
            ).fetchone()
            today = _local_today_iso(ctx.get("timezone"))
            completed = _user_hours(db, uid, today, today)["total_hours"]
        if row:
            return {"clocked_in": True, "since_utc": str(row["clock_in"]), "completed_hours_today": completed}
        return {"clocked_in": False, "completed_hours_today": completed}

    def get_current_pay_period_hours(_args=None):
        with get_db() as db:
            ctx = _user_context(db, uid)
            today_iso = _local_today_iso(ctx.get("timezone"))
            start, end = _pay_period_window(ctx.get("pay_period"), date.fromisoformat(today_iso))
            worked = _user_hours(db, uid, start, end)
            rate = float(ctx.get("hourly_rate") or _DEFAULT_HOURLY_RATE)
        gross = worked["regular_hours"] * rate + worked["overtime_hours"] * rate * (1 + _OT_PREMIUM)
        deductions = gross * (0.12 + 0.05 + 0.0765)
        return {
            "pay_period": ctx.get("pay_period") or "biweekly",
            "period_start": start,
            "period_end": end,
            "as_of": today_iso,
            "hourly_rate": rate,
            "estimated_gross": round(gross, 2),
            "estimated_net": round(gross - deductions, 2),
            **worked,
        }

    def get_hours_for_range(args):
        start = str((args or {}).get("start_date") or "")[:10]
        end = str((args or {}).get("end_date") or "")[:10]
        try:
            date.fromisoformat(start)
            date.fromisoformat(end)
        except ValueError:
            return {"error": "start_date and end_date must be YYYY-MM-DD"}
        with get_db() as db:
            worked = _user_hours(db, uid, start, end)
        return {"start_date": start, "end_date": end, **worked}

    def get_recent_timesheets(args):
        try:
            limit = max(1, min(24, int((args or {}).get("limit", 6))))
        except (TypeError, ValueError):
            limit = 6
        with get_db() as db:
            rows = db.execute(
                "SELECT period_start, period_end, total_hours, submitted_at "
                "FROM timesheet_submissions WHERE user_id = ? ORDER BY period_start DESC LIMIT ?",
                (uid, limit),
            ).fetchall()
        return {"timesheets": [dict(r) for r in rows]}

    return {
        "get_my_profile": get_my_profile,
        "get_clock_status": get_clock_status,
        "get_current_pay_period_hours": get_current_pay_period_hours,
        "get_hours_for_range": get_hours_for_range,
        "get_recent_timesheets": get_recent_timesheets,
    }


@bp.route("/api/grok/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    message = data.get("message", "").strip()
    file_id = data.get("file_id", "").strip()
    uid = current_uid()
    user_id = str(uid or "")
    if not message and not file_id:
        return jsonify({"error": "message or file_id required"}), 400

    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return jsonify({"error": "XAI_API_KEY not configured"}), 500

    # Swifty is a Pro feature. The gate only engages once billing is fully
    # configured, so nobody is ever trapped without a path to upgrade.
    try:
        with get_db() as db:
            access = swifty_access(db, uid)
    except Exception:
        access = {"allowed": True}
    if not access.get("allowed", True):
        return jsonify({"response": (
            "Swifty is part of SwiftShift Pro. Start your free 30-day trial or upgrade on the "
            "Pricing page, and I can answer questions about your hours, pay, and schedule."
        )})

    # Fair-use cap (anti-abuse): block when the user is over their daily/monthly
    # message limit. Counted only on success, below.
    usage_ok, usage_message = _swifty_usage_check(uid)
    if not usage_ok:
        return jsonify({"response": usage_message})

    try:
        client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1", timeout=60)

        # RAG: retrieve relevant context from the user's uploaded documents.
        rag_context = ""
        if user_id and message:
            try:
                _, coll = get_or_create_chroma(user_id)
                results = coll.query(query_texts=[message], n_results=10)
                chunks = results.get("documents", [[]])[0]
                distances = results.get("distances", [[]])[0] or [0] * len(chunks)
                scored = [(c, d) for c, d in zip(chunks, distances) if d < 1.5]
                scored.sort(key=lambda x: x[1])
                top_chunks = [c for c, _ in scored[:5]]
                if top_chunks:
                    rag_context = "Relevant context from your documents (use if relevant, otherwise ignore):\n" + "\n---\n".join(top_chunks)
            except Exception:
                pass

        # Identity-aware system prompt. Shift/pay data is NOT inlined here; Swifty
        # pulls it live via tools, scoped server-side to this user.
        try:
            with get_db() as db:
                uctx = _user_context(db, uid)
        except Exception:
            uctx = {}
        display_name = f"{uctx.get('first_name', '')} {uctx.get('last_name', '')}".strip()
        today_iso = _local_today_iso(uctx.get("timezone"))
        who = display_name or "an employee"
        if uctx.get("job_role"):
            who += f", a {uctx['job_role']}"
        if uctx.get("company_name"):
            who += f" at {uctx['company_name']}"
        system_prompt = (
            "You are Swifty, the built-in AI assistant for SwiftShift, a workforce "
            "time-tracking and payroll app. "
            f"You are helping {who}. Today is {today_iso}. "
            "You can call tools to read this user's real SwiftShift data: hours worked, "
            "clock-in status, current pay period, recent timesheets, and profile. When the "
            "user asks about their hours, pay, pay period, schedule, or clock status, ALWAYS "
            "call the matching tool and answer from the returned data instead of asking them "
            "to provide it. All tool data is already scoped to this user. Use the user's "
            "uploaded documents as context when relevant. Be concise and friendly."
        )

        if file_id:
            # File analysis goes through the Responses API (tools not needed here).
            resp = client.responses.create(
                model="grok-4.20-0309-reasoning",
                input=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": (rag_context + "\n\n" if rag_context else "") + (message or "Analyze this file.")},
                            {"type": "input_file", "file_id": file_id},
                        ],
                    },
                ],
            )
            _swifty_usage_increment(uid)
            return jsonify({"response": resp.output_text})

        # Tool-calling loop: Swifty decides which data to pull, we run the query
        # (scoped to current_uid) and feed it back, until it produces an answer.
        tool_impl = _build_swifty_tools(uid)
        messages = [{"role": "system", "content": system_prompt}]
        if rag_context:
            messages.append({"role": "system", "content": rag_context})
        messages.append({"role": "user", "content": message})

        answer = None
        for _ in range(6):  # max 6 tool-call rounds
            resp = client.chat.completions.create(
                model="grok-4.20-0309-reasoning",
                messages=messages,
                tools=_SWIFTY_TOOLS,
                tool_choice="auto",
            )
            msg = resp.choices[0].message
            assistant_msg = {"role": "assistant", "content": msg.content}
            if msg.tool_calls:
                # Re-serialize tool calls as plain dicts so the next round-trip
                # sends JSON-safe messages, not SDK Pydantic objects.
                assistant_msg["tool_calls"] = [
                    {"id": tc.id, "type": "function",
                     "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                    for tc in msg.tool_calls
                ]
            messages.append(assistant_msg)
            if not msg.tool_calls:
                answer = msg.content
                break
            for tc in msg.tool_calls:
                try:
                    t_args = json.loads(tc.function.arguments or "{}")
                except Exception:
                    t_args = {}
                impl = tool_impl.get(tc.function.name)
                try:
                    result = impl(t_args) if impl else {"error": "unknown tool"}
                except Exception as exc:
                    result = {"error": f"could not load data: {exc}"}
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result, default=str)})
        if answer is None:
            answer = "I wasn't able to finish looking that up. Could you rephrase your question?"

        _swifty_usage_increment(uid)
        return jsonify({"response": answer})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Tax document upload + per-file extraction ---

@bp.route("/api/grok/tax/upload", methods=["POST"])
def tax_upload():
    user_id = str(current_uid() or "")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    if "file" not in request.files:
        return jsonify({"error": "file required"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "empty filename"}), 400
    if _file_too_large(f):
        return jsonify({"error": "file too large (max 10MB)"}), 413

    try:
        user_dir = get_user_dir(user_id)
        safe_name = secure_filename(f.filename)
        if not safe_name:
            return jsonify({"error": "invalid filename"}), 400
        save_path = user_dir / safe_name
        f.save(str(save_path))
        # Index into ChromaDB so Grokky RAG can use it
        reindex_user_chroma(user_id)
        return jsonify({"ok": True, "filename": safe_name})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def extract_resume_text(user_id: str) -> str:
    """Extract plain text from user's resume file (pdf/docx/txt)."""
    user_dir = get_user_dir(user_id)
    for f in user_dir.iterdir():
        if f.is_file() and f.name.lower() in ("resume.pdf", "resume.docx", "resume.txt"):
            try:
                if f.suffix.lower() == ".pdf":
                    import pypdf
                    reader = pypdf.PdfReader(str(f))
                    return "\n".join(page.extract_text() or "" for page in reader.pages)
                elif f.suffix.lower() == ".docx":
                    from docx import Document
                    doc = Document(str(f))
                    return "\n".join(p.text for p in doc.paragraphs)
                else:
                    return f.read_text(errors="ignore")
            except Exception:
                pass
    # fallback: try any .pdf or .docx
    for f in user_dir.iterdir():
        if f.is_file() and f.suffix.lower() in (".pdf", ".docx"):
            try:
                if f.suffix.lower() == ".pdf":
                    import pypdf
                    reader = pypdf.PdfReader(str(f))
                    return "\n".join(page.extract_text() or "" for page in reader.pages)
            except Exception:
                pass
    return ""


@bp.route("/api/grok/match-jobs", methods=["POST"])
def match_jobs():
    """Semantic match: given user_id (resume) and jobs list, return sorted jobs with scores."""
    data = request.get_json() or {}
    user_id = str(current_uid() or "")
    jobs = data.get("jobs", [])
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    if not jobs:
        return jsonify({"error": "jobs list required"}), 400

    resume_text = extract_resume_text(user_id)
    if not resume_text.strip():
        # No resume text available - return jobs as-is with 0 score
        return jsonify({"jobs": [{"job": j, "score": 0, "label": "No resume"} for j in jobs]})

    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return jsonify({"error": "XAI_API_KEY not configured"}), 500

    client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1", timeout=60)

    # Build prompt: ask Grok to score each job against resume
    job_list = "\n".join(f"{i+1}. {j.get('title','')} at {j.get('company','')}: {j.get('desc','')[:800]}" for i, j in enumerate(jobs))
    prompt = f"""You are a recruiting match engine. Given this candidate resume and job postings, score each job 0-100 for how well the resume fits the role. Return ONLY valid JSON array of objects with fields: index (1-based), score (0-100 int), label ("Best Match" if >=90, "Strong Match" if >=80, "Good Match" if >=70, "Fair Match" if >=50, else "Weak Match").

RESUME:
{resume_text[:6000]}

JOBS:
{job_list}

JSON:"""

    try:
        resp = client.chat.completions.create(
            model="grok-4.20-0309-reasoning",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        content = resp.choices[0].message.content.strip()
        # Try to parse JSON from response
        import re, json as pyjson
        m = re.search(r"\[[\s\S]*\]", content)
        arr = pyjson.loads(m.group(0)) if m else []
        # Build result
        results = []
        for item in arr:
            idx = int(item.get("index", 0)) - 1
            if 0 <= idx < len(jobs):
                results.append({
                    "job": jobs[idx],
                    "score": int(item.get("score", 0)),
                    "label": item.get("label", "Fair Match"),
                })
        # Sort by score desc
        results.sort(key=lambda x: x["score"], reverse=True)
        return jsonify({"jobs": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/grok/tax/extract", methods=["POST"])
def tax_extract():
    """Extract numbers from a single tax document. Returns structured JSON."""
    if "file" not in request.files:
        return jsonify({"error": "file required"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "empty filename"}), 400
    if _file_too_large(f):
        return jsonify({"error": "file too large (max 10MB)"}), 413

    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return jsonify({"error": "XAI_API_KEY not configured"}), 500

    try:
        # Read file content
        content = f.read()
        text = content.decode("utf-8", errors="ignore")[:8000]  # limit

        client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1", timeout=60)
        prompt = (
            "You are a tax document extractor. Read the following document text and extract:\n"
            "- type: one of W-2, 1099-NEC, 1099-MISC, 1099-B, 1099-INT, 1099-DIV, receipt, other\n"
            "- wages: salary/wages box (W-2 box 1) or equivalent\n"
            "- self_employment: 1099-NEC/MISC income\n"
            "- capital_gains: long/short term gains (1099-B)\n"
            "- interest: 1099-INT\n"
            "- dividends: 1099-DIV\n"
            "- federal_withheld: federal tax withheld\n"
            "- deductions: any itemized deductions mentioned (home office, mileage, equipment)\n"
            "Return ONLY valid JSON with integer values (0 if not found):\n"
            "{\"type\": \"...\", \"wages\": 0, \"self_employment\": 0, \"capital_gains\": 0, \"interest\": 0, \"dividends\": 0, \"federal_withheld\": 0, \"deductions\": 0}\n\n"
            f"Document: {text}"
        )
        resp = client.chat.completions.create(
            model="grok-4.20-0309-reasoning",
            messages=[{"role": "user", "content": prompt}],
        )
        content = resp.choices[0].message.content or "{}"
        import json, re as _re
        m = _re.search(r"\{[\s\S]*\}", content)
        if m:
            parsed = json.loads(m.group(0))
            return jsonify({
                "type": parsed.get("type", "other"),
                "wages": int(parsed.get("wages", 0)),
                "self_employment": int(parsed.get("self_employment", 0)),
                "capital_gains": int(parsed.get("capital_gains", 0)),
                "interest": int(parsed.get("interest", 0)),
                "dividends": int(parsed.get("dividends", 0)),
                "federal_withheld": int(parsed.get("federal_withheld", 0)),
                "deductions": int(parsed.get("deductions", 0)),
            })
        return jsonify({"type": "other", "wages": 0, "self_employment": 0, "capital_gains": 0, "interest": 0, "dividends": 0, "federal_withheld": 0, "deductions": 0})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/grok/tax/fill-1040", methods=["POST"])
def fill_1040():
    """Agentic 1040 filler: Grok uses tools to extract, reconcile, search, calculate."""
    data = request.get_json() or {}
    user_id = str(current_uid() or "")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return jsonify({"error": "XAI_API_KEY not configured"}), 500

    try:
        user_dir = get_user_dir(user_id)
        source_files = [f.name for f in user_dir.iterdir() if f.is_file() and f.name != "chroma"]

        # ---- Tool implementations ----
        def tool_list_files(_args=None):
            return {"files": source_files}

        def tool_extract(args):
            fname = args.get("filename", "")
            fpath = (user_dir / fname).resolve()
            if not fpath.is_relative_to(user_dir.resolve()):
                return {"error": "invalid filename"}
            if not fpath.exists():
                return {"error": "file not found"}
            text = fpath.read_text(errors="ignore")[:8000]
            client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1", timeout=60)
            resp = client.chat.completions.create(
                model="grok-4.20-0309-reasoning",
                messages=[{"role": "user", "content": (
                    "Extract: type, wages, self_employment, capital_gains, interest, dividends, federal_withheld, deductions. "
                    "JSON only: {\"type\":\"...\",\"wages\":0,\"self_employment\":0,\"capital_gains\":0,\"interest\":0,\"dividends\":0,\"federal_withheld\":0,\"deductions\":0}\n\n" + text
                )}],
            )
            import json, re as _re
            m = _re.search(r"\{[\s\S]*\}", resp.choices[0].message.content or "{}")
            return json.loads(m.group(0)) if m else {}

        def tool_reconcile(args):
            extracted = args.get("extracted", {})
            # Simple reconciliation: sum checks
            total_income = sum([extracted.get(k, 0) for k in ("wages","self_employment","interest","dividends")])
            return {"total_income": total_income, "capital_gains": extracted.get("capital_gains", 0), "deductions": extracted.get("deductions", 0), "ok": True}

        def tool_web_search(args):
            q = args.get("query", "2024 federal tax brackets single filer")
            # Simple: use Grok to "search" (it knows recent info). In prod use real search API.
            client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1", timeout=60)
            resp = client.chat.completions.create(
                model="grok-4.20-0309-reasoning",
                messages=[{"role": "user", "content": f"Briefly state current info for: {q}"}],
            )
            return {"result": resp.choices[0].message.content[:500]}

        def tool_calculate_tax(args):
            inc = int(args.get("ordinary_income", 0))
            cg = int(args.get("capital_gains", 0))
            withheld = int(args.get("federal_withheld", 0))
            deductions = int(args.get("deductions", 0))
            std_ded = 14600
            ordinary = max(0, inc - std_ded - deductions)
            def ord_tax(i):
                br = [(11600,0.10),(47150-11600,0.12),(100525-47150,0.22),(191950-100525,0.24),(243725-191950,0.32),(609350-243725,0.35),(None,0.37)]
                t=0; r=i
                for a,rt in br:
                    if r<=0: break
                    c = min(r,a) if a else r
                    t += c*rt; r -= c
                return int(t)
            o_tax = ord_tax(ordinary)
            cg_tax = 0
            if cg > 0:
                for a,rt in [(47025,0.0),(518900-47025,0.15),(None,0.20)]:
                    if cg<=0: break
                    c = min(cg,a) if a else cg
                    cg_tax += int(c*rt); cg -= c
            total_tax = o_tax + cg_tax
            refund = max(0, withheld - total_tax)
            return {"ordinary_tax": o_tax, "cg_tax": cg_tax, "total_tax": total_tax, "refund": refund}

        tools = [
            {"type": "function", "function": {"name": "list_files", "description": "List tax documents", "parameters": {"type": "object", "properties": {}}}},
            {"type": "function", "function": {"name": "extract_file", "description": "Extract numbers from a file", "parameters": {"type": "object", "properties": {"filename": {"type": "string"}}, "required": ["filename"]}}},
            {"type": "function", "function": {"name": "reconcile", "description": "Reconcile extracted data", "parameters": {"type": "object", "properties": {"extracted": {"type": "object"}}, "required": ["extracted"]}}},
            {"type": "function", "function": {"name": "web_search", "description": "Search for current tax info", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
            {"type": "function", "function": {"name": "calculate_tax", "description": "Calculate federal tax", "parameters": {"type": "object", "properties": {"ordinary_income": {"type": "integer"}, "capital_gains": {"type": "integer"}, "federal_withheld": {"type": "integer"}, "deductions": {"type": "integer"}}, "required": ["ordinary_income", "capital_gains", "federal_withheld", "deductions"]}}},
        ]

        tool_impl = {
            "list_files": tool_list_files,
            "extract_file": tool_extract,
            "reconcile": tool_reconcile,
            "web_search": tool_web_search,
            "calculate_tax": tool_calculate_tax,
        }

        # ---- Agent loop ----
        client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1", timeout=60)
        system = (
            "You are a tax-filing agent. Use tools to: list files, extract each, reconcile totals, "
            "search web for current brackets if needed, then calculate final 1040. "
            "When done, output the final JSON form fields."
        )
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Fill Form 1040 for user {user_id}. Files: {source_files}. Start by listing files and extracting."},
        ]

        for _ in range(8):  # max 8 tool steps
            resp = client.chat.completions.create(
                model="grok-4.20-0309-reasoning",
                messages=messages,
                tools=tools,
                tool_choice="auto",
            )
            msg = resp.choices[0].message
            messages.append({"role": "assistant", "content": msg.content, "tool_calls": msg.tool_calls})

            if not msg.tool_calls:
                # Final answer
                return jsonify({"response": msg.content, "source_files": source_files})

            for tc in msg.tool_calls:
                name = tc.function.name
                args = {}
                try:
                    import json
                    args = json.loads(tc.function.arguments or "{}")
                except Exception:
                    pass
                result = tool_impl.get(name, lambda a: {"error": "unknown tool"})(args)
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result)})

        return jsonify({"error": "agent did not finish", "source_files": source_files})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
