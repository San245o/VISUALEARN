"""
Centralised configuration. Every module reads from here, never from os.getenv directly.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Supabase ─────────────────────────────────────────────────────────────────
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")

# ── Gemini ───────────────────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

# ── Model catalogue ─────────────────────────────────────────────────────────
MODEL_CATALOG = [
    {"id": "gemma-4-31b-it",         "label": "Gemma 4 31B",             "status": "stable"},
    {"id": "gemini-3.5-flash",       "label": "Gemini 3.5 Flash",        "status": "stable"},
    {"id": "gemini-3-flash-preview", "label": "Gemini 3 Flash (Preview)","status": "preview"},
    {"id": "gemini-3.1-flash-lite",  "label": "Gemini 3.1 Flash Lite",   "status": "stable"},
    {"id": "gemini-2.5-flash",       "label": "Gemini 2.5 Flash",        "status": "stable"},
]

DEFAULT_MODEL_ID = "gemini-3.5-flash"
ALLOWED_MODEL_IDS = {m["id"] for m in MODEL_CATALOG}

# ── Manim defaults ───────────────────────────────────────────────────────────
MAX_REPAIR_ATTEMPTS = 2
