import os
from typing import Dict, Any
import tempfile
import io

import numpy as np
import requests
import librosa
import soundfile as sf

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CLIENT_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/plan-transition")
def plan_transition(tracks: Dict[str, Any]):
    """
    Naive rule-based transition planner.
    Expects payload with two tracks' audio features/analysis:
    {
      "from": { "tempo": number, "key": number, "sections": [...], "beats": [...] },
      "to":   { "tempo": number, "key": number, "sections": [...], "beats": [...] }
    }
    Returns a suggested crossfade window and tempo ratio.
    """
    source = tracks.get("from", {})
    target = tracks.get("to", {})

    from_tempo = float(source.get("tempo", 120.0))
    to_tempo = float(target.get("tempo", 120.0))

    tempo_ratio = to_tempo / max(from_tempo, 1e-6)

    # Default crossfade
    crossfade_seconds = 12.0

    # If keys match or are camelot-compatible, longer blend
    from_key = int(source.get("key", -1))
    to_key = int(target.get("key", -1))
    harmonic_bonus = 4.0 if (from_key == to_key and from_key != -1) else 0.0

    # Prefer aligning near the end of the source and start of the target
    from_duration = float(source.get("duration_ms", 0)) / 1000.0
    to_intro = 0.0

    # If analysis sections exist, try using last section for from and first for to
    try:
        from_sections = source.get("sections") or []
        to_sections = target.get("sections") or []
        if from_sections:
            last_section = from_sections[-1]
            from_outro_start = float(last_section.get("start", max(from_duration - crossfade_seconds, 0)))
        else:
            from_outro_start = max(from_duration - crossfade_seconds, 0)
        if to_sections:
            first_section = to_sections[0]
            to_intro = float(first_section.get("start", 0.0))
    except Exception:
        from_outro_start = max(from_duration - crossfade_seconds, 0)

    # Build plan
    plan = {
        "tempoRatio": tempo_ratio,
        "from": {
            "start": max(from_outro_start - harmonic_bonus, 0.0),
            "duration": crossfade_seconds + harmonic_bonus,
        },
        "to": {
            "start": to_intro,
            "duration": crossfade_seconds + harmonic_bonus,
        },
        "strategy": "smooth",
    }

    return plan


@app.post("/offline-mix")
def offline_mix(payload: Dict[str, Any]):
    """
    Create a simple offline crossfade mix between two audio URLs.
    Payload:
    {
      "from": { "url": str, "startSec"?: number, "durationSec"?: number },
      "to":   { "url": str, "startSec"?: number, "durationSec"?: number },
      "crossfadeSec"?: number
    }
    Returns a WAV audio stream.
    """
    src = payload.get("from", {})
    tgt = payload.get("to", {})
    crossfade_sec = float(payload.get("crossfadeSec", 12.0))

    def download_to_temp(url: str) -> str:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        fd, path = tempfile.mkstemp()
        with os.fdopen(fd, "wb") as f:
            f.write(r.content)
        return path

    def load_segment(url: str, start_sec: float = 0.0, duration_sec: float | None = None, sr: int = 44100) -> np.ndarray:
        path = download_to_temp(url)
        try:
            y, _sr = librosa.load(path, sr=sr, mono=True)
        finally:
            try:
                os.remove(path)
            except Exception:
                pass
        if start_sec > 0:
            y = y[int(start_sec * sr):]
        if duration_sec is not None and duration_sec > 0:
            y = y[:int(duration_sec * sr)]
        return y

    from_url = str(src.get("url", ""))
    to_url = str(tgt.get("url", ""))
    if not from_url or not to_url:
        return {"error": "Missing from.url or to.url"}

    sr = 44100
    y_from = load_segment(from_url, float(src.get("startSec", 0.0)), src.get("durationSec"), sr)
    y_to = load_segment(to_url, float(tgt.get("startSec", 0.0)), tgt.get("durationSec"), sr)

    overlap = int(max(0.5, crossfade_sec) * sr)
    if len(y_from) <= overlap or len(y_to) <= overlap:
        # If too short, just concatenate
        mixed = np.concatenate([y_from, y_to])
    else:
        y_from_head = y_from[:-overlap]
        y_from_tail = y_from[-overlap:]
        y_to_head = y_to[:overlap]
        y_to_tail = y_to[overlap:]

        fade_out = np.linspace(1.0, 0.0, overlap)
        fade_in = 1.0 - fade_out
        overlap_mix = y_from_tail * fade_out + y_to_head * fade_in

        mixed = np.concatenate([y_from_head, overlap_mix, y_to_tail])

    # Normalize to -1..1 to avoid clipping
    peak = np.max(np.abs(mixed)) if mixed.size else 1.0
    if peak > 1.0:
        mixed = mixed / peak

    buf = io.BytesIO()
    sf.write(buf, mixed, sr, format="WAV", subtype="PCM_16")
    buf.seek(0)
    return StreamingResponse(buf, media_type="audio/wav")
