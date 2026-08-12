"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FORM_LENGTH,
  buildView,
  computeCleanSheets,
  computeTable,
  computeTopScorers,
  type Deduction,
  type FormEntry,
  type LeagueView,
  type Match,
  type Score,
  type Scores,
} from "@/lib/league";
import type { PublicLeague } from "@/lib/leagues";
import { HeadToHeadTab, PlayersTab } from "./PlayerViews";
import { ActivityTab, BackupTab, DeadlineTab, WhatIfTab } from "./LeagueTools";
import { SeasonsTab } from "./SeasonsTab";
import { HallOfFameTab } from "./HallOfFame";
import { RosterTab } from "./RosterTab";

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
  | "halloffame"
  | "seasons"
  | "roster"
  | "backup";

const TABS: [Tab, string][] = [
  ["table", "Table"],
  ["fixtures", "Fixtures & Results"],
  ["scorers", "Top Scorers"],
  ["cleansheets", "Clean Sheets"],
  ["players", "Players"],
  ["h2h", "Head to Head"],
  ["deadline", "Deadline"],
  ["whatif", "What If"],
  ["activity", "Activity"],
  ["halloffame", "Hall of Fame"],
  ["seasons", "Seasons"],
  ["roster", "Roster"],
  ["backup", "Backup"],
];

const codeKey = (slug: string) => `sportknight-code-${slug}`;

export default function LeagueApp({ slug, showDirectoryLink = true }: { slug: string; showDirectoryLink?: boolean }) {
  const [tab, setTab] = useState<Tab>("table");
  const [league, setLeague] = useState<PublicLeague | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}`, { cache: "no-store" });
      if (res.status === 404) {
        setLoadError("That league does not exist.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { league: PublicLeague };
      setLeague(data.league);
      setLoadError(null);
    } catch {
      setLoadError("Could not load the league. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
    const saved = sessionStorage.getItem(codeKey(slug));
    if (saved) setCode(saved);
  }, [load, slug]);

  const view: LeagueView = useMemo(
    () => buildView(league?.players ?? [], league?.fixtures ?? []),
    [league?.players, league?.fixtures]
  );

  const scores = league?.scores ?? {};
  const deductions = league?.deductions ?? [];

  const table = useMemo(() => computeTable(view, scores, deductions), [view, scores, deductions]);
  const scorers = useMemo(() => computeTopScorers(view, scores), [view, scores]);
  const cleanSheets = useMemo(() => computeCleanSheets(view, scores), [view, scores]);

  const handleUnlock = (next: string) => {
    setCode(next);
    sessionStorage.setItem(codeKey(slug), next);
  };
  const handleLock = () => {
    setCode(null);
    sessionStorage.removeItem(codeKey(slug));
  };
  const handleCodeRejected = useCallback(() => {
    setCode(null);
    sessionStorage.removeItem(codeKey(slug));
  }, [slug]);

  const openProfile = useCallback((player: string) => {
    setSelectedPlayer(player);
    setTab("players");
  }, []);

  if (loading) {
    return (
      <main className="shell">
        <p className="banner">Loading league…</p>
      </main>
    );
  }

  if (!league) {
    return (
      <main className="shell">
        <p className="banner error">{loadError ?? "League not found."}</p>
        <p>
          <Link href="/leagues" className="linkish">
            ← All leagues
          </Link>
        </p>
      </main>
    );
  }

  const playedCount = Object.values(scores).filter((s) => !s.noShow).length;
  const noShowCount = Object.values(scores).filter((s) => s.noShow).length;
  const total = view.allMatches.length;
  const needsSetup = total === 0;

  return (
    <main className="shell">
      <header className="hero">
        <div className="hero-top">
          <h1>
            <span className="crest">⚔️</span> {league.name}
          </h1>
          <div className="hero-actions">
            {showDirectoryLink && (
              <Link href="/leagues" className="admin-btn">
                All leagues
              </Link>
            )}
            <AdminControl
              slug={slug}
              code={code}
              onUnlock={handleUnlock}
              onLock={handleLock}
            />
          </div>
        </div>
        <p className="hero-sub">
          Season {league.season} · {league.players.length} players
          {total > 0 && (
            <>
              {" "}
              · {total} matches — {playedCount} played, {total - playedCount - noShowCount} remaining
              {noShowCount > 0 && ` · ${noShowCount} no-show`}
            </>
          )}
        </p>
        <nav className="tabs" aria-label="Sections">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "tab active" : "tab"}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {loadError && <p className="banner error">{loadError}</p>}

      {needsSetup && tab !== "roster" && tab !== "backup" && tab !== "halloffame" && (
        <p className="banner">
          No fixtures yet. {code ? "Add players in the Roster tab, then generate the schedule." : "A record keeper needs to add players and generate the schedule."}
        </p>
      )}

      {tab === "table" && (
        <>
          <LeagueTable rows={table} onSelectPlayer={openProfile} />
          <DeductionsPanel
            players={league.players}
            deductions={deductions}
            slug={slug}
            code={code}
            onLeagueUpdated={setLeague}
            onCodeRejected={handleCodeRejected}
          />
        </>
      )}
      {tab === "fixtures" && (
        <Fixtures
          view={view}
          scores={scores}
          slug={slug}
          code={code}
          onLeagueUpdated={setLeague}
          onCodeRejected={handleCodeRejected}
        />
      )}
      {tab === "scorers" && <TopScorers rows={scorers} />}
      {tab === "cleansheets" && <CleanSheets rows={cleanSheets} />}
      {tab === "players" && (
        <PlayersTab
          view={view}
          scores={scores}
          deductions={deductions}
          selected={selectedPlayer}
          onSelect={setSelectedPlayer}
        />
      )}
      {tab === "h2h" && <HeadToHeadTab league={league} view={view} />}
      {tab === "deadline" && (
        <DeadlineTab
          view={view}
          scores={scores}
          window={league.window}
          slug={slug}
          code={code}
          onLeagueUpdated={setLeague}
          onCodeRejected={handleCodeRejected}
        />
      )}
      {tab === "whatif" && <WhatIfTab view={view} scores={scores} deductions={deductions} />}
      {tab === "activity" && <ActivityTab view={view} scores={scores} />}
      {tab === "halloffame" && <HallOfFameTab league={league} />}
      {tab === "seasons" && (
        <SeasonsTab
          league={league}
          view={view}
          slug={slug}
          code={code}
          onLeagueUpdated={setLeague}
          onCodeRejected={handleCodeRejected}
        />
      )}
      {tab === "roster" && (
        <RosterTab
          league={league}
          slug={slug}
          code={code}
          onLeagueUpdated={setLeague}
          onCodeRejected={handleCodeRejected}
        />
      )}
      {tab === "backup" && (
        <BackupTab
          league={league}
          view={view}
          slug={slug}
          code={code}
          onLeagueUpdated={setLeague}
          onCodeRejected={handleCodeRejected}
        />
      )}

      <footer className="footer">
        Points: win 3 · draw 1 · loss 0. Ties broken by goal difference, goals scored, then wins.
        No-show fixtures are void — no points, no stats for either player.
      </footer>
    </main>
  );
}

/* ------------------------------------------------------------ admin unlock */

function AdminControl({
  slug,
  code,
  onUnlock,
  onLock,
}: {
  slug: string;
  code: string | null;
  onUnlock: (code: string) => void;
  onLock: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (code) {
    return (
      <button className="admin-btn unlocked" onClick={onLock} title="Lock editing">
        🔓 Editing on — Lock
      </button>
    );
  }

  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${slug}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value.trim() }),
      });
      if (res.ok) {
        onUnlock(value.trim());
        setOpen(false);
        setValue("");
      } else {
        setError("Wrong code");
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
        autoFocus
        placeholder="Admin code"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Admin code"
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
      🔒 Admin
    </button>
  );
}

/* ------------------------------------------------------------------ table */

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
  if (rows.length === 0) {
    return (
      <section className="card">
        <p className="muted">No players yet.</p>
      </section>
    );
  }
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

/* ------------------------------------------------------------- deductions */

function DeductionsPanel({
  players,
  deductions,
  slug,
  code,
  onLeagueUpdated,
  onCodeRejected,
}: {
  players: string[];
  deductions: Deduction[];
  slug: string;
  code: string | null;
  onLeagueUpdated: (league: PublicLeague) => void;
  onCodeRejected: () => void;
}) {
  const [player, setPlayer] = useState(players[0] ?? "");
  const [points, setPoints] = useState("3");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!players.includes(player)) setPlayer(players[0] ?? "");
  }, [players, player]);

  const send = async (payload: Record<string, unknown>) => {
    if (busy || !code) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${slug}/deductions`, {
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
      onLeagueUpdated(data.league as PublicLeague);
      setReason("");
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  if (!code && deductions.length === 0) return null;

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
              {code && (
                <button className="mini danger" onClick={() => send({ id: d.id })} disabled={busy}>
                  Undo
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {code && players.length > 0 && (
        <form
          className="ded-form"
          onSubmit={(e) => {
            e.preventDefault();
            send({ player, points: Number(points), reason });
          }}
        >
          <select value={player} onChange={(e) => setPlayer(e.target.value)} aria-label="Player">
            {players.map((p) => (
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

/* ----------------------------------------------------------------- stats */

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

/* -------------------------------------------------------------- fixtures */

function Fixtures({
  view,
  scores,
  slug,
  code,
  onLeagueUpdated,
  onCodeRejected,
}: {
  view: LeagueView;
  scores: Scores;
  slug: string;
  code: string | null;
  onLeagueUpdated: (league: PublicLeague) => void;
  onCodeRejected: () => void;
}) {
  const firstUnfinished = useMemo(() => {
    for (const md of view.matchdays) {
      if (md.matches.some((m) => !scores[m.id])) return md.matchday;
    }
    return view.matchdays.length;
  }, [scores, view.matchdays]);

  const [selected, setSelected] = useState<number>(firstUnfinished);

  if (view.matchdays.length === 0) {
    return (
      <section className="card">
        <p className="muted">No fixtures yet.</p>
      </section>
    );
  }

  const matchday =
    view.matchdays.find((md) => md.matchday === selected) ?? view.matchdays[0];

  return (
    <section>
      <div className="md-picker" role="tablist" aria-label="Matchdays">
        {view.matchdays.map((md) => {
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
              slug={slug}
              code={code}
              onLeagueUpdated={onLeagueUpdated}
              onCodeRejected={onCodeRejected}
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
  slug,
  code,
  onLeagueUpdated,
  onCodeRejected,
}: {
  match: Match;
  score?: Score;
  slug: string;
  code: string | null;
  onLeagueUpdated: (league: PublicLeague) => void;
  onCodeRejected: () => void;
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
    if (busy || !code) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${slug}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, matchId: match.id, ...payload }),
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
      onLeagueUpdated(data.league as PublicLeague);
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

  const display = score ? (score.noShow ? "No show" : `${score.home} – ${score.away}`) : "vs";

  return (
    <li className={score ? (score.noShow ? "match noshow" : "match played") : "match"}>
      <span className="side home">{match.home}</span>
      {editing && code ? (
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

      {code && (
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
