import { Router, Request } from "express";
import cookie from "cookie";
import { spotifyGet } from "./spotify";

const router = Router();

const COOKIE_NAME = "sp_session";
const ML_URL = process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "http://localhost:8000";

type Session = { accessToken: string; refreshToken?: string; expiresAt: number };

function getSession(req: Request): Session | null {
  const cookies = cookie.parse(req.headers.cookie || "");
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

router.get("/analysis", async (req, res) => {
  try {
    const trackId = String(req.query.trackId || "");
    if (!trackId) return res.status(400).send("Missing trackId");

    const session = getSession(req);
    if (!session) return res.status(401).send("No session");
    if (Date.now() > session.expiresAt) return res.status(401).send("Token expired");

    const analysis = await spotifyGet(`/audio-analysis/${trackId}`, session.accessToken);
    const features = await spotifyGet(`/audio-features/${trackId}`, session.accessToken);

    res.json({ analysis, features });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch analysis" });
  }
});

router.post("/plan", async (req, res) => {
  try {
    const payload = req.body;
    const resp = await fetch(`${ML_URL}/plan-transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) return res.status(500).send(await resp.text());
    const plan = await resp.json();
    res.json(plan);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to plan transition" });
  }
});

export default router;
// Truncate accidental duplicate/corrupted content below
