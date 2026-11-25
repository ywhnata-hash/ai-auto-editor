from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from pathlib import Path
import uuid, json, shutil, subprocess, threading, re, os

BASE = Path(__file__).resolve().parents[1] / "data"
BASE.mkdir(parents=True, exist_ok=True)
app = FastAPI(title="AI Auto Editor API", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(p.stderr[-4000:])
    return p.stdout

def project_dir(pid): return BASE / pid
def load(pid):
    f = project_dir(pid) / "project.json"
    if not f.exists(): raise HTTPException(404, "Project not found")
    return json.loads(f.read_text(encoding="utf-8"))
def save(pid, data): (project_dir(pid)/"project.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

class DecisionUpdate(BaseModel):
    status: str

class ExportSettings(BaseModel):
    brightness: float = Field(0, ge=-0.3, le=0.3)
    contrast: float = Field(1, ge=0.5, le=2)
    saturation: float = Field(1, ge=0, le=2)
    warmth: float = Field(0, ge=-1, le=1)
    sharpen: float = Field(0, ge=0, le=1)
    vignette: float = Field(0, ge=0, le=1)
    noise_reduction: bool = True
    voice_clarity: bool = True
    fade_seconds: float = Field(0.5, ge=0, le=3)

@app.get("/api/health")
def health():
    try:
        run(["ffmpeg", "-version"])
        ffmpeg = True
    except Exception: ffmpeg = False
    return {"ok": True, "ffmpeg_available": ffmpeg}

@app.post("/api/projects")
async def create_project(file: UploadFile = File(...)):
    pid = str(uuid.uuid4())
    folder = project_dir(pid); folder.mkdir(parents=True)
    ext = Path(file.filename or "source.mp4").suffix or ".mp4"
    source = folder / ("source" + ext)
    with source.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    try:
        info = json.loads(run(["ffprobe","-v","error","-show_entries","format=duration:stream=codec_type,width,height,r_frame_rate","-of","json",str(source)]))
    except Exception as e:
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(400, f"Could not read media. Is FFmpeg installed? {e}")
    streams=info.get("streams",[])
    v = next((s for s in streams if s.get("codec_type")=="video"), {})
    has_audio=any(s.get("codec_type")=="audio" for s in streams)
    duration = float(info.get("format",{}).get("duration",0))
    data = {"id":pid,"name":Path(file.filename or "Untitled").stem,"source":source.name,
            "duration":duration,"width":v.get("width"),"height":v.get("height"),
            "fps":v.get("r_frame_rate"),"has_audio":has_audio,"status":"uploaded","transcript":[],"decisions":[]}
    save(pid,data)
    return data

def analyze_worker(pid):
    data=load(pid); folder=project_dir(pid); src=folder/data["source"]
    data["status"]="analyzing"; save(pid,data)
    try:
        audio=folder/"audio.wav"
        run(["ffmpeg","-y","-i",str(src),"-vn","-ac","1","-ar","16000",str(audio)])
        p=subprocess.run(["ffmpeg","-hide_banner","-i",str(src),"-af","silencedetect=noise=-35dB:d=0.8","-f","null","-"],capture_output=True,text=True)
        starts=[float(x) for x in re.findall(r"silence_start:\\s*([0-9.]+)",p.stderr)]
        ends=[float(x) for x in re.findall(r"silence_end:\\s*([0-9.]+)",p.stderr)]
        decisions=[]
        for a,b in zip(starts,ends):
            if b-a >= 1.0:
                decisions.append({"id":str(uuid.uuid4()),"type":"silence","start":max(0,a),"end":min(data["duration"],b),
                                  "label":f"Possible pause ({b-a:.1f}s)","reason":"Long low-volume interval; review before cutting.","status":"pending"})
        data["decisions"]=decisions
        try:
            from faster_whisper import WhisperModel
            model=WhisperModel(os.getenv("WHISPER_MODEL","base"), device="cpu", compute_type="int8")
            segments, meta=model.transcribe(str(audio), language="ar", word_timestamps=True, vad_filter=True)
            transcript=[]
            for seg in segments:
                words=[{"word":w.word,"start":w.start,"end":w.end} for w in seg.words] if seg.words else []
                transcript.append({"text":seg.text,"start":seg.start,"end":seg.end,"words":words})
            data["transcript"]=transcript
            data["language"]=meta.language
        except Exception as e:
            data["transcription_note"]=f"Optional faster-whisper unavailable or failed: {str(e)[:300]}"
        data["status"]="analyzed"
    except Exception as e:
        data["status"]="error"; data["error"]=str(e)
    save(pid,data)

@app.post("/api/projects/{pid}/analyze")
def analyze(pid: str):
    data=load(pid)
    if data["status"]=="analyzing": return {"status":"analyzing"}
    threading.Thread(target=analyze_worker,args=(pid,),daemon=True).start()
    return {"status":"queued"}

@app.get("/api/projects/{pid}")
def get_project(pid: str): return load(pid)

@app.patch("/api/projects/{pid}/decisions/{did}")
def update_decision(pid: str,did: str, body: DecisionUpdate):
    if body.status not in ("approved","rejected","pending"): raise HTTPException(400,"Invalid status")
    data=load(pid)
    found=False
    for d in data["decisions"]:
        if d["id"]==did: d["status"]=body.status; found=True
    if not found: raise HTTPException(404,"Decision not found")
    save(pid,data); return data

@app.post("/api/projects/{pid}/export")
def export_project(pid: str, settings: ExportSettings):
    data=load(pid); folder=project_dir(pid); src=folder/data["source"]
    cuts=sorted([(d["start"],d["end"]) for d in data["decisions"] if d["status"]=="approved" and d["type"]=="silence"])
    merged=[]
    for a,b in cuts:
        a=max(0,float(a)); b=min(data["duration"],float(b))
        if b<=a: continue
        if merged and a<=merged[-1][1]+0.05: merged[-1]=(merged[-1][0],max(merged[-1][1],b))
        else: merged.append((a,b))
    keep=[]; cur=0.0
    for a,b in merged:
        if a>cur: keep.append((cur,a))
        cur=max(cur,b)
    if cur<data["duration"]: keep.append((cur,data["duration"]))
    if not keep: keep=[(0,data["duration"])]
    # Build real FFmpeg filters: per-segment trim/concat, then image and audio processing.
    filters=[]; inputs=[]
    for i,(a,b) in enumerate(keep):
        filters += [f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS[v{i}]"]
        if data.get("has_audio", True):
            filters += [f"[0:a]atrim=start={a:.3f}:end={b:.3f},asetpts=PTS-STARTPTS[a{i}]"]
            inputs.append(f"[v{i}][a{i}]")
        else:
            inputs.append(f"[v{i}]")
    if data.get("has_audio", True):
        filters.append("".join(inputs)+f"concat=n={len(keep)}:v=1:a=1[vcat][acat]")
    else:
        filters.append("".join(inputs)+f"concat=n={len(keep)}:v=1:a=0[vcat]")
    # Color correction and finishing filters.
    vf=(f"eq=brightness={settings.brightness:.3f}:contrast={settings.contrast:.3f}:saturation={settings.saturation:.3f},"
        f"hue=h={settings.warmth*8:.2f},unsharp=5:5:{settings.sharpen:.2f}:5:5:0")
    if settings.vignette > 0:
        vf += f",vignette=PI/{max(1.0,2.0+settings.vignette*6):.2f}"
    fade=min(settings.fade_seconds, max(0.0,data["duration"]/2))
    if fade > 0:
        vf += f",fade=t=in:st=0:d={fade:.3f},fade=t=out:st={max(0,data['duration']-fade):.3f}:d={fade:.3f}"
    filters.append(f"[vcat]{vf}[vout]")
    if data.get("has_audio", True):
        af=[]
        if settings.voice_clarity: af += ["highpass=f=75","lowpass=f=15000","acompressor=threshold=0.125:ratio=2:attack=20:release=250"]
        if settings.noise_reduction: af += ["afftdn=nf=-25"]
        af += ["loudnorm=I=-16:TP=-1.5:LRA=11"]
        if fade > 0: af += [f"afade=t=in:st=0:d={fade:.3f}",f"afade=t=out:st={max(0,data['duration']-fade):.3f}:d={fade:.3f}"]
        filters.append(f"[acat]{','.join(af)}[aout]")
    out=folder/"final.mp4"
    cmd=["ffmpeg","-y","-i",str(src),"-filter_complex",";".join(filters),"-map","[vout]"]
    if data.get("has_audio", True): cmd += ["-map","[aout]"]
    cmd += ["-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p"]
    if data.get("has_audio", True): cmd += ["-c:a","aac","-b:a","192k"]
    cmd += ["-movflags","+faststart",str(out)]
    try:
        run(cmd)
        # Verify output before declaring success.
        run(["ffprobe","-v","error","-show_entries","format=duration:stream=codec_type","-of","json",str(out)])
    except Exception as e:
        raise HTTPException(500, f"Export failed: {e}")
    project={**data,"timeline":{"segments":[{"source":data["source"],"start":a,"end":b} for a,b in keep]},
             "export":{"file":"final.mp4","resolution":"source","settings":settings.model_dump()}}
    (folder/"editable-project.json").write_text(json.dumps(project,ensure_ascii=False,indent=2),encoding="utf-8")
    def ts(t):
        ms=int(t*1000); h=ms//3600000; m=(ms%3600000)//60000; s=(ms%60000)//1000; ms%=1000
        return f"{h:02}:{m:02}:{s:02},{ms:03}"
    lines=[]
    for i,s in enumerate(data.get("transcript",[]),1):
        lines += [str(i),f"{ts(s['start'])} --> {ts(s['end'])}",s["text"].strip(),""]
    (folder/"captions.srt").write_text("\\n".join(lines),encoding="utf-8")
    return {"video":"/api/projects/"+pid+"/download/final.mp4",
            "project":"/api/projects/"+pid+"/download/editable-project.json",
            "srt":"/api/projects/"+pid+"/download/captions.srt","kept_segments":len(keep),
            "applied_settings":settings.model_dump()}

@app.get("/api/projects/{pid}/download/{filename}")
def download(pid: str,filename: str):
    if filename not in ("final.mp4","editable-project.json","captions.srt"): raise HTTPException(400,"Invalid file")
    f=project_dir(pid)/filename
    if not f.exists(): raise HTTPException(404,"File not ready")
    return FileResponse(f, filename=filename)
