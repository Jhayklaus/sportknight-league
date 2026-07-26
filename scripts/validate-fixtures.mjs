import fs from "node:fs";

const matchdays = JSON.parse(
  fs.readFileSync(new URL("../lib/fixtures.json", import.meta.url), "utf8")
);

const errors = [];
if (matchdays.length !== 26) errors.push(`Expected 26 matchdays, got ${matchdays.length}`);

const players = new Set();
for (const md of matchdays) {
  players.add(md.resting);
  for (const m of md.matches) { players.add(m.home); players.add(m.away); }
}
if (players.size !== 13) errors.push(`Expected 13 players, got ${players.size}`);

const stats = new Map([...players].map(p => [p, { games: 0, home: 0, away: 0 }]));
const orderedPairs = new Map();
let totalMatches = 0;

for (const md of matchdays) {
  if (md.matches.length !== 6) errors.push(`Matchday ${md.matchday}: ${md.matches.length} matches`);
  const seen = new Set([md.resting]);
  for (const m of md.matches) {
    totalMatches++;
    for (const [p, role] of [[m.home, "home"], [m.away, "away"]]) {
      if (seen.has(p)) errors.push(`Matchday ${md.matchday}: ${p} appears twice (or is resting)`);
      seen.add(p);
      stats.get(p).games++;
      stats.get(p)[role]++;
    }
    const key = `${m.home}|${m.away}`;
    orderedPairs.set(key, (orderedPairs.get(key) ?? 0) + 1);
  }
  if (seen.size !== 13) errors.push(`Matchday ${md.matchday}: only ${seen.size} players involved`);
}

if (totalMatches !== 156) errors.push(`Expected 156 matches, got ${totalMatches}`);

for (const [p, s] of stats) {
  if (s.games !== 24) errors.push(`${p}: ${s.games} games (expected 24)`);
  if (s.home !== 12) errors.push(`${p}: ${s.home} home games (expected 12)`);
  if (s.away !== 12) errors.push(`${p}: ${s.away} away games (expected 12)`);
}

for (const [key, count] of orderedPairs) {
  if (count !== 1) errors.push(`Ordered pair ${key.replace("|", " vs ")} occurs ${count} times`);
  const [h, a] = key.split("|");
  if (!orderedPairs.has(`${a}|${h}`)) errors.push(`Missing reverse fixture for ${h} vs ${a}`);
}

if (errors.length) {
  console.error("VALIDATION FAILED:");
  for (const e of errors) console.error(" - " + e);
  process.exit(1);
}

console.log(`OK: ${matchdays.length} matchdays, ${totalMatches} matches, ${players.size} players — all balanced.`);
