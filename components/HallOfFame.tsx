"use client";

import { useMemo, useState } from "react";
import { HONOURS_TOP_N, computeHallOfFame, type PublicLeague } from "@/lib/leagues";

const MEDALS = ["🥇", "🥈", "🥉", "4", "5"];

export function HallOfFameTab({ league }: { league: PublicLeague }) {
  const hall = useMemo(() => computeHallOfFame(league.seasons ?? []), [league.seasons]);
  const [openId, setOpenId] = useState<string | null>(hall.seasons[0]?.id ?? null);

  if (hall.seasons.length === 0) {
    return (
      <section className="card">
        <h3 className="section-title">🏛️ Hall of Fame</h3>
        <p className="muted">
          Nothing here yet. When a season is archived, its champions, top scorers and clean-sheet
          leaders are recorded here permanently.
        </p>
      </section>
    );
  }

  const open = hall.seasons.find((s) => s.id === openId) ?? hall.seasons[0];

  return (
    <>
      <section className="card">
        <h3 className="section-title">🏛️ Hall of Fame</h3>
        <p className="muted">
          {hall.seasons.length} season{hall.seasons.length === 1 ? "" : "s"} completed · top{" "}
          {HONOURS_TOP_N} in each category
        </p>

        <h4 className="sub-head">All-time roll</h4>
        <div className="table-scroll">
          <table className="league-table">
            <thead>
              <tr>
                <th className="num">#</th>
                <th className="name">Player</th>
                <th className="num">🏆</th>
                <th className="num">Top 3</th>
                <th className="num">Seasons</th>
                <th className="num">Goals</th>
                <th className="num">CS</th>
                <th className="num pts">Pts</th>
              </tr>
            </thead>
            <tbody>
              {hall.allTime.map((row, i) => (
                <tr key={row.player} className={row.titles > 0 ? "leader" : ""}>
                  <td className="num pos">{i + 1}</td>
                  <td className="name">{row.player}</td>
                  <td className="num">{row.titles || "–"}</td>
                  <td className="num">{row.podiums || "–"}</td>
                  <td className="num">{row.seasons}</td>
                  <td className="num">{row.goals}</td>
                  <td className="num">{row.cleanSheets}</td>
                  <td className="num pts">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card hof-seasons">
        <h4 className="sub-head">By season</h4>
        <div className="season-picker">
          {hall.seasons.map((s) => (
            <button
              key={s.id}
              className={s.id === open.id ? "season-chip active" : "season-chip"}
              onClick={() => setOpenId(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="hof-grid">
          <div className="hof-col">
            <h5>🏆 Final standings</h5>
            <ol className="hof-list">
              {open.topTable.map((row, i) => (
                <li key={row.player}>
                  <span className="hof-medal">{MEDALS[i]}</span>
                  <span className="hof-name">{row.player}</span>
                  <span className="hof-value">{row.points} pts</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="hof-col">
            <h5>⚽ Top scorers</h5>
            <ol className="hof-list">
              {open.topScorers.map((row, i) => (
                <li key={row.player}>
                  <span className="hof-medal">{MEDALS[i]}</span>
                  <span className="hof-name">{row.player}</span>
                  <span className="hof-value">{row.goals}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="hof-col">
            <h5>🧤 Clean sheets</h5>
            <ol className="hof-list">
              {open.topCleanSheets.map((row, i) => (
                <li key={row.player}>
                  <span className="hof-medal">{MEDALS[i]}</span>
                  <span className="hof-name">{row.player}</span>
                  <span className="hof-value">{row.cleanSheets}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}
