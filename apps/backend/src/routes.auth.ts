import { Router } from "express";
import cookie from "cookie";
import { buildAuthorizeURL, exchangeCodeForToken, generateRandomState, refreshAccessToken, spotifyGet } from "./spotify";

const router = Router();

const COOKIE_NAME = "sp_session";

function serializeSessionCookie(session: { accessToken: string; refreshToken?: string; expiresAt: number }) {
  return cookie.serialize(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

router.get("/login", (_req, res) => {
  const state = generateRandomState();
  const url = buildAuthorizeURL(state);
  res.redirect(url);
});

router.get("/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    if (!code) return res.status(400).send("Missing code");

    const token = await exchangeCodeForToken(code);
    const expiresAt = Date.now() + token.expires_in * 1000 - 60_000; // 1 min early

    const sessionCookie = {
      accessToken: token.access_token,
      expiresAt,
      ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
    } as { accessToken: string; expiresAt: number; refreshToken?: string };

    res.setHeader("Set-Cookie", serializeSessionCookie(sessionCookie));

    res.redirect((process.env.CLIENT_ORIGIN || "http://localhost:3000") + "/");
  } catch (err: any) {
    res.status(500).send(err.message || "Auth failed");
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const cookies = cookie.parse(req.headers.cookie || "");
    const raw = cookies[COOKIE_NAME];
    if (!raw) return res.status(401).send("No session");

    const session = JSON.parse(raw);
    if (!session.refreshToken) return res.status(400).send("No refresh token");

    const token = await refreshAccessToken(session.refreshToken);
    const expiresAt = Date.now() + token.expires_in * 1000 - 60_000;

    const newSession = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || session.refreshToken,
      expiresAt,
    };

    res.setHeader("Set-Cookie", serializeSessionCookie(newSession));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Refresh failed" });
  }
});

router.post("/logout", (_req, res) => {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 })
  );
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  try {
    const cookies = cookie.parse(req.headers.cookie || "");
    const raw = cookies[COOKIE_NAME];
    if (!raw) return res.status(401).send("No session");

    const session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) return res.status(401).send("Token expired");

    const me = await spotifyGet("/me", session.accessToken);
    res.json(me);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch profile" });
  }
});

router.get("/playlists", async (req, res) => {
  try {
    const cookies = cookie.parse(req.headers.cookie || "");
    const raw = cookies[COOKIE_NAME];
    if (!raw) return res.status(401).send("No session");

    const session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) return res.status(401).send("Token expired");

    const lists = await spotifyGet("/me/playlists?limit=50", session.accessToken);
    res.json(lists);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch playlists" });
  }
});

router.get("/playlists/:playlistId/tracks", async (req, res) => {
  try {
    const cookies = cookie.parse(req.headers.cookie || "");
    const raw = cookies[COOKIE_NAME];
    if (!raw) return res.status(401).send("No session");

    const session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) return res.status(401).send("Token expired");

    const playlistId = String(req.params.playlistId || "");
    if (!playlistId) return res.status(400).send("Missing playlistId");

    const tracks = await spotifyGet(`/playlists/${playlistId}/tracks?limit=100`, session.accessToken);
    res.json(tracks);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch tracks" });
  }
});

export default router;
