import fs from "node:fs";

const matchdays = JSON.parse(
  fs.readFileSync(new URL("../lib/fixtures.json", import.meta.url), "utf8")
);

const errors = [];

const players = new Set();
for (const md of matchdays) {
  if (md.resting) players.add(md.resting);
  for (const m of md.matches) { players.add(m.home); players.add(m.away); }
}
const n = players.size;
const odd = n % 2 === 1;
const expectedMatchdays = odd ? 2 * n : 2 * (n - 1);
const perMatchday = Math.floor(n / 2);
const perPlayer = 2 * (n - 1);
const totalExpected = n * (n - 1);

if (matchdays.length !== expectedMatchdays)
  errors.push(`Expected ${expectedMatchdays} matchdays for ${n} players, got ${matchdays.length}`);

const stats = new Map([...players].map(p => [p, { games: 0, home: 0, away: 0 }]));
const orderedPairs = new Map();
let totalMatches = 0;

for (const md of matchdays) {
  if (md.matches.length !== perMatchday)
    errors.push(`Matchday ${md.matchday}: ${md.matches.length} matches (expected ${perMatchday})`);
  if (odd && !md.resting) errors.push(`Matchday ${md.matchday}: missing resting player`);
  if (!odd && md.resting) errors.push(`Matchday ${md.matchday}: unexpected resting player`);
  const seen = new Set(md.resting ? [md.resting] : []);
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
  if (seen.size !== n) errors.push(`Matchday ${md.matchday}: only ${seen.size} players involved`);
}

if (totalMatches !== totalExpected)
  errors.push(`Expected ${totalExpected} matches, got ${totalMatches}`);

for (const [p, s] of stats) {
  if (s.games !== perPlayer) errors.push(`${p}: ${s.games} games (expected ${perPlayer})`);
  if (s.home !== perPlayer / 2) errors.push(`${p}: ${s.home} home games (expected ${perPlayer / 2})`);
  if (s.away !== perPlayer / 2) errors.push(`${p}: ${s.away} away games (expected ${perPlayer / 2})`);
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

console.log(
  `OK: ${matchdays.length} matchdays, ${totalMatches} matches, ${n} players — all balanced (${perPlayer} games each, ${perPlayer / 2} home / ${perPlayer / 2} away).`
);
