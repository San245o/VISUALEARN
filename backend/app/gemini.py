"""
Gemini prompt builders and the model-fallback caller.
Thin wrappers so routes stay clean.
"""

from typing import Any, List

from app.config import ALLOWED_MODEL_IDS, MODEL_CATALOG


# ── Prompts ──────────────────────────────────────────────────────────────────

CHAT_SYSTEM_INSTRUCTION = (
    "You are a manim code generator for engineering undergraduate students. "
    "Write valid Python code using Manim Community Edition (manim). "
    "The main class should be named 'GenScene' and inherit from 'Scene'. "
    "TARGET AUDIENCE: Final-year engineering undergrads. Keep math at textbook level (no research-level derivations).\n"
    "VISUAL-FIRST APPROACH:\n"
    "- Prioritize VISUAL elements: block diagrams, flowcharts, labeled arrows, color-coded regions, geometric shapes, and animated transformations.\n"
    "- Use simple, intuitive equations only when they directly help understanding. Avoid excessive mathematical notation.\n"
    "- Show concepts through diagrams, process flows, and visual metaphors rather than walls of equations.\n"
    "- Use color to differentiate components and highlight important parts.\n"
    "IMPORTANT MANIM CE RULES:\n"
    "- Use `MathTex` or `Tex` for equations only when essential.\n"
    "- ALWAYS use raw strings for LaTeX (e.g., `MathTex(r\"\\frac{1}{2}\")`) to prevent invalid escape sequence errors.\n"
    "- Use `.center()` instead of `.to_center()`.\n"
    "- Note: `DashedCircle` and `Polyline` are not standard in CE, but you may use standard CE alternatives (like DashedVMobject or Polygon).\n"
    "LAYOUT & ALIGNMENT BEST PRACTICES (CRITICAL TO PREVENT OVERLAPPING):\n"
    "- Never let elements stack on top of each other. The default position for all mobjects is the center (0,0) - you MUST position them using `.shift()`, `.to_edge()`, or `.next_to()`.\n"
    "- If showing a graph/axes, position it on one half of the screen and place text on the other half. Never let axes overlap with formulas.\n"
    "- Group related text lines using `VGroup(line1, line2, ...)` and arrange them cleanly using `.arrange(DOWN, aligned_edge=LEFT, buff=0.4)`.\n"
    "- Use clean padding buffers with `.next_to(other_mobject, DIRECTION, buff=0.5)`.\n"
    "Always import: from manim import * \n"
    "Respond ONLY with the python code block. DO NOT contain markdown outside of the code block."
)


def build_node_system_instruction() -> str:
    return (
        "You are a master Manim code generator creating educational animations for final-year engineering undergraduate students.\n"
        "The main class MUST be named 'GenScene' and inherit from 'Scene'.\n\n"
        "TARGET AUDIENCE: Engineering undergrads. Content must be at textbook level — clear, visual, and intuitive. NOT research papers or advanced proofs.\n\n"
        "VISUAL-FIRST PHILOSOPHY (THIS IS THE MOST IMPORTANT RULE):\n"
        "- Your animations must be PREDOMINANTLY VISUAL, not text-heavy or equation-heavy.\n"
        "- Emphasize: block diagrams, system diagrams, flowcharts, labeled arrows showing data/signal flow, color-coded regions, geometric constructions, animated state transitions, process pipelines, comparison tables, and tree/graph structures.\n"
        "- Use shapes (Rectangle, RoundedRectangle, Circle, Arrow, Line, CurvedArrow, Polygon) to build diagrams that SHOW how things work.\n"
        "- Use color strategically: RED for important, BLUE for input, GREEN for output, YELLOW for highlights, etc.\n"
        "- Equations should be MINIMAL and only appear when they are the core point (e.g., F=ma for Newton's law). Never show long derivations.\n"
        "- When a concept can be explained with a diagram OR an equation, ALWAYS choose the diagram.\n\n"
        "ANIMATION STRUCTURE:\n"
        "1. Title card with topic name (2-3 seconds).\n"
        "2. Visual explanation with diagrams and labeled components (main body, 15-25 seconds).\n"
        "3. One simple worked example or visual demo if applicable (5-10 seconds).\n"
        "4. Brief key takeaway text (3-5 seconds).\n\n"
        "TECHNICAL MANIM CE RULES:\n"
        "1. Keep motion lightweight and purposeful. No decorative bouncing, spinning, or long pauses. Use fast `run_time` values (0.3-0.8s) and short `self.wait(...)` calls.\n"
        "2. Use MathTex/Tex with raw strings when needed, e.g., MathTex(r'\\phi_1'). Keep formulas simple and readable at video resolution.\n"
        "3. NEVER let elements stack on top of each other. Position everything carefully using `.to_edge()`, `.shift()`, or `.next_to()`. Use `VGroup` and `.arrange(DOWN, aligned_edge=LEFT, buff=0.4)` for text blocks.\n"
        "4. Clear the screen between stages using `self.play(FadeOut(mobjects), run_time=0.4)` or `self.clear()`.\n"
        "5. Always import: `from manim import *`.\n"
        "6. LaTeX Line Break Safety: NEVER use `\\n` in LaTeX text strings. Use double-backslash `\\\\` instead.\n"
        "7. Respond ONLY with the Python code block inside a markdown code fence."
    )


def build_node_prompt(node_label: str, description: str) -> str:
    return (
        f"Create a visually rich, diagram-heavy educational animation explaining: {node_label}.\n\n"
        f"Context from source material:\n{description}\n\n"
        f"CRITICAL REQUIREMENTS — READ CAREFULLY:\n"
        f"- Target audience: final-year engineering undergraduate. Keep it at TEXTBOOK level, not research level.\n"
        f"- The animation should last 25-40 seconds total.\n"
        f"- VISUAL OUTPUT IS KING: Build the explanation primarily through DIAGRAMS, not equations.\n"
        f"  * Use block diagrams showing system components connected by arrows.\n"
        f"  * Use flowcharts for processes and algorithms.\n"
        f"  * Use labeled shapes (Rectangle, Circle, RoundedRectangle) as building blocks.\n"
        f"  * Use color-coded regions to distinguish different parts/phases.\n"
        f"  * Use animated arrows to show data flow, signal paths, or cause-effect relationships.\n"
        f"  * Use comparison layouts (side-by-side) to contrast concepts.\n"
        f"- MATH RULES: Only include a formula if it is THE defining equation of this topic (e.g., E=mc² for mass-energy). "
        f"Show at most 1-2 simple equations. Never show step-by-step derivations or proofs.\n"
        f"- Structure: Title (2-3s) → Visual diagram/explanation (15-25s) → Simple example or demo (5-10s) → Key takeaway (3-5s).\n"
        f"- Every visual object must teach a point. No decorative animations.\n"
        f"- Use snappy transitions (run_time 0.3-0.8s). Layout must be clean with no overlapping elements."
    )


def build_repair_prompt(node_label: str, description: str, code: str, stderr: str) -> str:
    return (
        "The Manim render failed. You already have the topic, source description, and original code below. "
        "Reason about the Manim error and return a corrected full Python script only.\n\n"
        f"Topic:\n{node_label}\n\n"
        f"Source description:\n{description}\n\n"
        f"Current code:\n```python\n{code}\n```\n\n"
        f"Manim stderr:\n{stderr}\n\n"
        "Fix only what is needed. Preserve the educational content and visual richness. "
        "Respond ONLY with the corrected Python code block."
    )


REPAIR_SYSTEM_SUFFIX = (
    "\nYou are now in repair mode. Use the Manim stderr as the primary signal. "
    "Do not simplify into a generic fallback video. Return a corrected full scene."
)


# ── Gemini caller with model fallback ────────────────────────────────────────

def is_unavailable(exc: Exception) -> bool:
    """Return True if a Gemini exception looks like a 503 / UNAVAILABLE."""
    code = getattr(exc, "status_code", None)
    if code == 503:
        return True
    msg = str(exc)
    return "503" in msg and "UNAVAILABLE" in msg


def call_gemini(client: Any, model_id: str, contents: str, system_instruction: str) -> Any:
    """Single Gemini call, no retry."""
    return client.models.generate_content(
        model=model_id,
        contents=contents,
        config={"system_instruction": system_instruction},
    )


def call_with_fallback(client: Any, primary_model: str, contents: str, system_instruction: str) -> tuple[Any, str]:
    """Try *primary_model* first, then fall through the catalogue. Returns (response, model_used)."""
    candidates = [primary_model] + [m["id"] for m in MODEL_CATALOG if m["id"] != primary_model]
    last_err = None
    for model_id in candidates:
        try:
            resp = call_gemini(client, model_id, contents, system_instruction)
            return resp, model_id
        except Exception as exc:
            if is_unavailable(exc):
                last_err = exc
                continue
            raise
    raise last_err or RuntimeError("All models unavailable")
