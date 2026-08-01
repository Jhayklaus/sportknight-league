"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALL_MATCHES,
  FORM_LENGTH,
  MATCHDAYS,
  PLAYERS,
  computeCleanSheets,
  computeTable,
  computeTopScorers,
  type Deduction,
  type FormEntry,
  type LeagueState,
  type Match,
  type Score,
  type Scores,
} from "@/lib/league";
import { HeadToHeadTab, PlayersTab } from "./PlayerViews";
import { ActivityTab, BackupTab, DeadlineTab, WhatIfTab } from "./LeagueTools";
import { SeasonsTab } from "./SeasonsTab";

type Tab =
  | "table"
  | "fixtures"
  | "scorers"
  | "cleansheets"
  | "players"
  | "h2h"
  | "deadline"
  | "whatif"
  | "activity"
  | "backup"
  | "seasons";

const PIN_STORAGE_KEY = "sportknight-pin";

export default function LeagueApp() {
  const [tab, setTab] = useState<Tab>("table");
  const [state, setState] = useState<LeagueState>({
    scores: {},
    deductions: [],
    window: null,
    season: 1,
    seasons: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const { scores, deductions } = state;
  const leagueWindow = state.window;

  const loadState = useCallback(async () => {
    try {
      const res = await fetch("/api/scores", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as LeagueState;
      setState({
        scores: data.scores ?? {},
        deductions: data.deductions ?? [],
        window: data.window ?? null,
        season: data.season ?? 1,
        seasons: data.seasons ?? [],
      });
      setLoadError(null);
    } catch {
      setLoadError("Could not load results. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
    const saved = sessionStorage.getItem(PIN_STORAGE_KEY);
    if (saved) setPin(saved);
  }, [loadState]);

  const table = useMemo(() => computeTable(scores, deductions), [scores, deductions]);
  const scorers = useMemo(() => computeTopScorers(scores), [scores]);
  const cleanSheets = useMemo(() => computeCleanSheets(scores), [scores]);

  const playedCount = Object.values(scores).filter((s) => !s.noShow).length;
  const noShowCount = Object.values(scores).filter((s) => s.noShow).length;

  const handleUnlock = (nextPin: string) => {
    setPin(nextPin);
    sessionStorage.setItem(PIN_STORAGE_KEY, nextPin);
  };

  const handleLock = () => {
    setPin(null);
    sessionStorage.removeItem(PIN_STORAGE_KEY);
  };

  const handlePinRejected = useCallback(() => {
    setPin(null);
    sessionStorage.removeItem(PIN_STORAGE_KEY);
  }, []);

  const openProfile = useCallback((player: string) => {
    setSelectedPlayer(player);
    setTab("players");
  }, []);

  return (
    <main className="shell">
      <header className="hero">
        <div className="hero-top">
          <h1>
            <span className="crest">⚔️</span> SportKnight League
          </h1>
          <AdminControl pin={pin} onUnlock={handleUnlock} onLock={handleLock} />
        </div>
        <p className="hero-sub">
          Season {state.season ?? 1} · {PLAYERS.length} players · {ALL_MATCHES.length} matches —{" "}
          {playedCount} played, {ALL_MATCHES.length - playedCount - noShowCount} remaining
          {noShowCount > 0 && ` · ${noShowCount} no-show`}
        </p>
        <nav className="tabs" aria-label="Sections">
          <button className={tab === "table" ? "tab active" : "tab"} onClick={() => setTab("table")}>
            Table
          </button>
          <button
            className={tab === "fixtures" ? "tab active" : "tab"}
            onClick={() => setTab("fixtures")}
          >
            Fixtures &amp; Results
          </button>
          <button
            className={tab === "scorers" ? "tab active" : "tab"}
            onClick={() => setTab("scorers")}
          >
            Top Scorers
          </button>
          <button
            className={tab === "cleansheets" ? "tab active" : "tab"}
            onClick={() => setTab("cleansheets")}
          >
            Clean Sheets
          </button>
          <button
            className={tab === "players" ? "tab active" : "tab"}
            onClick={() => setTab("players")}
          >
            Players
          </button>
          <button className={tab === "h2h" ? "tab active" : "tab"} onClick={() => setTab("h2h")}>
            Head to Head
          </button>
          <button
            className={tab === "deadline" ? "tab active" : "tab"}
            onClick={() => setTab("deadline")}
          >
            Deadline
          </button>
          <button
            className={tab === "whatif" ? "tab active" : "tab"}
            onClick={() => setTab("whatif")}
          >
            What If
          </button>
          <button
            className={tab === "activity" ? "tab active" : "tab"}
            onClick={() => setTab("activity")}
          >
            Activity
          </button>
          <button
            className={tab === "backup" ? "tab active" : "tab"}
            onClick={() => setTab("backup")}
          >
            Backup
          </button>
          <button
            className={tab === "seasons" ? "tab active" : "tab"}
            onClick={() => setTab("seasons")}
          >
            Seasons
          </button>
        </nav>
      </header>

      {loadError && <p className="banner error">{loadError}</p>}
      {loading ? (
        <p className="banner">Loading league data…</p>
      ) : (
        <>
          {tab === "table" && (
            <>
              <LeagueTable rows={table} onSelectPlayer={openProfile} />
              <DeductionsPanel
                deductions={deductions}
                pin={pin}
                onStateUpdated={setState}
                onPinRejected={handlePinRejected}
              />
            </>
          )}
          {tab === "fixtures" && (
            <Fixtures
              scores={scores}
              pin={pin}
              onStateUpdated={setState}
              onPinRejected={handlePinRejected}
            />
          )}
          {tab === "scorers" && <TopScorers rows={scorers} />}
          {tab === "cleansheets" && <CleanSheets rows={cleanSheets} />}
          {tab === "players" && (
            <PlayersTab
              scores={scores}
              deductions={deductions}
              selected={selectedPlayer}
              onSelect={setSelectedPlayer}
            />
          )}
          {tab === "h2h" && <HeadToHeadTab scores={scores} />}
          {tab === "deadline" && (
            <DeadlineTab
              scores={scores}
              window={leagueWindow}
              pin={pin}
              onStateUpdated={setState}
              onPinRejected={handlePinRejected}
            />
          )}
          {tab === "whatif" && <WhatIfTab scores={scores} deductions={deductions} />}
          {tab === "activity" && <ActivityTab scores={scores} />}
          {tab === "backup" && (
            <BackupTab
              state={state}
              pin={pin}
              onStateUpdated={setState}
              onPinRejected={handlePinRejected}
            />
          )}
          {tab === "seasons" && (
            <SeasonsTab
              state={state}
              pin={pin}
              onStateUpdated={setState}
              onPinRejected={handlePinRejected}
            />
          )}
        </>
      )}

      <footer className="footer">
        Points: win 3 · draw 1 · loss 0. Ties broken by goal difference, goals scored, then wins.
        No-show fixtures are void — no points, no stats for either player.
      </footer>
    </main>
  );
}

function AdminControl({
  pin,
  onUnlock,
  onLock,
}: {
  pin: string | null;
  onUnlock: (pin: string) => void;
  onLock: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (pin) {
    return (
      <button className="admin-btn unlocked" onClick={onLock} title="Lock score editing">
        🔓 Editing on — Lock
      </button>
    );
  }

  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value.trim() }),
      });
      if (res.ok) {
        onUnlock(value.trim());
        setOpen(false);
        setValue("");
      } else {
        setError("Wrong PIN");
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  return open ? (
    <form
      className="pin-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        placeholder="Secret PIN"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Secret PIN"
      />
      <button type="submit" disabled={busy}>
        {busy ? "…" : "Unlock"}
      </button>
      <button
        type="button"
        className="ghost"
        onClick={() => {
          setOpen(false);
          setError(null);
          setValue("");
        }}
      >
        Cancel
      </button>
      {error && <span className="pin-error">{error}</span>}
    </form>
  ) : (
    <button className="admin-btn" onClick={() => setOpen(true)}>
      🔒 Update scores
    </button>
  );
}

function FormPips({ form }: { form: FormEntry[] }) {
  if (form.length === 0) return <span className="form-empty">—</span>;
  return (
    <span className="form-pips">
      {form.map((entry, i) => (
        <span
          key={`${entry.matchday}-${i}`}
          className={`pip pip-${entry.result}`}
          title={`MD${entry.matchday} ${entry.home ? "vs" : "at"} ${entry.opponent} — ${entry.scoreFor}–${entry.scoreAgainst}`}
        >
          {entry.result}
        </span>
      ))}
    </span>
  );
}

function LeagueTable({
  rows,
  onSelectPlayer,
}: {
  rows: ReturnType<typeof computeTable>;
  onSelectPlayer: (player: string) => void;
}) {
  return (
    <section className="card">
      <div className="table-scroll">
        <table className="league-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th className="name">Player</th>
              <th className="num">P</th>
              <th className="num">W</th>
              <th className="num">D</th>
              <th className="num">L</th>
              <th className="num">GF</th>
              <th className="num">GA</th>
              <th className="num">GD</th>
              <th className="num">CS</th>
              <th className="num pts">Pts</th>
              <th className="form-col">Form</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.player} className={i === 0 ? "leader" : i < 4 ? "top-four" : ""}>
                <td className="num pos">{i + 1}</td>
                <td className="name">
                  <button className="linkish" onClick={() => onSelectPlayer(row.player)}>
                    {row.player}
                  </button>
                  {row.deducted > 0 && (
                    <span className="ded-badge" title={`${row.deducted} points deducted`}>
                      −{row.deducted}
                    </span>
                  )}
                </td>
                <td className="num">{row.played}</td>
                <td className="num">{row.won}</td>
                <td className="num">{row.drawn}</td>
                <td className="num">{row.lost}</td>
                <td className="num">{row.goalsFor}</td>
                <td className="num">{row.goalsAgainst}</td>
                <td className="num">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                <td className="num">{row.cleanSheets}</td>
                <td className="num pts">{row.points}</td>
                <td className="form-col">
                  <FormPips form={row.form} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-legend">
        CS = clean sheets · Form = last {FORM_LENGTH} games (newest last) · hover a pip for the
        result · tap a name for their profile
      </p>
    </section>
  );
}

function DeductionsPanel({
  deductions,
  pin,
  onStateUpdated,
  onPinRejected,
}: {
  deductions: Deduction[];
  pin: string | null;
  onStateUpdated: (state: LeagueState) => void;
  onPinRejected: () => void;
}) {
  const [player, setPlayer] = useState(PLAYERS[0]);
  const [points, setPoints] = useState("3");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (payload: Record<string, unknown>) => {
    if (busy || !pin) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/deductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, ...payload }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setError("PIN no longer valid — unlock again");
        onPinRejected();
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      onStateUpdated(data as LeagueState);
      setReason("");
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  if (!pin && deductions.length === 0) return null;

  return (
    <section className="card deductions">
      <h3>Point deductions</h3>
      {deductions.length === 0 ? (
        <p className="muted">No deductions yet.</p>
      ) : (
        <ul className="ded-list">
          {deductions.map((d) => (
            <li key={d.id}>
              <span className="ded-player">{d.player}</span>
              <span className="ded-points">−{d.points} pts</span>
              <span className="ded-reason">{d.reason || "no reason given"}</span>
              {pin && (
                <button className="mini danger" onClick={() => send({ id: d.id })} disabled={busy}>
                  Undo
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {pin && (
        <form
          className="ded-form"
          onSubmit={(e) => {
            e.preventDefault();
            send({ player, points: Number(points), reason });
          }}
        >
          <select value={player} onChange={(e) => setPlayer(e.target.value)} aria-label="Player">
            {PLAYERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={99}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            aria-label="Points to deduct"
          />
          <input
            type="text"
            placeholder="Reason (e.g. 3rd network cut while losing)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Reason"
          />
          <button type="submit" className="mini save" disabled={busy}>
            {busy ? "…" : "Deduct"}
          </button>
        </form>
      )}
      {error && <p className="row-error">{error}</p>}
    </section>
  );
}

function TopScorers({ rows }: { rows: ReturnType<typeof computeTopScorers> }) {
  const max = Math.max(1, ...rows.map((r) => r.goals));
  return (
    <section className="card">
      <ol className="scorers">
        {rows.map((row, i) => (
          <li key={row.player} className="scorer-row">
            <span className={`scorer-rank rank-${i + 1}`}>{i + 1}</span>
            <div className="scorer-main">
              <div className="scorer-head">
                <span className="scorer-name">{row.player}</span>
                <span className="scorer-goals">
                  {row.goals} {row.goals === 1 ? "goal" : "goals"}
                  <span className="scorer-played"> · {row.played} played</span>
                </span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(row.goals / max) * 100}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CleanSheets({ rows }: { rows: ReturnType<typeof computeCleanSheets> }) {
  const max = Math.max(1, ...rows.map((r) => r.cleanSheets));
  return (
    <section className="card">
      <ol className="scorers">
        {rows.map((row, i) => (
          <li key={row.player} className="scorer-row">
            <span className={`scorer-rank rank-${i + 1}`}>{i + 1}</span>
            <div className="scorer-main">
              <div className="scorer-head">
                <span className="scorer-name">{row.player}</span>
                <span className="scorer-goals cs">
                  {row.cleanSheets} 🧤
                  <span className="scorer-played">
                    {" "}
                    · {row.played} played · {row.goalsAgainst} conceded
                  </span>
                </span>
              </div>
              <div className="bar-track">
                <div className="bar-fill cs" style={{ width: `${(row.cleanSheets / max) * 100}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Fixtures({
  scores,
  pin,
  onStateUpdated,
  onPinRejected,
}: {
  scores: Scores;
  pin: string | null;
  onStateUpdated: (state: LeagueState) => void;
  onPinRejected: () => void;
}) {
  const firstUnfinished = useMemo(() => {
    for (const md of MATCHDAYS) {
      if (md.matches.some((m) => !scores[m.id])) return md.matchday;
    }
    return MATCHDAYS.length;
  }, [scores]);

  const [selected, setSelected] = useState<number>(firstUnfinished);

  const matchday = MATCHDAYS.find((md) => md.matchday === selected) ?? MATCHDAYS[0];

  return (
    <section>
      <div className="md-picker" role="tablist" aria-label="Matchdays">
        {MATCHDAYS.map((md) => {
          const done = md.matches.every((m) => scores[m.id]);
          const partial = !done && md.matches.some((m) => scores[m.id]);
          return (
            <button
              key={md.matchday}
              className={[
                "md-chip",
                md.matchday === selected ? "active" : "",
                done ? "done" : partial ? "partial" : "",
              ].join(" ")}
              onClick={() => setSelected(md.matchday)}
            >
              {md.matchday}
            </button>
          );
        })}
      </div>

      <div className="card">
        <div className="md-header">
          <h2>Matchday {matchday.matchday}</h2>
          {matchday.resting && <span className="resting">Resting: {matchday.resting}</span>}
        </div>
        <ul className="match-list">
          {matchday.matches.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              score={scores[m.id]}
              pin={pin}
              onStateUpdated={onStateUpdated}
              onPinRejected={onPinRejected}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

function MatchRow({
  match,
  score,
  pin,
  onStateUpdated,
  onPinRejected,
}: {
  match: Match;
  score?: Score;
  pin: string | null;
  onStateUpdated: (state: LeagueState) => void;
  onPinRejected: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [homeVal, setHomeVal] = useState("");
  const [awayVal, setAwayVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setHomeVal(score && !score.noShow ? String(score.home) : "");
    setAwayVal(score && !score.noShow ? String(score.away) : "");
    setError(null);
    setEditing(true);
  };

  const send = async (payload: Record<string, unknown>) => {
    if (busy || !pin) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, matchId: match.id, ...payload }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setError("PIN no longer valid — unlock again");
        onPinRejected();
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      onStateUpdated(data as LeagueState);
      setEditing(false);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  const saveScore = () => {
    if (homeVal.trim() === "" || awayVal.trim() === "") {
      setError("Enter both scores");
      return;
    }
    send({ home: Number(homeVal), away: Number(awayVal) });
  };

  const display = score
    ? score.noShow
      ? "No show"
      : `${score.home} – ${score.away}`
    : "vs";

  return (
    <li className={score ? (score.noShow ? "match noshow" : "match played") : "match"}>
      <span className="side home">{match.home}</span>
      {editing && pin ? (
        <span className="score-edit">
          <input
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            value={homeVal}
            onChange={(e) => setHomeVal(e.target.value)}
            aria-label={`${match.home} goals`}
          />
          <span className="dash">–</span>
          <input
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            value={awayVal}
            onChange={(e) => setAwayVal(e.target.value)}
            aria-label={`${match.away} goals`}
          />
        </span>
      ) : (
        <span className={score ? (score.noShow ? "score ns" : "score") : "score empty"}>
          {display}
        </span>
      )}
      <span className="side away">{match.away}</span>

      {pin && (
        <span className="row-actions">
          {editing ? (
            <>
              <button className="mini save" onClick={saveScore} disabled={busy}>
                {busy ? "…" : "Save"}
              </button>
              <button
                className="mini"
                onClick={() => send({ noShow: true })}
                disabled={busy}
                title="Neither player showed up — 0–0, no points for either (Rule 5)"
              >
                No show
              </button>
              <button className="mini ghost" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </button>
              {score && (
                <button
                  className="mini danger"
                  onClick={() => send({ home: null, away: null })}
                  disabled={busy}
                  title="Remove this result"
                >
                  Clear
                </button>
              )}
            </>
          ) : (
            <button className="mini" onClick={startEdit}>
              {score ? "Edit" : "Add score"}
            </button>
          )}
        </span>
      )}
      {error && <span className="row-error">{error}</span>}
    </li>
  );
}
