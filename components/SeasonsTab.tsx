"use client";

import { useMemo, useState } from "react";
import {
  cleanSheetsFrom,
  computeTable,
  isSeasonComplete,
  scorersFrom,
  tableFrom,
  type ArchivedSeason,
  type LeagueView,
} from "@/lib/league";
import { MIN_PLAYERS, type PublicLeague } from "@/lib/leagues";

type View = "table" | "scorers" | "cleansheets" | "results";

function ArchivedSeasonView({ season }: { season: ArchivedSeason }) {
  const [view, setView] = useState<View>("table");

  const table = useMemo(
    () => tableFrom(season.players, season.results, season.deductions),
    [season]
  );
  const scorers = useMemo(() => scorersFrom(season.players, season.results), [season]);
  const cleanSheets = useMemo(() => cleanSheetsFrom(season.players, season.results), [season]);

  const champion = table[0];
  const topScorer = scorers[0];
  const bestKeeper = cleanSheets[0];
  const played = season.results.filter((r) => !r.noShow).length;
  const goals = season.results.reduce((n, r) => n + (r.noShow ? 0 : r.homeGoals + r.awayGoals), 0);

  return (
    <div>
      <div className="honours">
        <div className="honour champ">
          <span className="k">🏆 Champion</span>
          <span className="v">{champion?.player ?? "—"}</span>
          <span className="sub">{champion ? `${champion.points} pts` : ""}</span>
        </div>
        <div className="honour">
          <span className="k">⚽ Top scorer</span>
          <span className="v">{topScorer?.player ?? "—"}</span>
          <span className="sub">{topScorer ? `${topScorer.goals} goals` : ""}</span>
        </div>
        <div className="honour">
          <span className="k">🧤 Most clean sheets</span>
          <span className="v">{bestKeeper?.player ?? "—"}</span>
          <span className="sub">{bestKeeper ? `${bestKeeper.cleanSheets}` : ""}</span>
        </div>
      </div>

      <p className="muted season-meta">
        {season.players.length} players · {played} matches played · {goals} goals · ended{" "}
        {new Date(season.endedAt).toLocaleDateString()}
      </p>

      <div className="tabs sub-tabs">
        {(
          [
            ["table", "Final table"],
            ["scorers", "Top scorers"],
            ["cleansheets", "Clean sheets"],
            ["results", "All results"],
          ] as [View, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            className={view === key ? "tab active" : "tab"}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "table" && (
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
              </tr>
            </thead>
            <tbody>
              {table.map((row, i) => (
                <tr key={row.player} className={i === 0 ? "leader" : ""}>
                  <td className="num pos">{i + 1}</td>
                  <td className="name">
                    {row.player}
                    {row.deducted > 0 && <span className="ded-badge">−{row.deducted}</span>}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "scorers" && (
        <ol className="scorers">
          {scorers.map((row, i) => (
            <li key={row.player} className="scorer-row">
              <span className={`scorer-rank rank-${i + 1}`}>{i + 1}</span>
              <div className="scorer-main">
                <div className="scorer-head">
                  <span className="scorer-name">{row.player}</span>
                  <span className="scorer-goals">
                    {row.goals} goals<span className="scorer-played"> · {row.played} played</span>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {view === "cleansheets" && (
        <ol className="scorers">
          {cleanSheets.map((row, i) => (
            <li key={row.player} className="scorer-row">
              <span className={`scorer-rank rank-${i + 1}`}>{i + 1}</span>
              <div className="scorer-main">
                <div className="scorer-head">
                  <span className="scorer-name">{row.player}</span>
                  <span className="scorer-goals cs">
                    {row.cleanSheets} 🧤
                    <span className="scorer-played"> · {row.goalsAgainst} conceded</span>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {view === "results" && (
        <ul className="pm-list">
          {season.results.map((r, i) => (
            <li key={`${r.matchday}-${i}`} className="pm-row">
              <span className="pm-md">MD{r.matchday}</span>
              <span className="pm-opp">
                {r.home} <span className="muted">vs</span> {r.away}
              </span>
              <span className="pm-score">
                {r.noShow ? "no show" : `${r.homeGoals}–${r.awayGoals}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SeasonsTab({
  league,
  view,
  slug,
  code,
  onLeagueUpdated,
  onCodeRejected,
}: {
  league: PublicLeague;
  view: LeagueView;
  slug: string;
  code: string | null;
  onLeagueUpdated: (league: PublicLeague) => void;
  onCodeRejected: () => void;
}) {
  const seasons = league.seasons ?? [];
  const currentSeason = league.season ?? 1;
  const [openId, setOpenId] = useState<string | null>(seasons[seasons.length - 1]?.id ?? null);
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const standings = useMemo(
    () => computeTable(view, league.scores, league.deductions),
    [view, league.scores, league.deductions]
  );

  const complete = isSeasonComplete(view, league.scores);
  const total = view.allMatches.length;
  const playedCount = view.allMatches.filter((m) => league.scores[m.id]).length;

  // Relegation: the bottom N of the final table, but the admin can override.
  const suggested = useMemo(() => {
    const n = Math.max(0, Math.min(league.relegationCount ?? 0, Math.max(0, standings.length - MIN_PLAYERS)));
    return standings.slice(standings.length - n).map((r) => r.player);
  }, [standings, league.relegationCount]);

  const [relegated, setRelegated] = useState<string[]>([]);
  const [replacements, setReplacements] = useState<string[]>([]);
  const [newcomer, setNewcomer] = useState("");
  const [initialised, setInitialised] = useState(false);

  const openConfirm = () => {
    if (!initialised) {
      setRelegated(suggested);
      setReplacements([]);
      setInitialised(true);
    }
    setConfirming(true);
  };

  const toggleRelegated = (player: string) =>
    setRelegated((prev) =>
      prev.includes(player) ? prev.filter((p) => p !== player) : [...prev, player]
    );

  const nextRosterSize = league.players.length - relegated.length + replacements.length;

  const startNewSeason = async () => {
    if (!code || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${slug}/season`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, relegated, replacements }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setError("Code no longer valid — unlock again");
        onCodeRejected();
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Could not start a new season");
        return;
      }
      onLeagueUpdated(data.league as PublicLeague);
      setConfirming(false);
      setName("");
      setRelegated([]);
      setReplacements([]);
      setInitialised(false);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  const open = seasons.find((s) => s.id === openId) ?? null;

  return (
    <section className="card">
      <h3 className="section-title">Seasons</h3>

      <div className="season-current">
        <span className="season-chip live">Season {currentSeason} · live</span>
        <span className="muted">
          {playedCount} of {total} fixtures played
        </span>
      </div>

      {seasons.length === 0 ? (
        <p className="muted">
          No previous seasons yet. When this one finishes, it gets archived here with its final
          table, scorers, clean sheets and every result.
        </p>
      ) : (
        <>
          <div className="season-picker">
            {[...seasons].reverse().map((s) => (
              <button
                key={s.id}
                className={s.id === openId ? "season-chip active" : "season-chip"}
                onClick={() => setOpenId(s.id === openId ? null : s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
          {open && <ArchivedSeasonView season={open} />}
        </>
      )}

      {code && (
        <div className="new-season">
          <h4 className="sub-head">Start a new season</h4>
          {!complete ? (
            <>
              <button className="mini" disabled title="Every fixture must have a result first">
                🏁 Start new season
              </button>
              <p className="muted">
                Available once all {total} fixtures have a result — {total - playedCount} still
                outstanding.
              </p>
            </>
          ) : confirming ? (
            <div className="confirm-box">
              <p>
                This archives <strong>Season {currentSeason}</strong> — its table, scorers and all{" "}
                {total} results stay readable here forever — then starts Season {currentSeason + 1}{" "}
                with the roster below.
              </p>

              <input
                type="text"
                placeholder={`Name for the finished season (default "Season ${currentSeason}")`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Season name"
              />

              <h5 className="releg-head">
                Relegated ({relegated.length}
                {league.relegationCount ? ` · league setting is ${league.relegationCount}` : ""})
              </h5>
              <p className="muted">
                Bottom of the table first. Tick anyone who is leaving — the setting only suggests.
              </p>
              <ul className="releg-list">
                {[...standings].reverse().map((row, i) => (
                  <li key={row.player}>
                    <label>
                      <input
                        type="checkbox"
                        checked={relegated.includes(row.player)}
                        onChange={() => toggleRelegated(row.player)}
                      />
                      <span className="releg-pos">{standings.length - i}</span>
                      <span className="releg-name">{row.player}</span>
                      <span className="muted">{row.points} pts</span>
                    </label>
                  </li>
                ))}
              </ul>

              <h5 className="releg-head">Replacements ({replacements.length})</h5>
              <form
                className="roster-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = newcomer.trim().replace(/\s+/g, " ");
                  if (!clean) return;
                  const staying = league.players.filter((p) => !relegated.includes(p));
                  if (
                    [...staying, ...replacements].some(
                      (p) => p.toLowerCase() === clean.toLowerCase()
                    )
                  ) {
                    setError("That name is already in the new roster");
                    return;
                  }
                  setReplacements([...replacements, clean]);
                  setNewcomer("");
                  setError(null);
                }}
              >
                <input
                  type="text"
                  placeholder="New player joining"
                  value={newcomer}
                  onChange={(e) => setNewcomer(e.target.value)}
                  aria-label="New player joining"
                />
                <button className="mini" type="submit">
                  Add
                </button>
              </form>
              {replacements.length > 0 && (
                <ul className="roster-list compact">
                  {replacements.map((p) => (
                    <li key={p}>
                      <span className="roster-name">{p}</span>
                      <button
                        className="mini danger"
                        onClick={() => setReplacements(replacements.filter((x) => x !== p))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <p className="muted next-roster">
                Next season: <strong>{nextRosterSize} players</strong>
                {nextRosterSize >= MIN_PLAYERS
                  ? ` · ${nextRosterSize * (nextRosterSize - 1)} matches — fixtures are generated automatically`
                  : ` · needs at least ${MIN_PLAYERS}`}
              </p>

              <div className="confirm-actions">
                <button
                  className="mini save"
                  onClick={startNewSeason}
                  disabled={busy || nextRosterSize < MIN_PLAYERS}
                >
                  {busy ? "Archiving…" : `Archive and start Season ${currentSeason + 1}`}
                </button>
                <button className="mini ghost" onClick={() => setConfirming(false)} disabled={busy}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button className="mini save" onClick={openConfirm}>
              🏁 Start new season
            </button>
          )}
          {error && <p className="row-error">{error}</p>}
        </div>
      )}
    </section>
  );
}
