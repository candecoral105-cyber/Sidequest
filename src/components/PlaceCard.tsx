// One result card: when to leave, when you're back, and Add to my day.
"use client";
import { useEffect, useState } from "react";
import type { Building } from "@/data/buildings";
import type { Fit } from "@/lib/fit";
import { nextDateFor, toHHMM } from "@/lib/time";
import type { Gap, PlaceType } from "@/lib/types";
import { isOpenToAll } from "@/lib/places";
import GoogleMapsAttribution from "./GoogleMapsAttribution";
import { addPlan, clashText, clashesWith, planFromFit, planId, removePlan, usePlans, type Plan } from "@/lib/plans";
import { cardSpeech, onSpeakingChange, speak, stopSpeaking, useReadAloud } from "@/lib/voice";

// Category colours from globals.css, so they switch with light and dark.
export const TYPE_COLOR: Record<PlaceType, string> = {
  event: "var(--event)",
  cafe: "var(--cafe)",
  study: "var(--study)",
  activity: "var(--activity)",
  deal: "var(--deal)",
};
// Map pins are drawn by the map libraries, which can't read CSS colours: mid tones that show on light and dark maps.
export const PIN_COLOR: Record<PlaceType, string> = {
  event: "#e64980",
  cafe: "#b07a4f",
  study: "#3b7cf0",
  activity: "#24a560",
  deal: "#f06a1f",
};
const TYPE_LABEL: Record<PlaceType, string> = {
  event: "Society event",
  cafe: "Café",
  study: "Study spot",
  activity: "Activity",
  deal: "Student deal",
};

function calendarLink(fit: Fit, gap: Gap) {
  const ymd = (gap.date ?? nextDateFor(gap.day)).replaceAll("-", "");
  const t = (m: number) => toHHMM(m).replace(":", "") + "00";
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SideQuest//EN", "BEGIN:VEVENT",
    `DTSTART:${ymd}T${t(fit.leaveAt)}`, `DTEND:${ymd}T${t(fit.backAt)}`,
    `SUMMARY:${fit.place.name}`, `LOCATION:${fit.place.address}`,
    `DESCRIPTION:Leave at ${toHHMM(fit.leaveAt)}. ${fit.noReturn ? "Done" : "Back"} by ${toHHMM(fit.backAt)}.`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

type Props = {
  fit: Fit; to: Building; gap: Gap; selected: boolean; onSelect: () => void; reason?: string; aiReason?: boolean;
  googleTimes?: boolean; // the Tube/bus times came from Google (Routes API), not our estimate
};

export default function PlaceCard({ fit, to, gap, selected, onSelect, reason, aiReason, googleTimes }: Props) {
  const p = fit.place;
  const priceText = p.price === 0 ? "Free" : `£${p.price}`;
  const readAloudOn = useReadAloud();
  const [reading, setReading] = useState(false);
  useEffect(() => {
    if (!reading) return;
    return onSpeakingChange((on) => !on && setReading(false));
  }, [reading]);
  const plans = usePlans();
  const added = plans.some((x) => x.id === planId(p.id, gap));
  const [clash, setClash] = useState<Plan[] | null>(null);
  function togglePlan() {
    if (added) return removePlan(planId(p.id, gap));
    const plan = planFromFit(fit, gap);
    const clashes = clashesWith(plan, plans);
    if (clashes.length) return setClash(clashes); // ask first
    addPlan(plan);
  }
  function readAloud() {
    if (reading) return stopSpeaking();
    speak(cardSpeech(fit, aiReason ? reason : undefined)); // the local one-liner repeats what the speech already says
    setReading(true);
  }
  return (
    <article
      className={`rounded-2xl bg-card p-4 shadow-card transition-shadow ${selected ? "ring-3 ring-ink" : ""} ${fit.fits ? "" : "opacity-60"}`}
    >
      <button onClick={onSelect} className="block w-full text-left">
        <div className="flex items-start gap-3">
          <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: TYPE_COLOR[p.type] }} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold" style={{ color: TYPE_COLOR[p.type] }}>
              {p.uni && (
                <span className="mr-1.5 inline-block rounded bg-action px-1.5 py-px align-[1px] text-[10px] tracking-wide text-on-action">{p.uni}</span>
              )}
              {p.type === "event" && !p.uni ? "Event" : TYPE_LABEL[p.type]}
              {p.society && ` · ${p.society}`}
              {isOpenToAll(p) && " · open to all"}
              {p.source === "community" && " · New"}
              {p.live && <span className="ml-1.5 font-normal text-ink-soft">· Live from Google</span>}
            </p>
            <h3 className="font-display text-lg font-bold leading-snug">{p.name}</h3>
            {reason && (
              <p className="mt-1 text-sm italic text-ink">
                {reason}
                {aiReason && <span className="ml-1 not-italic text-xs text-ink-soft">(Gemini)</span>}
              </p>
            )}
            {fit.fits ? (
              <p className="mt-1 text-sm text-ink-soft">
                {p.type === "event" ? `${p.open}–${p.close}` : `${p.minutesNeeded} min`} · {fit.walkThere} min {fit.thereBy === "transit" ? "by Tube/bus" : "walk"} · {priceText}
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-soft">{fit.reason}</p>
            )}
          </div>
        </div>
      </button>

      {readAloudOn && <div className="mt-2 flex justify-end">
        <button onClick={readAloud} className="rounded-full px-2 py-1 text-xs font-bold text-ink-soft underline-offset-2 hover:underline"
          aria-label={reading ? `Stop reading ${p.name}` : `Read ${p.name} aloud`}>
          {reading ? "■ Stop" : "🔊 Read aloud"}
        </button>
      </div>}

      {fit.fits && (
        <div className={`${readAloudOn ? "mt-1" : "mt-3"} flex items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2 text-sm`}>
          <span>
            Leave <b className="time">{toHHMM(fit.leaveAt)}</b>
          </span>
          <span className="text-right">
            {fit.noReturn ? "Done by" : `Back at ${to.name.split(" (")[0]} by`} <b className="time">{toHHMM(fit.backAt)}</b>
          </span>
        </div>
      )}

      {fit.fits && !clash && (
        <button
          onClick={togglePlan}
          aria-pressed={added}
          aria-label={added ? `Added ${p.name} to my day. Tap to remove` : `Add ${p.name} to my day`}
          className={`press mt-2 w-full rounded-xl px-3 py-2 font-bold ${added ? "border-2 border-ink bg-card text-ink" : "bg-action text-on-action"}`}
        >
          {added ? "Added ✓" : "Add to my day"}
        </button>
      )}
      {clash && (
        <div className="mt-2 rounded-xl border-2 border-event p-3 text-sm" role="alert">
          <p className="font-bold">This clashes with {clash.map(clashText).join(" and ")}.</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                addPlan(planFromFit(fit, gap));
                setClash(null);
              }}
              className="flex-1 rounded-lg bg-action px-3 py-1.5 font-bold text-on-action"
            >
              Add anyway
            </button>
            <button onClick={() => setClash(null)} className="flex-1 rounded-lg bg-paper px-3 py-1.5 font-bold">
              Cancel
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div className="mt-3 space-y-2 text-sm">
          {p.deal && <p className="rounded-lg bg-deal/10 p-2 font-bold text-deal">{p.deal}</p>}
          {p.address && <p className="text-ink-soft">{p.address}</p>}
          <div className="flex flex-wrap gap-1">
            {p.tags.map((t) => (
              <span key={t} className="rounded-full bg-paper px-2 py-0.5 text-xs">{t}</span>
            ))}
          </div>
          {fit.fits && (
            <div className="flex gap-2 pt-1">
              <a
                href={calendarLink(fit, gap)}
                download={`sidequest-${p.id}.ics`}
                className="flex-1 rounded-xl bg-paper px-3 py-2 text-center font-bold"
              >
                Add to calendar
              </a>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=${fit.thereBy === "transit" ? "transit" : "walking"}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-xl bg-paper px-3 py-2 text-center font-bold"
              >
                Directions
              </a>
            </div>
          )}
          {p.mapsUrl && (
            <a href={p.mapsUrl} target="_blank" rel="noreferrer" className="block text-xs underline">
              See on Google Maps (photos, reviews, live opening hours)
            </a>
          )}
        </div>
      )}
      {/* Always visible whenever this card shows Google data: the place itself, or a Tube/bus time from Google */}
      {(p.source === "google" || (googleTimes && (fit.thereBy === "transit" || fit.backBy === "transit"))) && (
        <GoogleMapsAttribution className="mt-2 text-right" />
      )}
    </article>
  );
}
