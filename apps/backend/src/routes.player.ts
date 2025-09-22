import { Router } from "express";
import cookie from "cookie";

const router = Router();
const COOKIE_NAME = "sp_session";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

function getSession(req: any): { accessToken: string; refreshToken?: string; expiresAt: number } | null {
  const cookies = cookie.parse(req.headers.cookie || "");
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

router.get("/token", (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).send("No session");
  if (Date.now() > session.expiresAt) return res.status(401).send("Token expired");
  res.json({ access_token: session.accessToken, expires_at: session.expiresAt });
});

router.post("/transfer", async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).send("No session");
    const { device_id } = req.body || {};
    if (!device_id) return res.status(400).send("Missing device_id");
    const resp = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ device_ids: [device_id], play: false }),
    });
    if (resp.status !== 204) return res.status(resp.status).send(await resp.text());
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Transfer failed" });
  }
});

router.post("/play", async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).send("No session");
    const { uris, position_ms } = req.body || {};
    if (!uris || !Array.isArray(uris) || uris.length === 0) return res.status(400).send("Missing uris");
    const resp = await fetch(`${SPOTIFY_API_BASE}/me/player/play`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris, position_ms }),
    });
    if (resp.status !== 204) return res.status(resp.status).send(await resp.text());
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Play failed" });
  }
});

export default router;

