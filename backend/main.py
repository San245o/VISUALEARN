"""
VisualEarn API — rewritten for clarity.

Every route is flat: validate → do work → respond.
Business logic lives in app/ submodules. This file is only route wiring.
"""

import asyncio
import tempfile
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import (
    ALLOWED_MODEL_IDS,
    DEFAULT_MODEL_ID,
    MAX_REPAIR_ATTEMPTS,
    MODEL_CATALOG,
)
from app.clients import get_supabase, get_gemini
from app.models import PromptRequest, NodeVideoRequest, NodeDescriptionRequest, AskPdfRequest
from app.manim_engine import extract_code, sanitize_code, cleanup_temp_video
from app.gemini import (
    CHAT_SYSTEM_INSTRUCTION,
    call_with_fallback,
    is_unavailable,
)
from app.storage import list_chat_videos, make_chat_video_filename, upload_video
from app.video_graph import create_graph, make_initial_state, stream_event
from app import db


# ─── App lifecycle ───────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("VisualEarn API starting up")
    yield
    print("VisualEarn API shutting down")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health / meta ───────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "Welcome to VisualEarn API"}


@app.get("/models")
async def get_models():
    return {"default_model": DEFAULT_MODEL_ID, "models": MODEL_CATALOG}


# ─── Chat videos (list / legacy get) ────────────────────────────────────────

@app.get("/videos")
async def list_videos():
    try:
        return {"videos": list_chat_videos()}
    except Exception:
        traceback.print_exc()
        return {"videos": []}





# ─── Chat video generation ──────────────────────────────────────────────────

@app.post("/generate")
async def generate_chat_video(request: PromptRequest):
    model_id = request.model or DEFAULT_MODEL_ID
    if model_id not in ALLOWED_MODEL_IDS:
        raise HTTPException(400, "Unsupported model")

    client = get_gemini()

    # 1. Generate code via Gemini (with model fallback)
    response, model_used = call_with_fallback(
        client, model_id, request.prompt, CHAT_SYSTEM_INSTRUCTION
    )
    python_code = sanitize_code(extract_code(response.text))

    # 2. Render with Manim
    with tempfile.TemporaryDirectory() as tmpdir:
        from app.manim_engine import run_manim

        result = run_manim(python_code, tmpdir)
        if not result["ok"]:
            raise HTTPException(500, f"Manim render failed: {result['stderr']}")

        video_path = result["video_path"]
        if not video_path:
            raise HTTPException(500, "Video file not found after render")

        # 3. Upload to Supabase Storage
        filename = make_chat_video_filename(request.prompt)
        storage_path = f"chat_videos/{filename}"
        with open(video_path, "rb") as f:
            video_url = upload_video(storage_path, f.read())

    return {
        "video_url": video_url,
        "video_filename": filename,
        "prompt": request.prompt,
        "model_used": model_used,
    }


# ─── PDF & document endpoints ───────────────────────────────────────────────

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted.")

    from pdf_processor import process_pdf

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 50 * 1024 * 1024:
        raise HTTPException(400, "File too large. Max 50MB.")

    result = await process_pdf(file.filename, pdf_bytes)
    return result


@app.get("/documents")
async def list_documents():
    sb = get_supabase()
    result = (
        sb.table("documents")
        .select("id,filename,page_count,total_chunks,created_at")
        .order("created_at", desc=True)
        .execute()
    )
    return {"documents": result.data}


# ─── Mindmap endpoints ──────────────────────────────────────────────────────

@app.post("/generate-mindmap/{document_id}")
async def generate_mindmap_endpoint(document_id: str):
    from mindmap_generator import generate_mindmap

    result = await generate_mindmap(document_id)
    return result


@app.get("/mindmap/{document_id}")
async def get_mindmap(document_id: str):
    sb = get_supabase()
    result = sb.table("mindmaps").select("*").eq("document_id", document_id).execute()
    if not result.data:
        raise HTTPException(404, "No mindmap found for this document.")
    return result.data[0]


# ─── Node description (text only, no video) ─────────────────────────────────

@app.post("/generate-node-description")
async def generate_node_description_endpoint(request: NodeDescriptionRequest):
    from mindmap_generator import generate_node_description

    description = await generate_node_description(
        request.node_label, request.node_description, request.document_id
    )

    existing = db.get_existing_node_record(request.mindmap_id, request.node_id)
    prior_code = db.extract_prior_code(existing.get("description", "")) if existing else None
    prior_video_url = existing.get("video_url") if existing else None
    prior_storage_path = existing.get("video_storage_path") if existing else None

    return db.save_description_only(
        request.mindmap_id,
        request.node_id,
        request.node_label,
        description,
        prior_code,
        prior_video_url,
        prior_storage_path,
    )


# ─── Node video generation (sync) ───────────────────────────────────────────

@app.post("/generate-node-video")
async def generate_node_video(request: NodeVideoRequest):
    # Return cached if available
    if not request.force:
        cached = db.get_existing_node_video(request.mindmap_id, request.node_id)
        if cached:
            return cached

    # Generate description from PDF chunks
    from mindmap_generator import generate_node_description

    description = await generate_node_description(
        request.node_label, request.node_description, request.document_id
    )

    model_id = request.model or "gemini-2.5-flash"
    if model_id not in ALLOWED_MODEL_IDS:
        raise HTTPException(400, "Unsupported model")

    client = get_gemini()
    final_state, model_used = _run_graph_with_fallback(client, model_id, request, description)

    stable_path = final_state.get("video_path")
    try:
        code = final_state.get("code", "")
        stages = final_state.get("stages", [])
        attempts = final_state.get("attempts", 0)

        if final_state.get("failed"):
            return db.save_failed_result(
                request.mindmap_id, request.node_id, request.node_label,
                description, code, final_state.get("render_error", ""),
                stages, model_used,
            )

        if not stable_path:
            raise HTTPException(500, "Video file not found after graph render.")

        return db.save_success_result(
            request.mindmap_id, request.node_id, request.node_label,
            description, code, stable_path, stages, attempts, model_used,
        )
    finally:
        cleanup_temp_video(stable_path)


# ─── Node video generation (streaming NDJSON) ───────────────────────────────

@app.post("/generate-node-video-stream")
async def generate_node_video_stream(request: NodeVideoRequest):
    return StreamingResponse(
        _stream_node_video(request),
        media_type="application/x-ndjson",
    )


def _stream_node_video(request: NodeVideoRequest):
    """Generator that streams stage updates as NDJSON, then the final result."""
    stable_path = None
    try:
        # Return cached
        if not request.force:
            cached = db.get_existing_node_video(request.mindmap_id, request.node_id)
            if cached:
                yield stream_event("done", cached)
                return

        yield stream_event("stage", {"stage": "Obtaining source details for this topic"})

        from mindmap_generator import generate_node_description

        description = asyncio.run(generate_node_description(
            request.node_label, request.node_description, request.document_id
        ))

        model_id = request.model or "gemini-2.5-flash"
        if model_id not in ALLOWED_MODEL_IDS:
            yield stream_event("error", {"error": "Unsupported model"})
            return

        client = get_gemini()
        candidates = [model_id] + [m["id"] for m in MODEL_CATALOG if m["id"] != model_id]
        final_state = None
        model_used = None
        last_stage_count = 0

        for candidate in candidates:
            try:
                graph = create_graph()
                initial = make_initial_state(
                    client, candidate,
                    request.node_label, request.node_description,
                    description, MAX_REPAIR_ATTEMPTS,
                )
                for update in graph.stream(initial, stream_mode="values"):
                    final_state = update
                    stages = update.get("stages", [])
                    for stage in stages[last_stage_count:]:
                        yield stream_event("stage", {"stage": stage, "stages": stages})
                    last_stage_count = len(stages)

                model_used = candidate
                break
            except Exception as exc:
                if is_unavailable(exc):
                    yield stream_event("stage", {"stage": f"{candidate} unavailable; trying next model"})
                    continue
                raise

        if final_state is None or model_used is None:
            yield stream_event("error", {"error": "All models unavailable"})
            return

        stable_path = final_state.get("video_path")
        code = final_state.get("code", "")
        stages = final_state.get("stages", [])
        attempts = final_state.get("attempts", 0)

        if final_state.get("failed"):
            result = db.save_failed_result(
                request.mindmap_id, request.node_id, request.node_label,
                description, code, final_state.get("render_error", ""),
                stages, model_used,
            )
            yield stream_event("done", result)
            return

        if not stable_path:
            yield stream_event("error", {"error": "Video file not found after render"})
            return

        yield stream_event("stage", {"stage": "Uploading the rendered video"})
        result = db.save_success_result(
            request.mindmap_id, request.node_id, request.node_label,
            description, code, stable_path, stages, attempts, model_used,
        )
        yield stream_event("done", result)

    except Exception as exc:
        yield stream_event("error", {"error": str(exc)})
    finally:
        cleanup_temp_video(stable_path)


# ─── PDF Q&A ─────────────────────────────────────────────────────────────────

@app.post("/ask-pdf")
async def ask_pdf(request: AskPdfRequest):
    sb = get_supabase()
    chunks_result = (
        sb.table("document_chunks")
        .select("content")
        .eq("document_id", request.document_id)
        .execute()
    )
    if not chunks_result.data:
        raise HTTPException(404, "No source text chunks found.")

    # Simple keyword ranking
    keywords = request.question.lower().split()
    scored = []
    for chunk in chunks_result.data:
        score = sum(2 for kw in keywords if kw in chunk["content"].lower())
        if score > 0:
            scored.append((score, chunk["content"]))
    scored.sort(key=lambda x: x[0], reverse=True)

    context = "\n\n".join(c[1] for c in scored[:8])
    if not context:
        context = "\n\n".join(c["content"] for c in chunks_result.data[:5])

    client = get_gemini()
    contents = f"Context from PDF:\n{context}\n\nQuestion: {request.question}"
    system = (
        "You are a helpful educational AI assistant. You answer the user's question "
        "strictly based on the context from the PDF document provided. If the answer "
        "cannot be found in the context, synthesize a helpful explanation based on related "
        "concepts present in the document. Respond with clear educational details and format in markdown."
    )
    response = client.models.generate_content(
        model=request.model or "gemini-3.5-flash",
        contents=contents,
        config={"system_instruction": system},
    )
    return {"answer": response.text}


# ─── Internal helpers ────────────────────────────────────────────────────────

def _run_graph_with_fallback(client, model_id, request, description):
    """Run the LangGraph video pipeline, falling through model candidates on 503."""
    candidates = [model_id] + [m["id"] for m in MODEL_CATALOG if m["id"] != model_id]

    for candidate in candidates:
        try:
            graph = create_graph()
            final_state = graph.invoke(
                make_initial_state(
                    client, candidate,
                    request.node_label, request.node_description,
                    description, MAX_REPAIR_ATTEMPTS,
                )
            )
            return final_state, candidate
        except Exception as exc:
            if is_unavailable(exc):
                continue
            raise HTTPException(500, f"[{candidate}] {exc}")

    raise HTTPException(503, f"All models unavailable. Tried: {', '.join(candidates)}")


# ─── Entrypoint ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
