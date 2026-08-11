"use client";

import { useMemo, useState } from "react";
import {
  computeHeadToHead,
  computePlayerProfile,
  type Deduction,
  type FormResult,
  type PlayerMatch,
  type LeagueView,
  type PlayerProfile,
  type Scores,
  type SplitStats,
} from "@/lib/league";

function ResultPip({ result, title }: { result: FormResult; title?: string }) {
  return (
    <span className={`pip pip-${result}`} title={title}>
      {result}
    </span>
  );
}

function MatchLine({ match, showVenue = true }: { match: PlayerMatch; showVenue?: boolean }) {
  const scored = !match.noShow && match.result !== "N";
  return (
    <li className="pm-row">
      <span className="pm-md">MD{match.matchday}</span>
      {showVenue && <span className={`pm-venue ${match.home ? "h" : "a"}`}>{match.home ? "H" : "A"}</span>}
      <span className="pm-opp">{match.opponent}</span>
      <span className="pm-score">
        {match.noShow ? "no show" : scored ? `${match.goalsFor}–${match.goalsAgainst}` : "—"}
      </span>
      {scored ? <ResultPip result={match.result} /> : <span className="pip pip-N">·</span>}
    </li>
  );
}

function SplitCard({ label, split }: { label: string; split: SplitStats }) {
  return (
    <div className="split-card">
      <h4>{label}</h4>
      <div className="split-grid">
        <span>P</span>
        <strong>{split.played}</strong>
        <span>W</span>
        <strong>{split.won}</strong>
        <span>D</span>
        <strong>{split.drawn}</strong>
        <span>L</span>
        <strong>{split.lost}</strong>
        <span>GF</span>
        <strong>{split.goalsFor}</strong>
        <span>GA</span>
        <strong>{split.goalsAgainst}</strong>
        <span>CS</span>
        <strong>{split.cleanSheets}</strong>
        <span>Pts</span>
        <strong className="accent">{split.points}</strong>
      </div>
    </div>
  );
}

export function PlayerProfileView({
  profile,
  onSelectPlayer,
}: {
  profile: PlayerProfile;
  onSelectPlayer: (player: string) => void;
}) {
  const { row } = profile;
  const seasonForm = profile.played.slice(-10);

  return (
    <div className="profile">
      <div className="profile-head">
        <div>
          <span className="profile-pos">#{profile.position}</span>
          <h2>{profile.player}</h2>
        </div>
        <div className="profile-headline">
          <span className="big">{row.points}</span>
          <span className="unit">pts</span>
          {row.deducted > 0 && <span className="ded-badge">−{row.deducted}</span>}
        </div>
      </div>

      <div className="stat-strip">
        <div>
          <span className="k">Played</span>
          <span className="v">{row.played}</span>
        </div>
        <div>
          <span className="k">W–D–L</span>
          <span className="v">
            {row.won}–{row.drawn}–{row.lost}
          </span>
        </div>
        <div>
          <span className="k">Goals</span>
          <span className="v">
            {row.goalsFor}:{row.goalsAgainst}
          </span>
        </div>
        <div>
          <span className="k">GD</span>
          <span className="v">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</span>
        </div>
        <div>
          <span className="k">Clean sheets</span>
          <span className="v">{row.cleanSheets}</span>
        </div>
        <div>
          <span className="k">Best win streak</span>
          <span className="v">{profile.longestWinStreak}</span>
        </div>
      </div>

      {profile.played.length > 0 && (
        <div className="profile-block">
          <h3>Form this season {seasonForm.length < profile.played.length && "(last 10)"}</h3>
          <div className="form-strip">
            {seasonForm.map((m) => (
              <ResultPip
                key={m.matchId}
                result={m.result}
                title={`MD${m.matchday} ${m.home ? "vs" : "at"} ${m.opponent} — ${m.goalsFor}–${m.goalsAgainst}`}
              />
            ))}
          </div>
          {profile.currentStreak && (
            <p className="muted">
              Current run: {profile.currentStreak.count}{" "}
              {profile.currentStreak.result === "W"
                ? "win"
                : profile.currentStreak.result === "L"
                  ? "loss"
                  : "draw"}
              {profile.currentStreak.count > 1 ? "s" : ""} in a row
            </p>
          )}
        </div>
      )}

      <div className="split-row">
        <SplitCard label="🏠 Home" split={profile.home} />
        <SplitCard label="✈️ Away" split={profile.away} />
      </div>

      {(profile.biggestWin || profile.biggestLoss) && (
        <div className="split-row">
          {profile.biggestWin && (
            <div className="split-card">
              <h4>Biggest win</h4>
              <p className="highlight win">
                {profile.biggestWin.goalsFor}–{profile.biggestWin.goalsAgainst}
              </p>
              <p className="muted">
                {profile.biggestWin.home ? "vs" : "at"} {profile.biggestWin.opponent} · MD
                {profile.biggestWin.matchday}
              </p>
            </div>
          )}
          {profile.biggestLoss && (
            <div className="split-card">
              <h4>Biggest loss</h4>
              <p className="highlight loss">
                {profile.biggestLoss.goalsFor}–{profile.biggestLoss.goalsAgainst}
              </p>
              <p className="muted">
                {profile.biggestLoss.home ? "vs" : "at"} {profile.biggestLoss.opponent} · MD
                {profile.biggestLoss.matchday}
              </p>
            </div>
          )}
        </div>
      )}

      {profile.deductions.length > 0 && (
        <div className="profile-block">
          <h3>Deductions</h3>
          <ul className="ded-list">
            {profile.deductions.map((d: Deduction) => (
              <li key={d.id}>
                <span className="ded-points">−{d.points} pts</span>
                <span className="ded-reason">{d.reason || "no reason given"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="profile-block">
        <h3>Results ({profile.played.length})</h3>
        {profile.played.length === 0 ? (
          <p className="muted">No games played yet.</p>
        ) : (
          <ul className="pm-list">
            {profile.played.map((m) => (
              <MatchLine key={m.matchId} match={m} />
            ))}
          </ul>
        )}
      </div>

      <div className="profile-block">
        <h3>Remaining fixtures ({profile.upcoming.length})</h3>
        <ul className="pm-list compact">
          {profile.upcoming.map((m) => (
            <li key={m.matchId} className="pm-row">
              <span className="pm-md">MD{m.matchday}</span>
              <span className={`pm-venue ${m.home ? "h" : "a"}`}>{m.home ? "H" : "A"}</span>
              <button className="linkish" onClick={() => onSelectPlayer(m.opponent)}>
                {m.opponent}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PlayersTab({
  view,
  scores,
  deductions,
  selected,
  onSelect,
}: {
  view: LeagueView;
  scores: Scores;
  deductions: Deduction[];
  selected: string | null;
  onSelect: (player: string | null) => void;
}) {
  const profile = useMemo(
    () => (selected ? computePlayerProfile(view, selected, scores, deductions) : null),
    [view, selected, scores, deductions]
  );

  if (profile) {
    return (
      <section className="card">
        <button className="mini ghost back" onClick={() => onSelect(null)}>
          ← All players
        </button>
        <PlayerProfileView profile={profile} onSelectPlayer={onSelect} />
      </section>
    );
  }

  return (
    <section className="card">
      <h3 className="section-title">Player profiles</h3>
      <div className="player-grid">
        {view.players.map((p) => (
          <button key={p} className="player-chip" onClick={() => onSelect(p)}>
            {p}
          </button>
        ))}
      </div>
    </section>
  );
}

export function HeadToHeadTab({ view, scores }: { view: LeagueView; scores: Scores }) {
  const players = view.players;
  const [a, setA] = useState(players[0] ?? "");
  const [b, setB] = useState(players[1] ?? "");

  const h2h = useMemo(() => computeHeadToHead(view, a, b, scores), [view, a, b, scores]);
  const samePlayer = a === b;
  const notEnough = players.length < 2;

  const swap = () => {
    setA(b);
    setB(a);
  };

  return (
    <section className="card">
      <h3 className="section-title">Head to head</h3>

      <div className="h2h-pickers">
        <select value={a} onChange={(e) => setA(e.target.value)} aria-label="First player">
          {players.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button className="mini" onClick={swap} title="Swap">
          ⇄
        </button>
        <select value={b} onChange={(e) => setB(e.target.value)} aria-label="Second player">
          {players.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {notEnough ? (
        <p className="muted">Not enough players yet.</p>
      ) : samePlayer ? (
        <p className="muted">Pick two different players.</p>
      ) : (
        <>
          <div className="h2h-score">
            <div className="h2h-side">
              <span className="h2h-name">{a}</span>
              <span className="h2h-wins">{h2h.aWins}</span>
            </div>
            <div className="h2h-mid">
              <span className="h2h-draws">{h2h.draws}</span>
              <span className="h2h-label">draws</span>
            </div>
            <div className="h2h-side">
              <span className="h2h-name">{b}</span>
              <span className="h2h-wins">{h2h.bWins}</span>
            </div>
          </div>

          <div className="h2h-bar">
            {h2h.played === 0 ? (
              <div className="h2h-seg none" style={{ width: "100%" }} />
            ) : (
              <>
                <div className="h2h-seg win" style={{ width: `${(h2h.aWins / h2h.played) * 100}%` }} />
                <div className="h2h-seg draw" style={{ width: `${(h2h.draws / h2h.played) * 100}%` }} />
                <div className="h2h-seg loss" style={{ width: `${(h2h.bWins / h2h.played) * 100}%` }} />
              </>
            )}
          </div>

          <p className="muted h2h-goals">
            {h2h.played} of {h2h.matches.length} meetings played · goals {h2h.aGoals}–{h2h.bGoals}
          </p>

          <ul className="pm-list h2h-list">
            {h2h.matches.map((m) => (
              <li key={m.matchId} className="pm-row">
                <span className="pm-md">MD{m.matchday}</span>
                <span className="pm-opp">
                  {m.home ? a : b} <span className="muted">vs</span> {m.home ? b : a}
                </span>
                <span className="pm-score">
                  {m.noShow
                    ? "no show"
                    : m.result === "N"
                      ? "not played"
                      : m.home
                        ? `${m.goalsFor}–${m.goalsAgainst}`
                        : `${m.goalsAgainst}–${m.goalsFor}`}
                </span>
                {m.result !== "N" && !m.noShow ? (
                  <ResultPip result={m.result} title={`${a}'s result`} />
                ) : (
                  <span className="pip pip-N">·</span>
                )}
              </li>
            ))}
          </ul>

          {h2h.played === h2h.matches.length && h2h.aWins === h2h.bWins && h2h.played > 0 && (
            <p className="muted decider-note">
              Dead even. If these two finish level on points, goal difference, goals scored and
              wins, rule 1 says they play one game to decide it.
            </p>
          )}
        </>
      )}
    </section>
  );
}
