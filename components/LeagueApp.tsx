"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MATCHDAYS,
  computeTable,
  computeTopScorers,
  type Match,
  type Scores,
} from "@/lib/league";

type Tab = "table" | "fixtures" | "scorers";

const PIN_STORAGE_KEY = "sportknight-pin";

export default function LeagueApp() {
  const [tab, setTab] = useState<Tab>("table");
  const [scores, setScores] = useState<Scores>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);

  const loadScores = useCallback(async () => {
    try {
      const res = await fetch("/api/scores", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { scores: Scores };
      setScores(data.scores ?? {});
      setLoadError(null);
    } catch {
      setLoadError("Could not load results. Pull to refresh or try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScores();
    const saved = sessionStorage.getItem(PIN_STORAGE_KEY);
    if (saved) setPin(saved);
  }, [loadScores]);

  const table = useMemo(() => computeTable(scores), [scores]);
  const scorers = useMemo(() => computeTopScorers(scores), [scores]);
  const playedCount = Object.keys(scores).length;

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
          13 players · home &amp; away · 156 matches — {playedCount} played,{" "}
          {156 - playedCount} remaining
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
        </nav>
      </header>

      {loadError && <p className="banner error">{loadError}</p>}
      {loading ? (
        <p className="banner">Loading league data…</p>
      ) : (
        <>
          {tab === "table" && <LeagueTable rows={table} />}
          {tab === "fixtures" && (
            <Fixtures
              scores={scores}
              pin={pin}
              onScoresUpdated={setScores}
              onPinRejected={handlePinRejected}
            />
          )}
          {tab === "scorers" && <TopScorers rows={scorers} />}
        </>
      )}

      <footer className="footer">
        Points: win 3 · draw 1 · loss 0. Ties broken by goal difference, then goals scored.
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

function LeagueTable({ rows }: { rows: ReturnType<typeof computeTable> }) {
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
              <th className="num pts">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.player} className={i === 0 ? "leader" : i < 4 ? "top-four" : ""}>
                <td className="num pos">{i + 1}</td>
                <td className="name">{row.player}</td>
                <td className="num">{row.played}</td>
                <td className="num">{row.won}</td>
                <td className="num">{row.drawn}</td>
                <td className="num">{row.lost}</td>
                <td className="num">{row.goalsFor}</td>
                <td className="num">{row.goalsAgainst}</td>
                <td className="num">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                <td className="num pts">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function Fixtures({
  scores,
  pin,
  onScoresUpdated,
  onPinRejected,
}: {
  scores: Scores;
  pin: string | null;
  onScoresUpdated: (scores: Scores) => void;
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
          <span className="resting">Resting: {matchday.resting}</span>
        </div>
        <ul className="match-list">
          {matchday.matches.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              score={scores[m.id]}
              pin={pin}
              onScoresUpdated={onScoresUpdated}
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
  onScoresUpdated,
  onPinRejected,
}: {
  match: Match;
  score?: { home: number; away: number };
  pin: string | null;
  onScoresUpdated: (scores: Scores) => void;
  onPinRejected: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [homeVal, setHomeVal] = useState("");
  const [awayVal, setAwayVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setHomeVal(score ? String(score.home) : "");
    setAwayVal(score ? String(score.away) : "");
    setError(null);
    setEditing(true);
  };

  const save = async (clear = false) => {
    if (busy || !pin) return;
    const home = clear ? null : Number(homeVal);
    const away = clear ? null : Number(awayVal);
    if (!clear && (homeVal.trim() === "" || awayVal.trim() === "" || Number.isNaN(home) || Number.isNaN(away))) {
      setError("Enter both scores");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, matchId: match.id, home, away }),
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
      onScoresUpdated(data.scores as Scores);
      setEditing(false);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={score ? "match played" : "match"}>
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
        <span className={score ? "score" : "score empty"}>
          {score ? `${score.home} – ${score.away}` : "vs"}
        </span>
      )}
      <span className="side away">{match.away}</span>

      {pin && (
        <span className="row-actions">
          {editing ? (
            <>
              <button className="mini save" onClick={() => save()} disabled={busy}>
                {busy ? "…" : "Save"}
              </button>
              <button className="mini ghost" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </button>
              {score && (
                <button
                  className="mini danger"
                  onClick={() => save(true)}
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
