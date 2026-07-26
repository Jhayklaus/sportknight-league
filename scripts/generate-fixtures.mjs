// Generates a balanced double round-robin schedule (circle method) and
// writes it to lib/fixtures.json. Every ordered pair occurs exactly once,
// so each player gets an equal number of home and away games.
//
// Usage: node scripts/generate-fixtures.mjs "Player A" "Player B" ...
import fs from "node:fs";

const PLAYERS = process.argv.slice(2);
if (PLAYERS.length < 4 || PLAYERS.length % 2 !== 0) {
  console.error("Provide an even number of players (4 or more).");
  process.exit(1);
}
if (new Set(PLAYERS).size !== PLAYERS.length) {
  console.error("Duplicate player names.");
  process.exit(1);
}

const n = PLAYERS.length;
const rounds = n - 1;
const fixed = PLAYERS[0];
const rest = PLAYERS.slice(1); // n-1 players rotate around the fixed one

const firstHalf = [];
for (let r = 0; r < rounds; r++) {
  const arr = rest.map((_, i) => rest[(i + r) % rest.length]);
  const matches = [];
  // Alternate the fixed player's venue so home games spread across the half.
  matches.push(r % 2 === 0 ? { home: fixed, away: arr[0] } : { home: arr[0], away: fixed });
  for (let k = 1; k <= (n - 2) / 2; k++) {
    const a = arr[k];
    const b = arr[rest.length - k];
    matches.push((r + k) % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
  }
  firstHalf.push(matches);
}

const matchdays = [
  ...firstHalf.map((matches, i) => ({ matchday: i + 1, resting: null, matches })),
  ...firstHalf.map((matches, i) => ({
    matchday: rounds + i + 1,
    resting: null,
    matches: matches.map((m) => ({ home: m.away, away: m.home })),
  })),
];

const out = new URL("../lib/fixtures.json", import.meta.url);
fs.writeFileSync(out, JSON.stringify(matchdays, null, 2) + "\n");
console.log(
  `Wrote ${matchdays.length} matchdays, ${matchdays.length * (n / 2)} matches for ${n} players.`
);
