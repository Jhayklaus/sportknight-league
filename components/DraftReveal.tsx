"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface RevealProps {
  team: string;
  competition: string;
  player: string;
  /** Clubs from the leagues this entrant ranked, for the shuffle. */
  pool: string[];
  onDone: () => void;
}

type Phase = "spinning" | "landing" | "done";

/** Total spin ticks, and how the gap between them grows towards the end. */
const TICKS = 34;
const FAST_MS = 45;
const SLOW_MS = 430;

function tickDelay(index: number): number {
  const t = index / (TICKS - 1);
  // Ease-in: barely slows at first, then drags out the last few names.
  return FAST_MS + (SLOW_MS - FAST_MS) * Math.pow(t, 3.2);
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function DraftReveal({ team, competition, player, pool, onDone }: RevealProps) {
  const [phase, setPhase] = useState<Phase>("spinning");
  const [display, setDisplay] = useState<string>(pool[0] ?? team);
  const [tick, setTick] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipped = useRef(false);

  // A shuffled run of other clubs, always ending on the real one.
  const reel = useMemo(() => {
    const others = pool.filter((t) => t !== team);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    const frames: string[] = [];
    for (let i = 0; i < TICKS - 1; i++) {
      frames.push(others.length ? others[i % others.length] : team);
    }
    frames.push(team);
    return frames;
  }, [pool, team]);

  const finish = () => {
    if (timer.current) clearTimeout(timer.current);
    skipped.current = true;
    setDisplay(team);
    setPhase("done");
  };

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(team);
      setPhase("done");
      return;
    }

    let current = 0;
    const step = () => {
      if (skipped.current) return;
      setDisplay(reel[current]);
      setTick(current);
      if (current >= reel.length - 1) {
        setPhase("done");
        return;
      }
      if (current > TICKS - 7) setPhase("landing");
      const delay = tickDelay(current);
      current += 1;
      timer.current = setTimeout(step, delay);
    };
    step();

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // The reel is derived once per draw; re-running would restart the animation.
  }, [reel, team]);

  const progress = Math.min(100, Math.round((tick / (TICKS - 1)) * 100));
  const spinning = phase !== "done";

  return (
    <section className={`card reveal ${phase}`}>
      {spinning ? (
        <>
          <p className="reveal-kicker">{phase === "landing" ? "And it's…" : "Drawing your club"}</p>
          <p className="reel" key={`${display}-${tick}`} aria-live="off">
            {display}
          </p>
          <div className="reel-track">
            <div className="reel-fill" style={{ width: `${progress}%` }} />
          </div>
          <button type="button" className="mini ghost reel-skip" onClick={finish}>
            Skip
          </button>
        </>
      ) : (
        <>
          <p className="reveal-kicker">You drafted</p>
          <p className="reveal-team pop">{team}</p>
          <p className="reveal-comp">{competition}</p>
          <p className="reveal-name">
            You will appear in the table as <strong>{player}</strong>
          </p>
          <button type="button" className="mini save reveal-link" onClick={onDone}>
            Continue
          </button>
        </>
      )}
      {/* Announced once, after the theatrics, so screen readers are not spammed. */}
      <p className="sr-only" aria-live="polite">
        {phase === "done" ? `You drafted ${team} from ${competition}.` : ""}
      </p>
    </section>
  );
}
