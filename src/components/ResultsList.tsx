// Explore results: top picks, everything else that fits, and what doesn't fit.
"use client";
import Link from "next/link";
import { useState } from "react";
import type { Building } from "@/data/buildings";
import type { Fit } from "@/lib/fit";
import { OPEN_TO_ALL } from "@/lib/places";
import type { Filters, Gap, MoodFilters, Place } from "@/lib/types";
import { stopSpeaking } from "@/lib/voice";
import MoreThisWeek from "./MoreThisWeek";
import PlaceCard from "./PlaceCard";

type Props = {
  hidden: boolean; // the map is showing instead (phones)
  gap: Gap;
  to: Building;
  noReturn: boolean;
  gapStart: number;
  gapEnd: number;
  fitting: Fit[];
  notFitting: Fit[];
  top: Fit[];
  rest: Fit[];
  others: Fit[];
  mood: MoodFilters | null;
  filters: Filters;
  moreThisWeek: Place[];
  googleTimes: boolean;
  readAloud: boolean;
  speaking: boolean;
  onReadTop: () => void;
  selectedId: string | null;
  select: (f: Fit) => void;
  reasonFor: (f: Fit) => string;
  aiReasonFor: (f: Fit) => string | undefined;
};

export default function ResultsList(props: Props) {
  const { hidden, gap, to, noReturn, gapStart, gapEnd, fitting, notFitting, top, rest, others, mood, filters, moreThisWeek } = props;
  const { googleTimes, readAloud, speaking, onReadTop, selectedId, select, reasonFor, aiReasonFor } = props;
  const [showNoFit, setShowNoFit] = useState(false);
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-3 ${hidden ? "hidden md:block" : ""}`}>
      {gapEnd - gapStart < 15 ? (
        <div className="rounded-2xl border-2 border-dashed border-rail p-5" role="alert">
          <p className="font-bold">This free time ends before it starts ({gap.start} until {gap.end}).</p>
          <p className="mt-1 text-sm text-ink-soft">Pick a later &quot;Until&quot; time{noReturn ? " above" : ""}, or go back and choose the times again.</p>
          <Link href="/" className="mt-3 inline-block rounded-xl bg-action px-3 py-2 text-sm font-bold text-on-action">
            Back to my day
          </Link>
        </div>
      ) : fitting.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-rail p-5 text-ink-soft">
          Nothing fits right now. Try removing a filter or moving the time back.
        </p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold">{mood ? "Top picks for you" : "Best fits"}</h2>
            {readAloud && top.length > 0 && <button
              onClick={() => (speaking ? stopSpeaking() : onReadTop())}
              className="rounded-full bg-card px-3 py-1 text-sm font-bold"
              aria-label={speaking ? "Stop reading" : "Read the top picks aloud"}
            >
              {speaking ? "■ Stop" : "▶ Read top picks"}
            </button>}
          </div>
          {mood && top.length < 3 && (
            <p className="mb-3 rounded-xl bg-card px-3 py-2 text-sm" role="status">
              {top.length === 0
                ? "Nothing matches your mood right now. Here's what fits your gap instead."
                : `Only ${top.length} ${top.length === 1 ? "thing matches" : "things match"} right now.`}
            </p>
          )}
          <div className="space-y-3">
            {top.map((f) => (
              <PlaceCard key={f.place.id} fit={f} to={to} gap={gap} googleTimes={googleTimes} selected={selectedId === f.place.id}
                onSelect={() => select(f)} reason={reasonFor(f)} aiReason={Boolean(aiReasonFor(f))} />
            ))}
          </div>
          {rest.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 font-display text-lg font-bold">{mood ? "Also matches your mood" : "Also fits"} ({rest.length})</h2>
              <div className="space-y-3">
                {rest.map((f) => (
                  <PlaceCard key={f.place.id} fit={f} to={to} gap={gap} googleTimes={googleTimes} selected={selectedId === f.place.id}
                    onSelect={() => select(f)} />
                ))}
              </div>
            </>
          )}
          {others.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 font-display text-lg font-bold">Other things that fit your gap ({others.length})</h2>
              <div className="space-y-3">
                {others.map((f) => (
                  <PlaceCard key={f.place.id} fit={f} to={to} gap={gap} googleTimes={googleTimes} selected={selectedId === f.place.id}
                    onSelect={() => select(f)} />
                ))}
              </div>
            </>
          )}
        </>
      )}
      {moreThisWeek.length > 0 && (
        <MoreThisWeek
          title={`More from ${filters.unis.map((u) => (u === OPEN_TO_ALL ? "open-to-all organisers" : u)).join(" & ")} this week`}
          places={moreThisWeek}
          gap={gap}
          notFitting={notFitting}
          googleTimes={googleTimes}
        />
      )}
      {notFitting.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowNoFit((s) => !s)} className="text-sm font-bold text-ink-soft underline" aria-expanded={showNoFit}>
            {showNoFit ? "Hide" : "Show"} {notFitting.length} that don&apos;t fit this gap
          </button>
          {showNoFit && (
            <div className="mt-3 space-y-3">
              {notFitting.map((f) => (
                <PlaceCard key={f.place.id} fit={f} to={to} gap={gap} googleTimes={googleTimes} selected={selectedId === f.place.id}
                  onSelect={() => select(f)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>  );
}
