# FrameForge AI — Video Editor

> The original MVP is retained in this repository. A full open-source nonlinear editing engine is now vendored under `engine/cutaway/` on the `cutaway-engine-migration` branch.

## Run the new editing engine

Requirements: Node.js 20+ and pnpm 10+.

```bash
cd engine/cutaway
pnpm install
pnpm dev
```

Open the local URL printed by Next.js (normally http://localhost:3000).

The imported editor includes a multi-track timeline, WebGL preview, media import, captions with on-device Whisper transcription, color/effects, masks, transitions, keyframes, undo/redo, and WebCodecs export. These are upstream project capabilities and still require local verification before production use.

## Migration status

- Upstream: [S07K/Cutaway](https://github.com/S07K/cutaway)
- Upstream license: MIT; original license and attribution are preserved in `engine/cutaway/LICENSE`.
- Browser branding has been changed to FrameForge AI.
- The imported engine is isolated under `engine/cutaway/`; the previous MVP remains untouched.
- CI checks are configured in `.github/workflows/frameforge-engine-ci.yml`.
- This branch is not yet merged into `main` or deployed. Build and browser verification are still required.

---

# AI Auto Editor — MVP (Social / Arabic / Auto Resolution)

A zero-cost, local-first starter project. It is a working scaffold, not a finished AI editor.
It provides:
- Next.js web UI for uploading a video and viewing its analysis job.
- FastAPI backend for upload, media probing, audio extraction, silence detection, and an editable JSON edit-decision list (EDL).
- Optional Arabic transcription with `faster-whisper` (install separately; model downloads require internet).
- FFmpeg-based rendering from approved EDL segments.
- Export of MP4 + editable project JSON + SRT placeholder/real transcript when available.

## Requirements
- Python 3.10+
- Node.js 20+
- FFmpeg + ffprobe installed and available on PATH

## Run backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Optional transcription:
```bash
pip install faster-whisper
```
The first run downloads the selected model. For a CPU laptop start with `tiny` or `base`.

## Run frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:3000

## Workflow
1. Upload a video.
2. Backend probes resolution/duration and creates a project.
3. Click Analyze. Silence detection creates *suggestions*, never auto-deletes content.
4. If `faster-whisper` is installed, Arabic transcription is attempted.
5. Review/approve or reject suggestions in the UI.
6. Export uses only approved cuts and produces `final.mp4` + `project.json`.

## Important limitations of this MVP
- No automatic semantic take selection yet.
- No automatic B-roll sourcing; the next milestone is a user-managed B-roll library with AI matching.
- Silence detection is heuristic and suggestions must be reviewed.
- The JSON project is editable inside this app. Native CapCut project export is not implemented.
- Large uploads are currently single-request uploads; resumable/chunked upload is a planned hardening step.
- For public deployment, add authentication, quotas, private object storage, malware scanning, and worker isolation first.

## API
- `POST /api/projects` multipart `file`
- `POST /api/projects/{id}/analyze`
- `GET /api/projects/{id}`
- `PATCH /api/projects/{id}/decisions/{decision_id}`
- `POST /api/projects/{id}/export`
- `GET /api/projects/{id}/download/{filename}`
