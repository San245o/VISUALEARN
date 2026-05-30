"""
Supabase Storage helpers for uploading videos and listing chat_videos.
"""

import os
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List

from app.clients import get_supabase
from app.config import SUPABASE_URL


def upload_video(storage_path: str, video_bytes: bytes) -> str:
    """Upload video bytes to the 'videos' bucket and return the public URL."""
    get_supabase().storage.from_("videos").upload(
        storage_path, video_bytes, {"content-type": "video/mp4"}
    )
    return f"{SUPABASE_URL}/storage/v1/object/public/videos/{storage_path}"


def make_chat_video_filename(prompt: str) -> str:
    """Deterministic slug + timestamp filename for chat videos."""
    slug = re.sub(r"[^a-zA-Z0-9\s]", "", prompt)
    slug = re.sub(r"\s+", "_", slug.strip())[:40].rstrip("_").lower()
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    short_id = uuid.uuid4().hex[:6]
    return f"{slug}_{ts}_{short_id}.mp4"


def make_node_video_path(mindmap_id: str, node_id: str) -> str:
    return f"node_videos/{mindmap_id}/{node_id}_{uuid.uuid4().hex[:6]}.mp4"


def list_chat_videos() -> List[Dict[str, Any]]:
    """List all .mp4 files in the chat_videos folder of the videos bucket."""
    sb = get_supabase()
    files = sb.storage.from_("videos").list("chat_videos")
    videos = []
    for f in files:
        name = f.get("name")
        if not name or not name.endswith(".mp4"):
            continue
        path = f"chat_videos/{name}"
        url = f"{SUPABASE_URL}/storage/v1/object/public/videos/{path}"
        meta = f.get("metadata") or {}
        size = meta.get("size", 0) if isinstance(meta, dict) else 0
        created = f.get("created_at") or f.get("updated_at") or datetime.now().isoformat()
        videos.append({"filename": name, "url": url, "size_bytes": size, "created_at": created})
    videos.sort(key=lambda v: v["filename"], reverse=True)
    return videos
