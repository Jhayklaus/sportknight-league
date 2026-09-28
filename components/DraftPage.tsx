"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DraftSummary } from "@/lib/draft";

interface DraftInfo {
  leagueName: string;
  slug: string;
  seasonStarted: boolean;
  preferencesRequired: number;
  competitions: { id: string; name: string; country: string; teams: number }[];
  draft: DraftSummary | null;
}

interface Result {
  name: string;
  team: string;
  competition: string;
  player: string;
}

export function DraftPage({ slug }: { slug: string }) {
  const [info, setInfo] = useState<DraftInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [picks, setPicks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}/draft`, { cache: "no-store" });
      if (res.status === 404) {
        setLoadError("That league does not exist.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setInfo((await res.json()) as DraftInfo);
      setLoadError(null);
    } catch {
      setLoadError("Could not load the draft. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const required = info?.preferencesRequired ?? 3;

  const togglePick = (id: string) => {
    setError(null);
    setPicks((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= required) return prev;
      return [...prev, id];
    });
  };

  const submit = async () => {
    if (busy) return;
    if (picks.length !== required) {
      setError(`Pick exactly ${required} leagues, in order of preference.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${slug}/draft/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, preferences: picks }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not enter the draft");
        await load();
        return;
      }
      setResult(data.entry as Result);
      await load();
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="shell">
        <p className="banner">Loading draft…</p>
      </main>
    );
  }

  if (!info) {
    return (
      <main className="shell">
        <p className="banner error">{loadError ?? "Draft not found."}</p>
      </main>
    );
  }

  const draft = info.draft;
  const closed = !draft || !draft.open || draft.full || info.seasonStarted;

  return (
    <main className="shell draft-shell">
      <header className="hero">
        <h1>
          <span className="crest">🎲</span> Team Draft
        </h1>
        <p className="hero-sub">
          {info.leagueName}
          {draft && (
            <>
              {" "}
              · {draft.taken} of {draft.maxEntries} places taken
              {draft.spotsLeft > 0 && draft.open && ` · ${draft.spotsLeft} left`}
            </>
          )}
        </p>
      </header>

      {result ? (
        <section className="card reveal">
          <p className="reveal-kicker">You drafted</p>
          <p className="reveal-team">{result.team}</p>
          <p className="reveal-comp">{result.competition}</p>
          <p className="reveal-name">
            You will appear in the table as <strong>{result.player}</strong>
          </p>
          <Link href={`/l/${slug}`} className="mini save reveal-link">
            View the league
          </Link>
        </section>
      ) : closed ? (
        <section className="card">
          <h2 className="section-title">
            {info.seasonStarted
              ? "The season has already started"
              : !draft
                ? "No draft is running"
                : draft.full
                  ? "The draft is full"
                  : "The draft is closed"}
          </h2>
          <p className="muted">
            {draft
              ? `All ${draft.taken} entries are in. Nobody else can draft a team for this league.`
              : "Ask whoever runs the league to open one."}
          </p>
        </section>
      ) : (
        <section className="card">
          <h2 className="section-title">Enter the draft</h2>
          <p className="muted">
            Put in your name, rank {required} leagues, and a club is drawn for you from them. Your
            first choice is the most likely. No two players get the same club.
          </p>

          <form
            className="draft-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label>
              Your name or nickname
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jamiu"
                maxLength={24}
                required
              />
            </label>

            <div className="pick-head">
              <span>
                Pick {required} leagues — tap in order of preference ({picks.length}/{required})
              </span>
              {picks.length > 0 && (
                <button type="button" className="mini ghost" onClick={() => setPicks([])}>
                  Clear
                </button>
              )}
            </div>

            <div className="comp-grid">
              {info.competitions.map((c) => {
                const rank = picks.indexOf(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    className={rank >= 0 ? "comp-card picked" : "comp-card"}
                    onClick={() => togglePick(c.id)}
                    aria-pressed={rank >= 0}
                  >
                    {rank >= 0 && <span className="comp-rank">{rank + 1}</span>}
                    <span className="comp-name">{c.name}</span>
                    <span className="comp-meta">
                      {c.country} · {c.teams} clubs
                    </span>
                  </button>
                );
              })}
            </div>

            <button className="mini save draft-submit" type="submit" disabled={busy}>
              {busy ? "Drawing your club…" : "Draft my team"}
            </button>
            {error && <p className="row-error">{error}</p>}
          </form>
        </section>
      )}

      {draft && draft.entries.length > 0 && (
        <section className="card">
          <h3 className="section-title">Drafted so far ({draft.entries.length})</h3>
          <ul className="draft-list">
            {draft.entries.map((e) => (
              <li key={`${e.name}-${e.team}`}>
                <span className="draft-name">{e.name}</span>
                <span className="draft-team">{e.team}</span>
                <span className="draft-comp muted">{e.competition}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="footer">
        <Link href={`/l/${slug}`} className="linkish">
          ← {info.leagueName}
        </Link>
      </footer>
    </main>
  );
}
