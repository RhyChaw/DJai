"use client";

import { useEffect, useMemo, useState } from "react";

type SpotifyImage = { url: string; width?: number; height?: number };
type SpotifyUser = { display_name?: string; images?: SpotifyImage[] };

type SpotifyArtist = { name: string };
type SpotifyAlbum = { images?: SpotifyImage[] };

type SpotifyTrack = {
	id: string;
	name: string;
	artists: SpotifyArtist[];
	album?: SpotifyAlbum;
	duration_ms: number;
	preview_url?: string | null;
};

type SpotifyPlaylist = { id: string; name: string; images?: SpotifyImage[]; tracks?: { total: number } };

type PlaylistTrack = {
	id: string;
	name: string;
	artists: string;
	imageUrl?: string;
	duration_ms: number;
	previewUrl?: string;
};

type AudioAnalysis = {
	sections?: Array<{ start: number }>;
	beats?: unknown[];
};

type AudioFeatures = {
	tempo?: number;
	key?: number;
};

type TransitionPlan = {
	tempoRatio: number;
	strategy: string;
	from: { start: number; duration: number };
	to: { start: number; duration: number };
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export default function Home() {
	const [user, setUser] = useState<SpotifyUser | null>(null);
	const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [tracks, setTracks] = useState<PlaylistTrack[] | null>(null);
	const [fromTrack, setFromTrack] = useState<PlaylistTrack | null>(null);
	const [toTrack, setToTrack] = useState<PlaylistTrack | null>(null);
	const [plan, setPlan] = useState<TransitionPlan | null>(null);
	const [planning, setPlanning] = useState(false);
	const [exporting, setExporting] = useState(false);

	async function apiGet<T>(path: string): Promise<T> {
		const res = await fetch(`${BACKEND_URL}${path}`, {
			credentials: "include",
		});
		if (!res.ok) throw new Error(await res.text());
		return (await res.json()) as T;
	}

	async function apiPost<T>(path: string, body: unknown): Promise<T> {
		const res = await fetch(`${BACKEND_URL}${path}`, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
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

	const handleOpenPlaylist = async (playlistId: string) => {
		setTracks(null);
		setFromTrack(null);
		setToTrack(null);
		setPlan(null);
		setLoading(true);
		setError(null);
		try {
			const data = await apiGet<{ items: Array<{ track: SpotifyTrack | null }> }>(`/auth/playlists/${playlistId}/tracks`);
			const mapped: PlaylistTrack[] = (data.items || [])
				.map((it: { track: SpotifyTrack | null }) => it.track)
				.filter((t: SpotifyTrack | null): t is SpotifyTrack => Boolean(t && t.id))
				.map((t: SpotifyTrack) => ({
					id: String(t.id),
					name: String(t.name),
					artists: (t.artists || []).map((a: SpotifyArtist) => a.name).join(", "),
					imageUrl: t.album?.images?.[0]?.url,
					duration_ms: Number(t.duration_ms || 0),
					previewUrl: t.preview_url || undefined,
				}));
			setTracks(mapped);
		} catch (e) {
			const message = e instanceof Error ? e.message : "Failed to load tracks";
			setError(message);
		} finally {
			setLoading(false);
		}
	};

	const canPlan = !!fromTrack && !!toTrack;
	const canExport = !!fromTrack?.previewUrl && !!toTrack?.previewUrl;

	const handlePlan = async () => {
		if (!fromTrack || !toTrack) return;
		setPlanning(true);
		setError(null);
		setPlan(null);
		try {
			const fromAnalysis = await apiGet<{ analysis: AudioAnalysis; features: AudioFeatures }>(`/mix/analysis?trackId=${encodeURIComponent(fromTrack.id)}`);
			const toAnalysis = await apiGet<{ analysis: AudioAnalysis; features: AudioFeatures }>(`/mix/analysis?trackId=${encodeURIComponent(toTrack.id)}`);

			const payload = {
				from: {
					...fromAnalysis.analysis,
					...fromAnalysis.features,
					duration_ms: fromTrack.duration_ms,
				},
				to: {
					...toAnalysis.analysis,
					...toAnalysis.features,
				},
			};
			const planned = await apiPost<TransitionPlan>("/mix/plan", payload);
			setPlan(planned);
		} catch (e) {
			const message = e instanceof Error ? e.message : "Failed to plan transition";
			setError(message);
		} finally {
			setPlanning(false);
		}
	};

	const handleExport = async () => {
		if (!fromTrack?.previewUrl || !toTrack?.previewUrl) return;
		setExporting(true);
		setError(null);
		try {
			const crossfadeSec = 8;
			const body = {
				from: { url: fromTrack.previewUrl, startSec: 15 },
				to: { url: toTrack.previewUrl, startSec: 0 },
				crossfadeSec,
			};
			const resp = await fetch(`${BACKEND_URL}/mix/offline-mix`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			if (!resp.ok) throw new Error(await resp.text());
			const blob = await resp.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${fromTrack.name}__${toTrack.name}_mix.wav`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (e) {
			const message = e instanceof Error ? e.message : "Failed to export mix";
			setError(message);
		} finally {
			setExporting(false);
		}
	};

	const loginHref = `${BACKEND_URL}/auth/login`;

	const crossfadeView = useMemo(() => {
		if (!plan || !fromTrack || !toTrack) return null;
		const total = plan.from.duration + plan.to.start + plan.to.duration;
		const scale = (s: number) => (total > 0 ? Math.max(2, (s / total) * 100) : 0);
		const fromLead = Math.max(0, plan.from.start);
		const fromBar = scale(plan.from.duration);
		const toLead = Math.max(0, plan.to.start);
		const toBar = scale(plan.to.duration);
		return (
			<div className="mt-6">
				<div className="text-sm text-white/70 flex items-center gap-4">
					<div>
						<span className="text-white/90 font-medium">Tempo ratio:</span> {plan.tempoRatio.toFixed(2)}x
					</div>
					<div className="hidden sm:block">Strategy: {plan.strategy}</div>
				</div>
				<div className="mt-3 space-y-2">
					<div className="h-3 w-full rounded bg-white/10 relative overflow-hidden">
						<div className="absolute top-0 bottom-0 left-0 bg-[var(--spotify-green)]/80" style={{ width: `${fromBar}%`, marginLeft: `${scale(fromLead)}%` }} />
					</div>
					<div className="h-3 w-full rounded bg-white/10 relative overflow-hidden">
						<div className="absolute top-0 bottom-0 left-0 bg-white/70" style={{ width: `${toBar}%`, marginLeft: `${scale(toLead)}%` }} />
					</div>
				</div>
			</div>
		);
	}, [plan, fromTrack, toTrack]);

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
										<li
											key={pl.id}
											className="card-glass rounded-xl p-3 hover:shadow-[0_6px_18px_rgba(0,0,0,0.25)] transition cursor-pointer"
											onClick={() => handleOpenPlaylist(pl.id)}
										>
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

						{tracks && (
							<div className="mt-8">
								<h3 className="text-lg font-semibold mb-3">Select two tracks</h3>
								<ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
									{tracks.map((t) => {
										const isFrom = fromTrack?.id === t.id;
										const isTo = toTrack?.id === t.id;
										return (
											<li
												key={t.id}
												className={`rounded-xl p-3 border transition cursor-pointer ${
													isFrom
														? "border-[var(--spotify-green)] bg-[var(--spotify-green)]/10"
													: isTo
														? "border-white/40 bg-white/5"
														: "border-white/15 bg-white/0 hover:bg-white/5"
												}`}
												onClick={() => {
													if (!fromTrack || isFrom) {
														setFromTrack(isFrom ? null : t);
														setPlan(null);
														return;
													}
													if (!toTrack || isTo) {
														setToTrack(isTo ? null : t);
														setPlan(null);
														return;
													}
												}}
											>
												{t.imageUrl ? (
													// eslint-disable-next-line @next/next/no-img-element
													<img src={t.imageUrl} alt="cover" className="w-full h-32 object-cover rounded" />
												) : (
													<div className="w-full h-32 bg-white/10 rounded" />
												)}
												<div className="mt-2 font-medium text-sm line-clamp-1">{t.name}</div>
												<div className="text-xs text-white/60 line-clamp-1">{t.artists}</div>
											</li>
									);
									})}
								</ul>

								<div className="mt-5 flex items-center gap-3">
									<button
										disabled={!canPlan || planning}
										onClick={handlePlan}
										className={`rounded-full px-5 py-2 text-sm font-medium ${
											canPlan && !planning ? "button-spotify" : "bg-white/10 text-white/60 cursor-not-allowed"
										}`}
									>
										{planning ? "Planning…" : "Plan transition"}
									</button>
									<button
										disabled={!canExport || exporting}
										onClick={handleExport}
										className={`rounded-full px-5 py-2 text-sm font-medium border ${
											canExport && !exporting ? "border-white/20 hover:bg-white/5" : "border-white/10 text-white/60 cursor-not-allowed"
										}`}
									>
										{exporting ? "Exporting…" : "Export 30s Preview Mix"}
									</button>
								</div>

								{crossfadeView}
							</div>
						)}
					</section>
				)}
			</div>
		</div>
	);
}
