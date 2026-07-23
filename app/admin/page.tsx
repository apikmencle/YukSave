"use client";

import { useEffect, useState } from "react";

type Stats = {
  total: number;
  last24h: number;
  last7d: number;
  topUrls: { url: string; count: number }[];
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  // Distinguishes "we haven't checked yet" from "checked, not logged in" —
  // without this the login form would flash on screen for a split second
  // even when the person already has a valid 12h session cookie.
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  // The admin session cookie is httpOnly and lasts 12h, but until now the
  // page always started at the login form regardless — forcing a re-login
  // on every refresh even with a still-valid cookie. Probe /api/admin/stats
  // once on mount: 200 means the cookie is still good, so skip straight to
  // the dashboard with the data we already fetched.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/stats");
        if (cancelled) return;
        if (res.ok) {
          setStats(await res.json());
          setAuthed(true);
        }
      } catch {
        // No session / offline — fall through to the login form.
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Gagal login.");
        return;
      }
      setAuthed(true);
      await loadStats();
    } catch {
      setError("Gangguan koneksi.");
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    const res = await fetch("/api/admin/stats");
    if (!res.ok) {
      setError("Sesi habis, coba login lagi.");
      setAuthed(false);
      return;
    }
    setStats(await res.json());
  }

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" }).catch(() => {});
    setAuthed(false);
    setStats(null);
    setPassword("");
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-ink-soft text-sm">Memeriksa sesi...</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-surface border-2 border-ink rounded-2xl p-6"
        >
          <h1 className="font-display text-xl text-ink mb-4">
            YukSave Admin
          </h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full font-mono text-sm px-4 py-3 rounded-xl border border-tape bg-paper focus:outline-none focus:ring-2 focus:ring-rec mb-3"
          />
          {error && (
            <p className="text-sm text-rec-dark font-medium mb-3">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 rounded-xl bg-ink text-white font-semibold disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl text-ink">YukSave Admin</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg border border-ink/20 text-ink text-sm font-medium hover:bg-paper transition-colors"
        >
          Keluar
        </button>
      </div>

      {!stats && <p className="text-ink-soft">Memuat data...</p>}

      {stats && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="bg-surface border-2 border-ink rounded-xl p-4 text-center">
              <p className="text-2xl font-display text-ink">{stats.total}</p>
              <p className="text-xs text-ink-soft mt-1">Total download</p>
            </div>
            <div className="bg-surface border-2 border-ink rounded-xl p-4 text-center">
              <p className="text-2xl font-display text-ink">
                {stats.last24h}
              </p>
              <p className="text-xs text-ink-soft mt-1">24 jam terakhir</p>
            </div>
            <div className="bg-surface border-2 border-ink rounded-xl p-4 text-center">
              <p className="text-2xl font-display text-ink">{stats.last7d}</p>
              <p className="text-xs text-ink-soft mt-1">7 hari terakhir</p>
            </div>
          </div>

          <h2 className="font-display text-lg text-ink mb-3">
            Link paling sering diminta
          </h2>
          <div className="bg-surface border-2 border-ink rounded-xl divide-y divide-tape">
            {stats.topUrls.length === 0 && (
              <p className="p-4 text-sm text-ink-soft">Belum ada data.</p>
            )}
            {stats.topUrls.map((item) => (
              <div
                key={item.url}
                className="p-3 flex items-center justify-between gap-3"
              >
                <p className="text-sm font-mono text-ink truncate">
                  {item.url}
                </p>
                <span className="text-xs font-semibold text-white bg-rec rounded-full px-2 py-1 shrink-0">
                  {item.count}x
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
