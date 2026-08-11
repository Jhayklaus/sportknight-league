"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MIN_PLAYERS, type LeagueSummary, type PublicLeague } from "@/lib/leagues";

export function LeagueDirectory() {
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [gated, setGated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/leagues", { cache: "no-store" });
      const data = (await res.json()) as { leagues: LeagueSummary[]; gated: boolean };
      setLeagues(data.leagues ?? []);
      setGated(Boolean(data.gated));
    } catch {
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="shell">
      <header className="hero">
        <div className="hero-top">
          <h1>
            <span className="crest">⚔️</span> Leagues
          </h1>
          <button className="admin-btn unlocked" onClick={() => setCreating((v) => !v)}>
            {creating ? "Close" : "+ Create a league"}
          </button>
        </div>
        <p className="hero-sub">
          Run your own home &amp; away league — table, fixtures, stats, seasons and a hall of fame.
        </p>
      </header>

      {creating && <CreateLeagueForm gated={gated} onCreated={load} />}

      {loading ? (
        <p className="banner">Loading leagues…</p>
      ) : leagues.length === 0 ? (
        <p className="banner">No leagues yet. Create the first one.</p>
      ) : (
        <section className="card">
          <ul className="league-list">
            {leagues.map((l) => (
              <li key={l.slug}>
                <Link href={`/l/${l.slug}`} className="league-link">
                  <span className="league-name">{l.name}</span>
                  <span className="muted">
                    Season {l.season} · {l.players} players
                    {l.total > 0 ? ` · ${l.played}/${l.total} played` : " · no fixtures yet"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function CreateLeagueForm({ gated, onCreated }: { gated: boolean; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [creationCode, setCreationCode] = useState("");
  const [playersText, setPlayersText] = useState("");
  const [relegation, setRelegation] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<PublicLeague | null>(null);

  const players = playersText
    .split(/[\n,]/)
    .map((p) => p.trim().replace(/\s+/g, " "))
    .filter(Boolean);

  const submit = async () => {
    if (busy) return;
    if (adminCode !== confirmCode) {
      setError("The two admin codes do not match");
      return;
    }
    if (adminCode.trim().length < 4) {
      setError("Admin code must be at least 4 characters");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          adminCode,
          players,
          creationCode: creationCode || undefined,
          relegationCount: Number(relegation) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create the league");
        return;
      }
      setCreated(data.league as PublicLeague);
      onCreated();
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <section className="card create-done">
        <h3 className="section-title">🎉 {created.name} is ready</h3>
        <p>
          Its home is{" "}
          <Link href={`/l/${created.slug}`} className="linkish">
            /l/{created.slug}
          </Link>
          . Share that link with your players.
        </p>
        <p className="muted">
          Keep your admin code safe — it is the only way to record scores, and it is stored hashed,
          so it cannot be recovered if you lose it.
        </p>
        {created.fixtures.length === 0 && (
          <p className="muted">
            Add at least {MIN_PLAYERS} players in the league&apos;s Roster tab, then generate the
            fixtures.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="card">
      <h3 className="section-title">Create a league</h3>
      <form
        className="create-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label>
          League name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sunday Night eFootball"
            required
          />
        </label>

        <div className="create-row">
          <label>
            Admin code
            <input
              type="password"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              placeholder="At least 4 characters"
              required
            />
          </label>
          <label>
            Confirm admin code
            <input
              type="password"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              required
            />
          </label>
        </div>
        <p className="muted">
          Anyone can view the league. Only people with this code can record scores, deduct points
          or start a new season.
        </p>

        <label>
          Players (one per line, or comma separated)
          <textarea
            rows={7}
            value={playersText}
            onChange={(e) => setPlayersText(e.target.value)}
            placeholder={"Diamonte\nJamiu\nMimi\nSalo"}
          />
        </label>
        <p className="muted">
          {players.length} player{players.length === 1 ? "" : "s"}
          {players.length >= MIN_PLAYERS
            ? ` · ${players.length * (players.length - 1)} matches over ${
                players.length % 2 === 0 ? 2 * (players.length - 1) : 2 * players.length
              } matchdays — fixtures are generated for you`
            : ` · add at least ${MIN_PLAYERS} (you can also add them later)`}
        </p>

        <label className="narrow">
          Players relegated each season
          <input
            type="number"
            min={0}
            value={relegation}
            onChange={(e) => setRelegation(e.target.value)}
          />
        </label>

        {gated && (
          <label>
            Site creation code
            <input
              type="password"
              value={creationCode}
              onChange={(e) => setCreationCode(e.target.value)}
              placeholder="Required by this site"
              required
            />
          </label>
        )}

        <button className="mini save" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create league"}
        </button>
        {error && <p className="row-error">{error}</p>}
      </form>
    </section>
  );
}
