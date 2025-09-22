"use client";

import { useEffect, useState } from "react";

type SpotifyImage = { url: string; width?: number; height?: number };
type SpotifyUser = { display_name?: string; images?: SpotifyImage[] };
type SpotifyPlaylist = { id: string; name: string; images?: SpotifyImage[]; tracks?: { total: number } };

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export default function Home() {
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T;
  }

  useEffect(() => {
    (async () => {
      try {
        const me = await apiGet<SpotifyUser>("/auth/me");
        setUser(me);
      } catch {
        // not logged in
      }
    })();
  }, []);

  const handleLoadPlaylists = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ items: SpotifyPlaylist[] }>("/auth/playlists");
      setPlaylists(data.items || []);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load playlists";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loginHref = `${BACKEND_URL}/auth/login`;

  return (
    <div className="min-h-screen p-6 sm:p-10">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">DJAi — AI Auto-DJ</h1>

        {!user ? (
          <div className="flex items-center gap-3">
            <a
              href={loginHref}
              className="inline-flex items-center rounded-md bg-black text-white px-4 py-2 text-sm hover:opacity-90"
            >
              Login with Spotify
            </a>
            <button
              className="text-sm underline"
              onClick={async () => {
                try {
                  const me = await apiGet<SpotifyUser>("/auth/me");
                  setUser(me);
                } catch {}
              }}
            >
              I logged in, refresh
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {user.images?.[0]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.images[0].url} alt="avatar" className="w-10 h-10 rounded-full" />
              ) : null}
              <div>
                <div className="text-sm text-gray-500">Logged in as</div>
                <div className="font-medium">{user.display_name || "Spotify User"}</div>
              </div>
            </div>
            <button
              onClick={handleLoadPlaylists}
              className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Load Playlists
            </button>
          </div>
        )}

        {error ? <div className="text-red-600 text-sm">{error}</div> : null}

        {loading && <div className="text-sm">Loading…</div>}

        {playlists && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Your Playlists</h2>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {playlists.map((pl) => (
                <li key={pl.id} className="border rounded-md p-3 hover:shadow-sm transition">
                  {pl.images?.[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pl.images[0].url} alt="cover" className="w-full h-32 object-cover rounded" />
                  ) : (
                    <div className="w-full h-32 bg-gray-100 rounded" />
                  )}
                  <div className="mt-2 font-medium text-sm">{pl.name}</div>
                  <div className="text-xs text-gray-500">{pl.tracks?.total ?? 0} tracks</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
