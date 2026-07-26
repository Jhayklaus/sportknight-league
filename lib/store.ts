import fs from "node:fs";
import path from "node:path";
import type { Score, Scores } from "./league";

const DATA_DIR = process.env.LEAGUE_DATA_DIR || path.join(process.cwd(), "data");
const SCORES_FILE = path.join(DATA_DIR, "scores.json");

export function readScores(): Scores {
  try {
    const raw = fs.readFileSync(SCORES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Scores) : {};
  } catch {
    return {};
  }
}

export function writeScore(matchId: string, score: Score | null): Scores {
  const scores = readScores();
  if (score === null) {
    delete scores[matchId];
  } else {
    scores[matchId] = score;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = SCORES_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(scores, null, 2));
  fs.renameSync(tmp, SCORES_FILE);
  return scores;
}
