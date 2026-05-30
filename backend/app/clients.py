"""
Lazy-initialised singletons for Supabase and Gemini clients.
Every module calls these instead of creating their own clients.
"""

from supabase import Client as SupabaseClient, create_client
from google import genai

from app.config import SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY

# ── Supabase ─────────────────────────────────────────────────────────────────
_sb: SupabaseClient | None = None


def get_supabase() -> SupabaseClient:
    global _sb
    if _sb is None:
        _sb = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _sb


# ── Gemini ───────────────────────────────────────────────────────────────────
_gemini: genai.Client | None = None


def get_gemini() -> genai.Client:
    global _gemini
    if _gemini is None:
        _gemini = genai.Client(api_key=GEMINI_API_KEY)
    return _gemini
