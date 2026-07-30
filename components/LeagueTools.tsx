"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MATCHDAYS,
  WINDOW_HOURS,
  WINDOW_MATCHDAYS,
  computeActivity,
  computeProjection,
  computeWindowStatus,
  suggestedWindowStart,
  toCsv,
  type Deduction,
  type Hypotheticals,
  type LeagueState,
  type LeagueWindow,
  type Outcome,
  type Scores,
} from "@/lib/league";

/* ------------------------------------------------------------------ utils */

function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3600_000);
  const minutes = Math.floor((abs % 3600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3600_000)}h ago`;
  const days = Math.floor(ms / 86_400_000);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

async function postJson(
  url: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

/* ------------------------------------------------------- deadline tracker */

export function DeadlineTab({
  scores,
  window: leagueWindow,
  pin,
  onStateUpdated,
  onPinRejected,
}: {
  scores: Scores;
  window: LeagueWindow | null | undefined;
  pin: string | null;
  onStateUpdated: (state: LeagueState) => void;
  onPinRejected: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startMd, setStartMd] = useState(() => suggestedWindowStart(scores));

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const status = useMemo(
    () => computeWindowStatus(scores, leagueWindow, now),
    [scores, leagueWindow, now]
  );

  const send = async (payload: Record<string, unknown>) => {
    if (!pin || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { ok, status: code, data } = await postJson("/api/window", { pin, ...payload });
      if (code === 401) {
        setError("PIN no longer valid — unlock again");
        onPinRejected();
        return;
      }
      if (!ok) {
        setError((data.error as string) ?? "Save failed");
        return;
      }
      onStateUpdated(data as unknown as LeagueState);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  if (!status.window) {
    return (
      <section className="card">
        <h3 className="section-title">48-hour window</h3>
        <p className="muted">
          No window is running. Rule 5 gives players {WINDOW_HOURS} hours to play{" "}
          {WINDOW_MATCHDAYS} matchdays — start one to track who still owes games.
        </p>
        {pin ? (
          <div className="window-form">
            <label>
              Start at matchday
              <select value={startMd} onChange={(e) => setStartMd(Number(e.target.value))}>
                {MATCHDAYS.map((md) => (
                  <option key={md.matchday} value={md.matchday}>
                    {md.matchday}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="mini save"
              disabled={busy}
              onClick={() => send({ firstMatchday: startMd })}
            >
              {busy ? "…" : "Start window now"}
            </button>
          </div>
        ) : (
          <p className="muted">A record keeper can start one after unlocking.</p>
        )}
        {error && <p className="row-error">{error}</p>}
      </section>
    );
  }

  const remaining = status.msRemaining ?? 0;
  const pct = Math.max(
    0,
    Math.min(100, (remaining / (WINDOW_HOURS * 3600_000)) * 100)
  );

  return (
    <section className="card">
      <div className="window-head">
        <div>
          <h3 className="section-title">
            Matchdays {status.matchdays[0]}–{status.matchdays[status.matchdays.length - 1]}
          </h3>
          <p className="muted">
            {status.played} of {status.total} fixtures played
          </p>
        </div>
        <div className={status.overdue ? "countdown over" : "countdown"}>
          <span className="cd-value">{formatDuration(remaining)}</span>
          <span className="cd-label">{remaining < 0 ? "overdue" : "left"}</span>
        </div>
      </div>

      <div className="deadline-bar">
        <div
          className={status.overdue ? "deadline-fill over" : "deadline-fill"}
          style={{ width: `${status.overdue ? 100 : pct}%` }}
        />
      </div>

      {status.pending.length === 0 ? (
        <p className="all-done">✅ Every fixture in this window has been played.</p>
      ) : (
        <>
          <h4 className="sub-head">
            Who needs chasing ({status.chase.length} player
            {status.chase.length === 1 ? "" : "s"})
          </h4>
          <ul className="chase-list">
            {status.chase.map((c) => (
              <li key={c.player}>
                <span className="chase-count">{c.outstanding}</span>
                <span className="chase-name">{c.player}</span>
                <span className="chase-opps">
                  {c.opponents
                    .map((o) => `${o.home ? "vs" : "at"} ${o.opponent} (MD${o.matchday})`)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>

          <h4 className="sub-head">Outstanding fixtures ({status.pending.length})</h4>
          <ul className="pm-list">
            {status.pending.map((m) => (
              <li key={m.id} className="pm-row">
                <span className="pm-md">MD{m.matchday}</span>
                <span className="pm-opp">
                  {m.home} <span className="muted">vs</span> {m.away}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {pin && (
        <div className="window-form">
          <button
            className="mini save"
            disabled={busy}
            onClick={() =>
              send({ firstMatchday: status.window!.firstMatchday + WINDOW_MATCHDAYS })
            }
          >
            Start next window (MD{status.window.firstMatchday + WINDOW_MATCHDAYS})
          </button>
          <button className="mini ghost" disabled={busy} onClick={() => send({ clear: true })}>
            Clear window
          </button>
        </div>
      )}
      {error && <p className="row-error">{error}</p>}
    </section>
  );
}

/* --------------------------------------------------------- what-if table */

export function WhatIfTab({
  scores,
  deductions,
}: {
  scores: Scores;
  deductions: Deduction[];
}) {
  const [hypo, setHypo] = useState<Hypotheticals>({});
  const [matchday, setMatchday] = useState(() => suggestedWindowStart(scores));

  const projection = useMemo(
    () => computeProjection(scores, hypo, deductions),
    [scores, hypo, deductions]
  );

  const md = MATCHDAYS.find((m) => m.matchday === matchday) ?? MATCHDAYS[0];
  const pending = md.matches.filter((m) => !scores[m.id]);
  const setCount = Object.keys(hypo).length;

  const setOutcome = (matchId: string, outcome: Outcome) =>
    setHypo((prev) => {
      const next = { ...prev };
      if (next[matchId] === outcome) delete next[matchId];
      else next[matchId] = outcome;
      return next;
    });

  return (
    <section>
      <div className="card">
        <div className="whatif-head">
          <h3 className="section-title">What if…</h3>
          <div className="whatif-controls">
            <select value={matchday} onChange={(e) => setMatchday(Number(e.target.value))}>
              {MATCHDAYS.map((m) => (
                <option key={m.matchday} value={m.matchday}>
                  Matchday {m.matchday}
                </option>
              ))}
            </select>
            <button className="mini ghost" onClick={() => setHypo({})} disabled={setCount === 0}>
              Reset ({setCount})
            </button>
          </div>
        </div>
        <p className="muted">
          Pick imagined winners for unplayed fixtures and watch the table move. Projected games
          use a one-goal margin. Nothing here is saved.
        </p>

        {pending.length === 0 ? (
          <p className="all-done">Every fixture on this matchday is already played.</p>
        ) : (
          <ul className="whatif-list">
            {pending.map((m) => (
              <li key={m.id}>
                <button
                  className={hypo[m.id] === "H" ? "wi-side active" : "wi-side"}
                  onClick={() => setOutcome(m.id, "H")}
                >
                  {m.home}
                </button>
                <button
                  className={hypo[m.id] === "D" ? "wi-draw active" : "wi-draw"}
                  onClick={() => setOutcome(m.id, "D")}
                >
                  draw
                </button>
                <button
                  className={hypo[m.id] === "A" ? "wi-side active" : "wi-side"}
                  onClick={() => setOutcome(m.id, "A")}
                >
                  {m.away}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card whatif-table">
        <h3 className="section-title">Projected table</h3>
        <div className="table-scroll">
          <table className="league-table">
            <thead>
              <tr>
                <th className="num">#</th>
                <th className="num">±</th>
                <th className="name">Player</th>
                <th className="num">P</th>
                <th className="num">GD</th>
                <th className="num pts">Pts</th>
              </tr>
            </thead>
            <tbody>
              {projection.map((row, i) => (
                <tr key={row.player} className={i === 0 ? "leader" : ""}>
                  <td className="num pos">{i + 1}</td>
                  <td className="num">
                    {row.movement > 0 ? (
                      <span className="mv up">▲{row.movement}</span>
                    ) : row.movement < 0 ? (
                      <span className="mv down">▼{-row.movement}</span>
                    ) : (
                      <span className="mv flat">–</span>
                    )}
                  </td>
                  <td className="name">{row.player}</td>
                  <td className="num">{row.played}</td>
                  <td className="num">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                  <td className="num pts">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- activity feed */

export function ActivityTab({ scores }: { scores: Scores }) {
  const entries = useMemo(() => computeActivity(scores), [scores]);
  const timestamped = entries.filter((e) => e.at);
  const legacy = entries.filter((e) => !e.at);

  if (entries.length === 0) {
    return (
      <section className="card">
        <h3 className="section-title">Recent results</h3>
        <p className="muted">No results recorded yet.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h3 className="section-title">Recent results</h3>
      <ul className="feed">
        {timestamped.map((e) => (
          <li key={e.matchId}>
            <span className="feed-md">MD{e.matchday}</span>
            <span className="feed-teams">
              {e.home} <strong>{e.noShow ? "no show" : `${e.homeGoals}–${e.awayGoals}`}</strong>{" "}
              {e.away}
            </span>
            <span className="feed-time">{timeAgo(e.at!)}</span>
          </li>
        ))}
      </ul>

      {legacy.length > 0 && (
        <>
          <h4 className="sub-head">Logged before activity tracking ({legacy.length})</h4>
          <ul className="feed muted-feed">
            {legacy.map((e) => (
              <li key={e.matchId}>
                <span className="feed-md">MD{e.matchday}</span>
                <span className="feed-teams">
                  {e.home}{" "}
                  <strong>{e.noShow ? "no show" : `${e.homeGoals}–${e.awayGoals}`}</strong> {e.away}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* --------------------------------------------------------- export / backup */

export function BackupTab({
  state,
  pin,
  onStateUpdated,
  onPinRejected,
}: {
  state: LeagueState;
  pin: string | null;
  onStateUpdated: (state: LeagueState) => void;
  onPinRejected: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = (contents: string, filename: string, type: string) => {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    // The anchor must be in the document (Firefox/Safari ignore detached clicks),
    // and the object URL must outlive the click for the download to start.
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const resultCount = Object.keys(state.scores).length;

  const restore = async (file: File) => {
    if (!pin || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const backup = JSON.parse(await file.text());
      const { ok, status, data } = await postJson("/api/backup", { pin, backup });
      if (status === 401) {
        setError("PIN no longer valid — unlock again");
        onPinRejected();
        return;
      }
      if (!ok) {
        setError((data.error as string) ?? "Restore failed");
        return;
      }
      onStateUpdated(data as unknown as LeagueState);
      setMessage("Backup restored.");
    } catch {
      setError("That file could not be read as JSON.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h3 className="section-title">Export &amp; backup</h3>
      <p className="muted">
        {resultCount} result{resultCount === 1 ? "" : "s"} and {state.deductions.length} deduction
        {state.deductions.length === 1 ? "" : "s"} stored. Download a copy any time — keep it
        somewhere safe and the season can always be rebuilt.
      </p>

      <div className="backup-actions">
        <button
          className="mini save"
          onClick={() =>
            download(
              JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2),
              `sportknight-backup-${stamp}.json`,
              "application/json"
            )
          }
        >
          ⬇ Download JSON backup
        </button>
        <button
          className="mini"
          onClick={() => download(toCsv(state.scores), `sportknight-results-${stamp}.csv`, "text/csv")}
        >
          ⬇ Download results CSV
        </button>
      </div>

      {pin && (
        <div className="restore-box">
          <h4 className="sub-head">Restore from backup</h4>
          <p className="muted">
            Replaces every stored result and deduction with the contents of the file. Take a fresh
            download first.
          </p>
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) restore(file);
              e.target.value = "";
            }}
            aria-label="Backup file to restore"
          />
        </div>
      )}

      {message && <p className="all-done">{message}</p>}
      {error && <p className="row-error">{error}</p>}
    </section>
  );
}
