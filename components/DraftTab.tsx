"use client";

import { useEffect, useState } from "react";
import { DEFAULT_MAX_ENTRIES, spotsLeft } from "@/lib/draft";
import { MIN_PLAYERS, type PublicLeague } from "@/lib/leagues";
import { competitionName } from "@/lib/teams";

export function DraftTab({
  league,
  slug,
  code,
  onLeagueUpdated,
  onCodeRejected,
}: {
  league: PublicLeague;
  slug: string;
  code: string | null;
  onLeagueUpdated: (league: PublicLeague) => void;
  onCodeRejected: () => void;
}) {
  const draft = league.draft ?? null;
  const [maxEntries, setMaxEntries] = useState(String(draft?.maxEntries ?? DEFAULT_MAX_ENTRIES));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [copied, setCopied] = useState(false);
  const [invites, setInvites] = useState<{ code: string; usedBy: string | null }[]>([]);
  const [showCodes, setShowCodes] = useState(false);
  const [shareUrl, setShareUrl] = useState(`/l/${slug}/draft`);

  useEffect(() => {
    setShareUrl(`${window.location.origin}/l/${slug}/draft`);
  }, [slug]);

  const send = async (payload: Record<string, unknown>) => {
    if (!code || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${slug}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, ...payload }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setError("Code no longer valid — unlock again");
        onCodeRejected();
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      onLeagueUpdated(data.league as PublicLeague);
      if (Array.isArray(data.invites)) setInvites(data.invites);
      setConfirmReset(false);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  const generateFixtures = async () => {
    if (!code || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${slug}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, action: "generate" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not generate fixtures");
        return;
      }
      onLeagueUpdated(data.league as PublicLeague);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select the link and copy it manually.");
    }
  };

  if (!code) {
    // Viewers only see a draft that is actually running.
    if (!draft) return null;
    return (
      <section className="card">
        <h3 className="section-title">🎲 Team draft</h3>
        <p className="muted">
          {draft.entries.length} of {draft.maxEntries} places taken.{" "}
          {draft.open ? "The draft is open." : "The draft is closed."}
        </p>
        {draft.entries.length > 0 && <EntryList entries={draft.entries} />}
      </section>
    );
  }

  return (
    <section className="card">
      <h3 className="section-title">🎲 Team draft</h3>

      {!draft ? (
        <>
          <p className="muted">
            Run a draft for an authentic-teams tournament. Entrants open a link, enter a name and
            rank three of Europe&apos;s top five leagues; a club is drawn for them and they join
            the table as <strong>Name (Club)</strong>. No two entrants get the same club.
          </p>
          <div className="window-form">
            <label>
              Maximum entries
              <input
                type="number"
                min={2}
                max={64}
                value={maxEntries}
                onChange={(e) => setMaxEntries(e.target.value)}
                aria-label="Maximum entries"
              />
            </label>
            <button
              className="mini save"
              disabled={busy}
              onClick={() => send({ action: "open", maxEntries: Number(maxEntries) })}
            >
              {busy ? "…" : "Open the draft"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="draft-status">
            <span className={draft.open ? "season-chip live" : "season-chip"}>
              {draft.open ? "Open" : "Closed"}
            </span>
            <span className="muted">
              {draft.entries.length} of {draft.maxEntries} taken
              {draft.open && ` · ${spotsLeft(draft)} left`}
            </span>
          </div>

          <h4 className="sub-head">Share this link</h4>
          <div className="share-row">
            <input readOnly value={shareUrl} aria-label="Draft share link" onFocus={(e) => e.currentTarget.select()} />
            <button className="mini" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="muted">
            Anyone with this link can enter once, until all {draft.maxEntries} places are gone. It
            closes itself when full — no admin code needed to enter.
          </p>

          {draft.entries.length > 0 && (
            <EntryList
              entries={draft.entries}
              onRemove={(id) => send({ action: "removeEntry", entryId: id })}
              busy={busy}
            />
          )}

          <div className="invite-box">
            <h4 className="sub-head">One entry per person</h4>
            <p className="muted">
              Every entrant is already held to one club per browser, and to a unique name. For an
              airtight draft, switch on invite codes and send each person their own — a code works
              once.
            </p>
            <div className="window-form">
              <button
                className={draft.requireInvite ? "mini" : "mini save"}
                disabled={busy}
                onClick={() => send({ action: "invites", require: !draft.requireInvite })}
              >
                {draft.requireInvite ? "Turn invite codes off" : "Require invite codes"}
              </button>
              {draft.requireInvite && (
                <button
                  className="mini"
                  disabled={busy}
                  onClick={async () => {
                    if (!showCodes) await send({ action: "invites" });
                    setShowCodes(!showCodes);
                  }}
                >
                  {showCodes ? "Hide codes" : "Show codes"}
                </button>
              )}
            </div>

            {draft.requireInvite && showCodes && invites.length > 0 && (
              <>
                <ul className="code-list">
                  {invites.map((i) => (
                    <li key={i.code} className={i.usedBy ? "used" : ""}>
                      <code>{i.code}</code>
                      <span className="muted">{i.usedBy ? "used" : "free"}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className="mini ghost"
                  onClick={() => {
                    const free = invites.filter((i) => !i.usedBy).map((i) => i.code);
                    navigator.clipboard.writeText(free.join("\n")).catch(() => {});
                  }}
                >
                  Copy unused codes
                </button>
              </>
            )}
          </div>

          <div className="window-form">
            {draft.open ? (
              <button className="mini" disabled={busy} onClick={() => send({ action: "close" })}>
                Close the draft
              </button>
            ) : (
              <>
                <label>
                  Maximum entries
                  <input
                    type="number"
                    min={2}
                    max={64}
                    value={maxEntries}
                    onChange={(e) => setMaxEntries(e.target.value)}
                    aria-label="Maximum entries"
                  />
                </label>
                <button
                  className="mini"
                  disabled={busy}
                  onClick={() => send({ action: "open", maxEntries: Number(maxEntries) })}
                >
                  Reopen
                </button>
              </>
            )}
            <button className="mini danger" disabled={busy} onClick={() => setConfirmReset(true)}>
              Scrap the draft
            </button>
          </div>

          {confirmReset && (
            <div className="confirm-box">
              <p>
                This removes all {draft.entries.length} drafted players from the roster and clears
                the fixtures. Players you added by hand stay.
              </p>
              <div className="confirm-actions">
                <button className="mini danger" disabled={busy} onClick={() => send({ action: "reset" })}>
                  Yes, scrap it
                </button>
                <button className="mini ghost" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!draft.open && league.players.length >= MIN_PLAYERS && league.fixtures.length === 0 && (
            <div className="next-step">
              <h4 className="sub-head">Next step</h4>
              <p className="muted">
                {league.players.length} players are in. Generate the schedule to start the
                tournament.
              </p>
              <button className="mini save" disabled={busy} onClick={generateFixtures}>
                Generate fixtures
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="row-error">{error}</p>}
    </section>
  );
}

function EntryList({
  entries,
  onRemove,
  busy,
}: {
  entries: NonNullable<PublicLeague["draft"]>["entries"];
  onRemove?: (id: string) => void;
  busy?: boolean;
}) {
  return (
    <>
      <h4 className="sub-head">Entries ({entries.length})</h4>
      <ul className="draft-list">
        {entries.map((e) => (
          <li key={e.id}>
            <span className="draft-name">{e.name}</span>
            <span className="draft-team">{e.team}</span>
            <span className="draft-comp muted">{competitionName(e.competitionId)}</span>
            {onRemove && (
              <button
                className="mini danger"
                disabled={busy}
                onClick={() => onRemove(e.id)}
                title="Remove this entry and free the club"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
