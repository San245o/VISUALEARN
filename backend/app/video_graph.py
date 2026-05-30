"""
LangGraph-based video generation pipeline.

Graph:  obtain_details → build_code → render_code ─┐
                                          ↑         │
                                     repair_code ←──┘ (if failed & attempts < max)

Also contains the streaming wrapper for the node-video-stream endpoint.
"""

import json
import tempfile
from typing import Any, Dict, Optional, TypedDict

from langgraph.graph import StateGraph, END

from app.manim_engine import (
    copy_to_stable_temp,
    extract_code,
    run_manim,
    sanitize_code,
)
from app.gemini import (
    build_node_prompt,
    build_node_system_instruction,
    build_repair_prompt,
    call_gemini,
    REPAIR_SYSTEM_SUFFIX,
)


# ── Graph state ──────────────────────────────────────────────────────────────

class VideoState(TypedDict, total=False):
    node_label: str
    node_description: str
    description: str
    model_id: str
    client: Any
    system_instruction: str
    manim_prompt: str
    code: str
    video_path: Optional[str]
    render_error: Optional[str]
    render_stdout: Optional[str]
    attempts: int
    max_repairs: int
    status_text: str
    stages: list[str]
    failed: bool


def _stage(state: VideoState, text: str) -> VideoState:
    stages = list(state.get("stages", []))
    stages.append(text)
    return {**state, "status_text": text, "stages": stages}


# ── Graph nodes ──────────────────────────────────────────────────────────────

def _obtain_details(state: VideoState) -> VideoState:
    return _stage(state, "Reading the topic details and source context")


def _build_code(state: VideoState) -> VideoState:
    state = _stage(state, "Building the Manim scene code")
    resp = call_gemini(state["client"], state["model_id"], state["manim_prompt"], state["system_instruction"])
    return {**state, "code": sanitize_code(extract_code(resp.text)), "attempts": 0}


def _render_code(state: VideoState) -> VideoState:
    state = _stage(state, "Rendering the animation engine output")
    with tempfile.TemporaryDirectory() as tmpdir:
        result = run_manim(sanitize_code(state["code"]), tmpdir)
        if result["ok"]:
            return {
                **state,
                "code": sanitize_code(state["code"]),
                "video_path": copy_to_stable_temp(result["video_path"]),
                "render_error": None,
                "render_stdout": result.get("stdout"),
                "failed": False,
            }
        return {
            **state,
            "video_path": None,
            "render_error": result.get("stderr") or "Manim render failed without stderr.",
            "render_stdout": result.get("stdout"),
            "failed": True,
        }


def _repair_code(state: VideoState) -> VideoState:
    attempts = state.get("attempts", 0) + 1
    state = _stage(state, f"Manim reported an error; asking the LLM to repair the code (attempt {attempts})")
    prompt = build_repair_prompt(
        state["node_label"], state["description"], state["code"], state.get("render_error", "")
    )
    system = state["system_instruction"] + REPAIR_SYSTEM_SUFFIX
    resp = call_gemini(state["client"], state["model_id"], prompt, system)
    return {**state, "code": sanitize_code(extract_code(resp.text)), "attempts": attempts}


def _should_repair(state: VideoState) -> str:
    if not state.get("failed"):
        return "success"
    if state.get("attempts", 0) >= state.get("max_repairs", 2):
        return "failure"
    return "repair"


# ── Graph factory ────────────────────────────────────────────────────────────

def create_graph() -> Any:
    g = StateGraph(VideoState)
    g.add_node("obtain_details", _obtain_details)
    g.add_node("build_code", _build_code)
    g.add_node("render_code", _render_code)
    g.add_node("repair_code", _repair_code)
    g.set_entry_point("obtain_details")
    g.add_edge("obtain_details", "build_code")
    g.add_edge("build_code", "render_code")
    g.add_conditional_edges("render_code", _should_repair, {
        "success": END,
        "repair": "repair_code",
        "failure": END,
    })
    g.add_edge("repair_code", "render_code")
    return g.compile()


# ── Helpers for building initial state ───────────────────────────────────────

def make_initial_state(
    client: Any,
    model_id: str,
    node_label: str,
    node_description: str,
    description: str,
    max_repairs: int = 2,
) -> VideoState:
    return VideoState(
        node_label=node_label,
        node_description=node_description,
        description=description,
        client=client,
        model_id=model_id,
        system_instruction=build_node_system_instruction(),
        manim_prompt=build_node_prompt(node_label, description),
        max_repairs=max_repairs,
        stages=["Obtaining source details for this topic"],
    )


# ── NDJSON streaming helper ──────────────────────────────────────────────────

def stream_event(event_type: str, payload: Dict[str, Any]) -> str:
    return json.dumps({"type": event_type, **payload}) + "\n"
