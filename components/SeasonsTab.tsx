"use client";

import { useMemo, useState } from "react";
import {
  ALL_MATCHES,
  cleanSheetsFrom,
  isSeasonComplete,
  scorersFrom,
  tableFrom,
  type ArchivedSeason,
  type LeagueState,
} from "@/lib/league";

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
  const seasons = state.seasons ?? [];
  const currentSeason = state.season ?? 1;
  const [openId, setOpenId] = useState<string | null>(seasons[seasons.length - 1]?.id ?? null);
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = isSeasonComplete(state.scores);
  const playedCount = ALL_MATCHES.filter((m) => state.scores[m.id]).length;
  const open = seasons.find((s) => s.id === openId) ?? null;

  const startNewSeason = async () => {
    if (!pin || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, name }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setError("PIN no longer valid — unlock again");
        onPinRejected();
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Could not start a new season");
        return;
      }
      onStateUpdated(data as LeagueState);
      setConfirming(false);
      setName("");
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h3 className="section-title">Seasons</h3>

      <div className="season-current">
        <span className="season-chip live">Season {currentSeason} · live</span>
        <span className="muted">
          {playedCount} of {ALL_MATCHES.length} fixtures played
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

      {pin && (
        <div className="new-season">
          <h4 className="sub-head">Start a new season</h4>
          {complete ? (
            confirming ? (
              <div className="confirm-box">
                <p>
                  This archives <strong>Season {currentSeason}</strong> — its table, scorers and
                  all {ALL_MATCHES.length} results stay readable here forever — then clears the
                  live season so Season {currentSeason + 1} starts from zero.
                </p>
                <input
                  type="text"
                  placeholder={`Name for the finished season (default "Season ${currentSeason}")`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="Season name"
                />
                <div className="confirm-actions">
                  <button className="mini save" onClick={startNewSeason} disabled={busy}>
                    {busy ? "Archiving…" : `Yes, archive and start Season ${currentSeason + 1}`}
                  </button>
                  <button
                    className="mini ghost"
                    onClick={() => setConfirming(false)}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button className="mini save" onClick={() => setConfirming(true)}>
                🏁 Start new season
              </button>
            )
          ) : (
            <>
              <button className="mini" disabled title="Every fixture must have a result first">
                🏁 Start new season
              </button>
              <p className="muted">
                Available once all {ALL_MATCHES.length} fixtures have a result —{" "}
                {ALL_MATCHES.length - playedCount} still outstanding.
              </p>
            </>
          )}
          {error && <p className="row-error">{error}</p>}
        </div>
      )}
    </section>
  );
}
