// Generates a balanced double round-robin schedule and writes it to
// lib/fixtures.json. Every ordered pair occurs exactly once, so each player
// gets an equal number of home and away games.
//
// Pairings come from the circle method. Venue assignment is then optimised so
// players alternate home/away as much as possible instead of sitting through
// long runs at one venue — this matters because the home player hosts the room
// (rule 2). The second half mirrors the first, which guarantees perfect
// home/away balance for every player no matter how the first half is oriented.
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

// ---- 1. Circle method: unordered pairings for the first half ----
const fixed = 0;
const rotating = PLAYERS.map((_, i) => i).slice(1);

const halfPairs = [];
for (let r = 0; r < rounds; r++) {
  const arr = rotating.map((_, i) => rotating[(i + r) % rotating.length]);
  const pairs = [[fixed, arr[0]]];
  for (let k = 1; k <= (n - 2) / 2; k++) {
    pairs.push([arr[k], arr[rotating.length - k]]);
  }
  halfPairs.push(pairs);
}

// ---- 2. Optimise venue orientation to avoid long home/away runs ----
// flags[r][i] === true means the first player of that pair is at home.
const flags = halfPairs.map((pairs, r) => pairs.map((_, i) => (r + i) % 2 === 0));

/** Full-season venue sequence per player: 'H' or 'A' for each matchday. */
function venueSequences(flags) {
  const seq = Array.from({ length: n }, () => new Array(rounds * 2));
  for (let r = 0; r < rounds; r++) {
    halfPairs[r].forEach(([a, b], i) => {
      const aHome = flags[r][i];
      seq[a][r] = aHome ? "H" : "A";
      seq[b][r] = aHome ? "A" : "H";
      // The return leg swaps venues.
      seq[a][r + rounds] = aHome ? "A" : "H";
      seq[b][r + rounds] = aHome ? "H" : "A";
    });
  }
  return seq;
}

/** Cost = number of breaks, with extra weight on runs of 3 or more. */
function cost(flags) {
  const seq = venueSequences(flags);
  let total = 0;
  for (const s of seq) {
    let run = 1;
    for (let i = 1; i < s.length; i++) {
      if (s[i] === s[i - 1]) {
        run++;
        total += run > 2 ? 6 : 1;
      } else {
        run = 1;
      }
    }
  }
  return total;
}

let current = cost(flags);
let improved = true;
let passes = 0;
while (improved && passes < 200) {
  improved = false;
  passes++;
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < flags[r].length; i++) {
      flags[r][i] = !flags[r][i];
      const next = cost(flags);
      if (next < current) {
        current = next;
        improved = true;
      } else {
        flags[r][i] = !flags[r][i];
      }
    }
  }
}

// ---- 3. Emit matchdays ----
const matchdays = [];
for (let r = 0; r < rounds; r++) {
  matchdays.push({
    matchday: r + 1,
    resting: null,
    matches: halfPairs[r].map(([a, b], i) =>
      flags[r][i]
        ? { home: PLAYERS[a], away: PLAYERS[b] }
        : { home: PLAYERS[b], away: PLAYERS[a] }
    ),
  });
}
for (let r = 0; r < rounds; r++) {
  matchdays.push({
    matchday: rounds + r + 1,
    resting: null,
    matches: matchdays[r].matches.map((m) => ({ home: m.away, away: m.home })),
  });
}

fs.writeFileSync(
  new URL("../lib/fixtures.json", import.meta.url),
  JSON.stringify(matchdays, null, 2) + "\n"
);

// Report venue-run quality so regressions are obvious.
const seq = venueSequences(flags);
let worstRun = 0;
let breaks = 0;
for (const s of seq) {
  let run = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1]) {
      run++;
      breaks++;
      worstRun = Math.max(worstRun, run);
    } else {
      run = 1;
    }
  }
}
console.log(
  `Wrote ${matchdays.length} matchdays, ${matchdays.length * (n / 2)} matches for ${n} players.`
);
console.log(
  `Venue quality: longest same-venue run ${worstRun}, ${breaks} breaks total (${passes} optimisation passes).`
);
