import sys
from pathlib import Path

# Add backend/ to sys.path so `from backend.app import app` works
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
