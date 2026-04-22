from flask import Blueprint, jsonify, request
import os
import json
from pathlib import Path
from datetime import datetime

from openai import OpenAI
import chromadb
from werkzeug.utils import secure_filename

bp = Blueprint("grok", __name__)


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
        if f.is_file() and f.name != "chroma":
            try:
                content = f.read_text(errors="ignore")
            except Exception:
                content = f"[binary file: {f.name}]"
            # Chunk into ~1000 tokens each with overlap
            for i, chunk in enumerate(chunk_text(content)):
                docs.append(chunk)
                metadatas.append({"filename": f.name, "chunk": i, "uploaded_at": datetime.utcnow().isoformat()})
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

    user_id = request.form.get("user_id", "").strip()
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
        )
        uploaded = client.files.create(
            file=(f.filename, f.stream, f.content_type or "application/octet-stream"),
            purpose="assistants",
        )
        return jsonify({"file_id": uploaded.id, "filename": uploaded.filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/grok/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    message = data.get("message", "").strip()
    file_id = data.get("file_id", "").strip()
    uid = data.get("user_id", "")
    user_id = str(uid).strip() if uid else ""
    if not message and not file_id:
        return jsonify({"error": "message or file_id required"}), 400

    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return jsonify({"error": "XAI_API_KEY not configured"}), 500

    try:
        client = OpenAI(
            api_key=api_key,
            base_url="https://api.x.ai/v1",
        )

        # RAG: retrieve relevant context from user's ChromaDB if user_id provided
        rag_context = ""
        if user_id and message:
            try:
                _, coll = get_or_create_chroma(user_id)
                # Fetch more candidates, rerank by cosine similarity (lower distance = better)
                results = coll.query(query_texts=[message], n_results=10)
                chunks = results.get("documents", [[]])[0]
                distances = results.get("distances", [[]])[0] or [0] * len(chunks)
                # Filter by cosine distance threshold and take top 5
                scored = [(c, d) for c, d in zip(chunks, distances) if d < 1.5]
                scored.sort(key=lambda x: x[1])
                top_chunks = [c for c, _ in scored[:5]]
                if top_chunks:
                    rag_context = "Relevant context from your documents (use if relevant, otherwise ignore):\n" + "\n---\n".join(top_chunks)
            except Exception:
                pass

        system_prompt = (
            "You are Grokky, a helpful general assistant. "
            "Use the user's uploaded documents as context when relevant. "
            "If context is provided and relevant to the question, use it; otherwise answer from general knowledge. Be concise."
        )

        if file_id:
            # Use Responses API for file attachment support
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
            answer = resp.output_text
        else:
            messages = [{"role": "system", "content": system_prompt}]
            if rag_context:
                messages.append({"role": "system", "content": rag_context})
            messages.append({"role": "user", "content": message})
            resp = client.chat.completions.create(
                model="grok-4.20-0309-reasoning",
                messages=messages,
            )
            answer = resp.choices[0].message.content

        return jsonify({"response": answer})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Tax document upload + per-file extraction ---

@bp.route("/api/grok/tax/upload", methods=["POST"])
def tax_upload():
    user_id = request.form.get("user_id", "").strip()
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    if "file" not in request.files:
        return jsonify({"error": "file required"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "empty filename"}), 400

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
    user_id = str(data.get("user_id", "")).strip()
    jobs = data.get("jobs", [])
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    if not jobs:
        return jsonify({"error": "jobs list required"}), 400

    resume_text = extract_resume_text(user_id)
    if not resume_text.strip():
        # No resume text available — return jobs as-is with 0 score
        return jsonify({"jobs": [{"job": j, "score": 0, "label": "No resume"} for j in jobs]})

    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return jsonify({"error": "XAI_API_KEY not configured"}), 500

    client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1")

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

    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return jsonify({"error": "XAI_API_KEY not configured"}), 500

    try:
        # Read file content
        content = f.read()
        text = content.decode("utf-8", errors="ignore")[:8000]  # limit

        client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1")
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
    uid = data.get("user_id", "")
    user_id = str(uid).strip() if uid else ""
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
            client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1")
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
            client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1")
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
        client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1")
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
