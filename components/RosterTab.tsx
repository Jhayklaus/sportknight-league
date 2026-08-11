"use client";

import { useState } from "react";
import { MAX_PLAYERS, MIN_PLAYERS, type PublicLeague } from "@/lib/leagues";

export function RosterTab({
  league,
  slug,
  code,
  onLeagueUpdated,
  onCodeRejected,
}: {
  league: PublicLeague;
  slug: string;
  code: string | null;
  onLeagueUpdated: (league: PublicLeague) => void;
  onCodeRejected: () => void;
}) {
  const [draft, setDraft] = useState<string[]>(league.players);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState("");
  const [relegation, setRelegation] = useState(String(league.relegationCount ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const hasResults = Object.keys(league.scores).length > 0;
  const locked = hasResults;

  const send = async (payload: Record<string, unknown>, ok?: string) => {
    if (!code || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/leagues/${slug}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, ...payload }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setError("Code no longer valid — unlock again");
        onCodeRejected();
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      const updated = data.league as PublicLeague;
      onLeagueUpdated(updated);
      setDraft(updated.players);
      if (ok) setMessage(ok);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  if (!code) {
    return (
      <section className="card">
        <h3 className="section-title">Roster</h3>
        <ul className="roster-list">
          {league.players.map((p) => (
            <li key={p}>
              <span className="roster-name">{p}</span>
            </li>
          ))}
        </ul>
        <p className="muted">
          {league.players.length} players. Unlock with the admin code to make changes.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h3 className="section-title">Roster</h3>

      {locked && (
        <p className="banner warn">
          Results have been recorded this season, so players cannot be added or removed — that
          would invalidate the fixtures already played. Renaming is still fine. To change who is
          in the league, finish the season and use the relegation step in the Seasons tab.
        </p>
      )}

      <ul className="roster-list">
        {draft.map((p) => (
          <li key={p}>
            {renaming === p ? (
              <form
                className="rename-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  send({ action: "rename", from: p, to: renameTo }, `Renamed to ${renameTo}`);
                  setRenaming(null);
                }}
              >
                <input
                  autoFocus
                  value={renameTo}
                  onChange={(e) => setRenameTo(e.target.value)}
                  aria-label={`New name for ${p}`}
                />
                <button className="mini save" type="submit" disabled={busy}>
                  Save
                </button>
                <button className="mini ghost" type="button" onClick={() => setRenaming(null)}>
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <span className="roster-name">{p}</span>
                <button
                  className="mini"
                  onClick={() => {
                    setRenaming(p);
                    setRenameTo(p);
                  }}
                >
                  Rename
                </button>
                {!locked && (
                  <button
                    className="mini danger"
                    onClick={() => setDraft(draft.filter((x) => x !== p))}
                  >
                    Remove
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {!locked && (
        <>
          <form
            className="roster-add"
            onSubmit={(e) => {
              e.preventDefault();
              const clean = newName.trim().replace(/\s+/g, " ");
              if (!clean) return;
              if (draft.some((p) => p.toLowerCase() === clean.toLowerCase())) {
                setError("That name is already in the roster");
                return;
              }
              if (draft.length >= MAX_PLAYERS) {
                setError(`At most ${MAX_PLAYERS} players`);
                return;
              }
              setDraft([...draft, clean]);
              setNewName("");
              setError(null);
            }}
          >
            <input
              type="text"
              placeholder="Add a player"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-label="New player name"
            />
            <button className="mini" type="submit">
              Add
            </button>
          </form>

          <div className="roster-actions">
            <button
              className="mini save"
              disabled={busy || draft.length < MIN_PLAYERS}
              onClick={() =>
                send(
                  { action: "setPlayers", players: draft, generate: true },
                  `Saved ${draft.length} players and generated the fixtures.`
                )
              }
              title={
                draft.length < MIN_PLAYERS ? `At least ${MIN_PLAYERS} players are needed` : undefined
              }
            >
              {league.fixtures.length ? "Save roster & regenerate fixtures" : "Save roster & generate fixtures"}
            </button>
            <button
              className="mini ghost"
              disabled={busy}
              onClick={() => {
                setDraft(league.players);
                setError(null);
                setMessage(null);
              }}
            >
              Reset
            </button>
          </div>
          <p className="muted">
            {draft.length} player{draft.length === 1 ? "" : "s"} in the draft ·{" "}
            {draft.length >= MIN_PLAYERS
              ? `${draft.length * (draft.length - 1)} matches over ${
                  draft.length % 2 === 0 ? 2 * (draft.length - 1) : 2 * draft.length
                } matchdays`
              : `add at least ${MIN_PLAYERS}`}
          </p>
        </>
      )}

      <div className="relegation-setting">
        <h4 className="sub-head">Relegation</h4>
        <p className="muted">
          How many players drop out when a season ends. They can be swapped for new entries during
          the season rollover.
        </p>
        <form
          className="window-form"
          onSubmit={(e) => {
            e.preventDefault();
            send(
              { action: "setRelegation", count: Number(relegation) },
              `Relegation set to ${relegation} player(s) per season.`
            );
          }}
        >
          <label>
            Players relegated per season
            <input
              type="number"
              min={0}
              max={Math.max(0, league.players.length - MIN_PLAYERS)}
              value={relegation}
              onChange={(e) => setRelegation(e.target.value)}
              aria-label="Players relegated per season"
            />
          </label>
          <button className="mini save" type="submit" disabled={busy}>
            Save
          </button>
        </form>
      </div>

      {message && <p className="all-done">{message}</p>}
      {error && <p className="row-error">{error}</p>}
    </section>
  );
}
