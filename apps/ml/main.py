import os
from typing import List, Dict, Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
