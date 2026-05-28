import os
import subprocess
import tempfile
import re
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

# We will initialize the client dynamically to ensure it reads the latest config
from google import genai

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up...")
    yield
    print("Shutting down...")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PromptRequest(BaseModel):
    prompt: str
    model: Optional[str] = None

MODEL_CATALOG = [
    {
        "id": "gemini-3.5-flash",
        "label": "Gemini 3.5 Flash",
        "status": "stable",
    },
    {
        "id": "gemini-3-flash-preview",
        "label": "Gemini 3 Flash (Preview)",
        "status": "preview",
    },
    {
        "id": "gemini-2.5-flash",
        "label": "Gemini 2.5 Flash",
        "status": "stable",
    },
]

DEFAULT_MODEL_ID = "gemini-3.5-flash"
ALLOWED_MODEL_IDS = {model["id"] for model in MODEL_CATALOG}

def extract_code(text: str) -> str:
    code_match = re.search(r"```(?:python)?(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if code_match:
        return code_match.group(1).strip()
    return text.strip()

def sanitize_latex(code: str) -> str:
    # Replace LaTeX-based mobjects to avoid requiring a full LaTeX install.
    code = re.sub(r"\bMathTex\b", "Text", code)
    code = re.sub(r"\bTex\b", "Text", code)
    return code

@app.get("/")
async def root():
    return {"message": "Welcome to VisualEarn API"}

@app.get("/models")
async def get_models():
    return {"default_model": DEFAULT_MODEL_ID, "models": MODEL_CATALOG}

@app.post("/generate")
async def generate_manim_video(request: PromptRequest):
    try:
        system_instruction = (
            "You are a manim code generator for engineering students doing topics. "
            "Write valid Python code using Manim. The main class should be named 'GenScene' and inherit from 'Scene'. "
            "Avoid Tex/MathTex or any LaTeX usage; use Text and basic shapes instead. "
            "Respond ONLY with the python code block. DO NOT contain markdown outside of the code block. Make sure to import manim."
        )

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise Exception("API key is not set in environment.")
            
        client = genai.Client(api_key=api_key)

        model_id = request.model or DEFAULT_MODEL_ID
        if model_id not in ALLOWED_MODEL_IDS:
            raise HTTPException(status_code=400, detail="Unsupported model")
        
        response = client.models.generate_content(
            model=model_id,
            contents=request.prompt,
            config={'system_instruction': system_instruction}
        )
        
        text_response = response.text
        
        python_code = sanitize_latex(extract_code(text_response))
        
        with tempfile.TemporaryDirectory() as tmpdir:
            temp_file_path = os.path.join(tmpdir, "scene.py")
            with open(temp_file_path, "w", encoding="utf-8") as f:
                f.write(python_code)
                
            media_dir = os.path.join(tmpdir, "media")
            manim_cmd = [
                "python3", "-m", "manim", 
                temp_file_path, 
                "GenScene", 
                "-ql", 
                "--media_dir", media_dir,
                "-o", "output.mp4"
            ]
            
            result = subprocess.run(
                manim_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            if result.returncode != 0:
                print("Manim Error:", result.stderr)
                # Fallback to gemini-1.5-flash if 3.5 causes issues maybe? Usually manim code generation can have syntax issues.
                raise HTTPException(status_code=500, detail=f"Failed to generate video. {result.stderr}")
            
            video_path = None
            for root_dir, _, files in os.walk(media_dir):
                if "output.mp4" in files:
                    video_path = os.path.join(root_dir, "output.mp4")
                    break
                    
            if not video_path:
                raise HTTPException(status_code=500, detail="Video file not found after generation.")
            
            final_dst = os.path.join(os.getcwd(), "public_videos", "output.mp4")
            os.makedirs(os.path.dirname(final_dst), exist_ok=True)
            import shutil
            shutil.copy(video_path, final_dst)
            
            return {"video_url": "http://localhost:8000/videos/output.mp4"}
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/videos/{filename}")
async def get_video(filename: str):
    file_path = os.path.join(os.getcwd(), "public_videos", filename)
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="video/mp4")
    raise HTTPException(status_code=404, detail="File not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
