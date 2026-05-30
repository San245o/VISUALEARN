"""
Everything related to running Manim code:
  - code extraction / sanitisation
  - subprocess execution
  - stable temp-file management
"""

import os
import re
import subprocess
import tempfile
import uuid
from typing import Any, Dict, Optional


# ── Code extraction ──────────────────────────────────────────────────────────

def extract_code(text: str) -> str:
    """Pull the first fenced Python block out of an LLM response."""
    m = re.search(r"```(?:python)?(.*?)```", text, re.DOTALL | re.IGNORECASE)
    return m.group(1).strip() if m else text.strip()


def sanitize_code(code: str) -> str:
    """Inject polyfills for common AI hallucinations (Polyline, DashedCircle)."""
    if "Polyline" in code:
        shim = (
            "\n# Polyfill: Polyline\n"
            "class Polyline(VMobject):\n"
            "    def __init__(self, *points, **kwargs):\n"
            "        super().__init__(**kwargs)\n"
            "        if len(points) >= 2:\n"
            "            import numpy as np\n"
            "            pts = [np.array(p) if not hasattr(p, '__len__') or len(p) != 3 else np.array(p) for p in points]\n"
            "            self.set_points_as_corners(pts)\n"
        )
        code = code.replace("from manim import *", f"from manim import *{shim}")

    if "DashedCircle" in code:
        shim = (
            "\n# Polyfill: DashedCircle\n"
            "class DashedCircle(DashedVMobject):\n"
            "    def __init__(self, radius=1.0, num_dashes=15, **kwargs):\n"
            "        super().__init__(Circle(radius=radius), num_dashes=num_dashes, **kwargs)\n"
        )
        if "from manim import *" in code:
            code = code.replace("from manim import *", f"from manim import *{shim}")
        else:
            code = shim + "\n" + code

    if "np." in code and "import numpy" not in code:
        code = "import numpy as np\n" + code

    return code


# ── Manim subprocess ─────────────────────────────────────────────────────────

def run_manim(python_code: str, tmpdir: str) -> Dict[str, Any]:
    """Write code to a file, run `manim`, return structured result."""
    scene_file = os.path.join(tmpdir, "scene.py")
    with open(scene_file, "w", encoding="utf-8") as f:
        f.write(python_code)

    media_dir = os.path.join(tmpdir, "media")
    proc = subprocess.run(
        [
            "python3", "-m", "manim",
            scene_file, "GenScene", "-ql",
            "--media_dir", media_dir,
            "-o", "output.mp4",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    video_path = None
    if proc.returncode == 0:
        for root_dir, _, files in os.walk(media_dir):
            if "output.mp4" in files:
                video_path = os.path.join(root_dir, "output.mp4")
                break

    return {
        "ok": proc.returncode == 0 and video_path is not None,
        "video_path": video_path,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }


def copy_to_stable_temp(video_path: str) -> str:
    """Copy a video out of a temp directory before it is deleted."""
    stable = os.path.join(tempfile.gettempdir(), f"visualearn_{uuid.uuid4().hex}.mp4")
    with open(video_path, "rb") as src, open(stable, "wb") as dst:
        dst.write(src.read())
    return stable


def cleanup_temp_video(path: Optional[str]) -> None:
    """Silently remove a temp video if it exists."""
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass


# ── Description helpers ──────────────────────────────────────────────────────

def make_description_with_code(
    description: str, code: Optional[str], error: Optional[str] = None
) -> str:
    """Embed the generated Manim code (and optional error) into the description markdown."""
    if not code:
        return description
    payload = f"{description}\n\n<!-- MANIM_CODE_START -->\n{code}\n<!-- MANIM_CODE_END -->"
    if error:
        payload += f"\n\n<!-- MANIM_ERROR_START -->\n{error[:4000]}\n<!-- MANIM_ERROR_END -->"
    return payload
