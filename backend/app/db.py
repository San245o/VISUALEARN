"""
Database operations for node_videos.
Centralises the upsert pattern that was copy-pasted everywhere in the old code.
"""

import re
from typing import Any, Dict, Optional

from app.clients import get_supabase
from app.manim_engine import make_description_with_code
from app.storage import make_node_video_path, upload_video


def _upsert_node_video(record: Dict[str, Any], mindmap_id: str, node_id: str) -> Dict[str, Any]:
    """Insert or update a node_video row. Returns the record with its id."""
    sb = get_supabase()

    existing = (
        sb.table("node_videos")
        .select("id")
        .eq("mindmap_id", mindmap_id)
        .eq("node_id", node_id)
        .execute()
    )

    if existing.data:
        row_id = existing.data[0]["id"]
        sb.table("node_videos").update(record).eq("id", row_id).execute()
        record["id"] = row_id
    else:
        result = sb.table("node_videos").insert(record).execute()
        record["id"] = result.data[0]["id"]

    return record


def save_failed_result(
    mindmap_id: str,
    node_id: str,
    node_label: str,
    description: str,
    code: str,
    render_error: str,
    stages: list,
    model_used: str,
) -> Dict[str, Any]:
    """Persist a failed video attempt (description + error, no video URL)."""
    desc_payload = make_description_with_code(description, code, render_error)
    record = {
        "mindmap_id": mindmap_id,
        "node_id": node_id,
        "node_label": node_label,
        "description": desc_payload,
    }
    _upsert_node_video(record, mindmap_id, node_id)
    return {
        "node_id": node_id,
        "description": desc_payload,
        "video_url": None,
        "error": f"Video generation failed after LLM repair attempts: {render_error[:300]}",
        "stages": stages,
        "model_used": model_used,
    }


def save_success_result(
    mindmap_id: str,
    node_id: str,
    node_label: str,
    description: str,
    code: str,
    video_path: str,
    stages: list,
    attempts: int,
    model_used: str,
) -> Dict[str, Any]:
    """Upload the video and persist a successful node video row."""
    desc_payload = make_description_with_code(description, code)
    storage_path = make_node_video_path(mindmap_id, node_id)

    with open(video_path, "rb") as f:
        video_url = upload_video(storage_path, f.read())

    record = {
        "mindmap_id": mindmap_id,
        "node_id": node_id,
        "node_label": node_label,
        "description": desc_payload,
        "video_storage_path": storage_path,
        "video_url": video_url,
    }
    saved = _upsert_node_video(record, mindmap_id, node_id)
    saved["repair_attempts"] = attempts
    saved["stages"] = stages
    saved["model_used"] = model_used
    return saved


def get_existing_node_video(mindmap_id: str, node_id: str) -> Optional[Dict[str, Any]]:
    """Return the existing row if it has a video_url, else None."""
    sb = get_supabase()
    result = (
        sb.table("node_videos")
        .select("*")
        .eq("mindmap_id", mindmap_id)
        .eq("node_id", node_id)
        .execute()
    )
    if result.data and result.data[0].get("video_url"):
        return result.data[0]
    return None


def get_existing_node_record(mindmap_id: str, node_id: str) -> Optional[Dict[str, Any]]:
    """Return the existing row (even without video_url)."""
    sb = get_supabase()
    result = (
        sb.table("node_videos")
        .select("*")
        .eq("mindmap_id", mindmap_id)
        .eq("node_id", node_id)
        .execute()
    )
    return result.data[0] if result.data else None


def save_description_only(
    mindmap_id: str,
    node_id: str,
    node_label: str,
    description: str,
    prior_code: Optional[str],
    prior_video_url: Optional[str],
    prior_storage_path: Optional[str],
) -> Dict[str, Any]:
    """Save a regenerated description while preserving any existing video/code."""
    desc_payload = make_description_with_code(description, prior_code) if prior_code else description
    record = {
        "mindmap_id": mindmap_id,
        "node_id": node_id,
        "node_label": node_label,
        "description": desc_payload,
        "video_url": prior_video_url,
        "video_storage_path": prior_storage_path,
    }
    return _upsert_node_video(record, mindmap_id, node_id)


def extract_prior_code(description: str) -> Optional[str]:
    """Pull the embedded Manim code from a previously saved description."""
    m = re.search(r"<!-- MANIM_CODE_START -->([\s\S]*?)<!-- MANIM_CODE_END -->", description or "")
    return m.group(1).strip() if m else None
