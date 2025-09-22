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
		<div className="min-h-screen">
			<div className="mx-auto max-w-6xl px-6 py-10 sm:py-16">
				{/* Hero */}
				<section className="hero-glow rounded-3xl p-8 sm:p-12 border border-white/10">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
						<div className="space-y-5">
							<div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-white/80">
								<span className="h-2 w-2 rounded-full bg-[var(--spotify-green)]" />
								Live Auto‑DJ
							</div>
							<h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">
								Mix Spotify like a pro — instantly.
							</h1>
							<p className="text-white/80 text-base sm:text-lg max-w-prose">
								AI transitions, tempo/key matching, and gorgeous visuals. Log in with Spotify and let DJAi craft seamless blends.
							</p>
							<div className="flex flex-wrap items-center gap-3">
								<a href={loginHref} className="button-spotify rounded-full px-6 py-3 text-sm font-semibold shadow-[0_10px_30px_rgba(29,185,84,0.35)]">
									Login with Spotify
								</a>
								<button
									className="rounded-full border border-white/20 px-5 py-3 text-sm text-white/90 hover:bg-white/5"
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
							<div className="flex gap-3 pt-2 text-xs text-white/60">
								<div className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-white/50" /> Beat‑sync</div>
								<div className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-white/50" /> Harmonic mixing</div>
								<div className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-white/50" /> Smart crossfades</div>
							</div>
						</div>
						{/* Visual card */}
						<div className="card-glass rounded-2xl p-6 md:p-8">
							<div className="space-y-4">
								<div className="h-24 rounded-lg bg-gradient-to-r from-white/10 to-white/5" />
								<div className="grid grid-cols-3 gap-2">
									<div className="h-16 rounded bg-white/10" />
									<div className="h-16 rounded bg-white/10" />
									<div className="h-16 rounded bg-white/10" />
								</div>
								<div className="h-10 rounded bg-white/10" />
							</div>
						</div>
					</div>
				</section>

				{/* Authenticated controls */}
				{user && (
					<section className="mt-10 space-y-6">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								{user.images?.[0]?.url ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img src={user.images[0].url} alt="avatar" className="w-10 h-10 rounded-full" />
								) : null}
								<div>
									<div className="text-sm text-white/60">Logged in as</div>
									<div className="font-medium">{user.display_name || "Spotify User"}</div>
								</div>
							</div>
							<button onClick={handleLoadPlaylists} className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/5">
								Load Playlists
							</button>
						</div>

						{error ? <div className="text-red-400 text-sm">{error}</div> : null}
						{loading && <div className="text-sm text-white/80">Loading…</div>}

						{playlists && (
							<div>
								<h2 className="text-lg font-semibold mb-3">Your Playlists</h2>
								<ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
									{playlists.map((pl) => (
										<li key={pl.id} className="card-glass rounded-xl p-3 hover:shadow-[0_6px_18px_rgba(0,0,0,0.25)] transition">
											{pl.images?.[0]?.url ? (
												// eslint-disable-next-line @next/next/no-img-element
												<img src={pl.images[0].url} alt="cover" className="w-full h-32 object-cover rounded" />
											) : (
												<div className="w-full h-32 bg-white/10 rounded" />
											)}
											<div className="mt-2 font-medium text-sm">{pl.name}</div>
											<div className="text-xs text-white/60">{pl.tracks?.total ?? 0} tracks</div>
										</li>
									))}
								</ul>
							</div>
						)}
					</section>
				)}
			</div>
		</div>
	);
}
