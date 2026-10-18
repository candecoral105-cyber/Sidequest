// Hook for the top 3 picks: Gemini's reasons, and reading them out when Read aloud is on.
"use client";
import { useEffect, useRef, useState } from "react";
import { BUFFER_MIN, type Fit } from "./fit";
import type { MoodFilters } from "./types";
import { speak, topPicksSpeech } from "./voice";

type Args = {
  mood: MoodFilters | null;
  moodText: string;
  top: Fit[];
  minutesLeft: number;
  moodLoading: boolean;
  readPending: boolean;
  setReadPending: (v: boolean) => void;
};

export function useTopPicks({ mood, moodText, top, minutesLeft, moodLoading, readPending, setReadPending }: Args) {
  const [aiReasons, setAiReasons] = useState<Record<string, string>>({});
  const [reasonsFor, setReasonsFor] = useState("");
  const topKey = mood ? `${moodText}|${top.map((f) => `${f.place.id}@${f.leaveAt}`).join(",")}` : "";
  useEffect(() => {
    if (!topKey) return;
    const ctrl = new AbortController();
    fetch("/api/reasons", {
      method: "POST",
      signal: ctrl.signal,
      body: JSON.stringify({
        mood: moodText,
        picks: top.map((f) => ({
          id: f.place.id,
          name: f.place.name,
          type: f.place.type,
          society: f.place.society,
          tags: f.place.tags,
          price: f.place.price,
          walk: f.walkThere,
          by: f.thereBy,
          spare: f.spareMin + BUFFER_MIN,
          time: f.place.type === "event" ? `${f.place.open}-${f.place.close}` : `stay ${f.place.minutesNeeded} min`,
        })),
      }),
    })
      .then((r) => r.json())
      .then((d) => setAiReasons((prev) => ({ ...prev, ...d.reasons })))
      .catch(() => {})
      .finally(() => !ctrl.signal.aborted && setReasonsFor(topKey));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topKey]);
  const aiReasonFor = (f: Fit) => (mood ? aiReasons[f.place.id] : undefined);

  // With Read aloud on, read the top 3 once Gemini's reasons are in (or after 15 s). Only Gemini's reasons are
  // read out: the local one-liner repeats facts the speech already says.
  const readTop = useRef(() => {});
  readTop.current = () => speak(topPicksSpeech(Math.max(0, minutesLeft), top, Object.fromEntries(top.map((f) => [f.place.id, aiReasonFor(f)]))));
  const reasonsReady = !mood || reasonsFor === topKey;
  useEffect(() => {
    if (!readPending || moodLoading) return;
    if (reasonsReady) {
      setReadPending(false);
      readTop.current();
      return;
    }
    const t = setTimeout(() => {
      setReadPending(false);
      readTop.current();
    }, 15000);
    return () => clearTimeout(t);
  }, [readPending, reasonsReady, moodLoading, setReadPending]);
  return { aiReasonFor, readTop, clearReasons: () => setAiReasons({}) };
}
