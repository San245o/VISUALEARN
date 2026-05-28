# VISUALEARN (VisualEarn)

Full-stack app that generates short Manim animations from a text prompt meant for engineering students who cant visualise maths concepts from just vague textbook definitions. Manim library helps visualising such concepts, generates a video which is available to the user.

- `backend/`: FastAPI API that calls Gemini (via `google-genai`) to generate Manim code, renders it with Manim, then serves the resulting `.mp4`.
- `frontend/`: Next.js UI for entering prompts, selecting a model, and previewing the generated video.
output:
<img width="746" height="556" alt="image" src="https://github.com/user-attachments/assets/f61c4306-d977-4389-a670-24ccf1f74f7f" />
<img width="768" height="540" alt="image" src="https://github.com/user-attachments/assets/8eb8467c-5b17-4982-b575-3610f5fd2216" />

## Prerequisites

- Python 3
- Node.js + npm
- A Gemini API key in `GEMINI_API_KEY`
- Manim system dependencies (only needed to actually render videos). On Linux, Manim typically requires Cairo/Pango (e.g. `pangocairo`) to be available via your OS package manager.

## Quick Start

### 1) Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```bash
GEMINI_API_KEY=your_key_here
```

Run the API:

```bash
python main.py
```

Backend URLs:
- API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 2) Frontend (Next.js)

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`.

Note: the frontend currently calls the backend at `http://localhost:8000` (hardcoded in `frontend/src/app/page.tsx`).

## API Overview

- `GET /models`: available Gemini model IDs and the default model.
- `POST /generate`: `{ "prompt": "...", "model": "optional-model-id" }` → `{ "video_url": "http://localhost:8000/videos/output.mp4" }`
- `GET /videos/{filename}`: serves generated videos from `backend/public_videos/`.

## Development

- Backend tests: `cd backend && python -m pytest`
- Frontend lint: `cd frontend && npm run lint`
- Frontend build: `cd frontend && npm run build`

## More Docs

- Backend details: `backend/README.md`
- Frontend details: `frontend/README.md`


output:
<img width="737" height="433" alt="image" src="https://github.com/user-attachments/assets/00b55760-51fc-4aca-ac3e-a487e97debc4" />


