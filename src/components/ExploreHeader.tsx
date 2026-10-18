// Top of the Explore screen: time left, the time slider, travel mode and location.
"use client";
import Link from "next/link";
import type { Building } from "@/data/buildings";
import type { TravelMode } from "@/lib/geo";
import type { useLocation } from "@/lib/location";
import { saveTravelMode } from "@/lib/travel";
import { duration, shortDate, toHHMM } from "@/lib/time";
import type { Gap } from "@/lib/types";
import ReadAloudToggle from "./ReadAloudToggle";

type Props = {
  gap: Gap;
  from: Building;
  to: Building;
  building: Building; // where you start if your location isn't used
  noReturn: boolean;
  minutesLeft: number;
  gapStart: number;
  gapEnd: number;
  now: number;
  setNow: (n: number) => void;
  setUntil: (v: string) => void;
  mode: TravelMode;
  setMode: (m: TravelMode) => void;
  travelSource: string;
  useHere: boolean;
  setUseHere: React.Dispatch<React.SetStateAction<boolean>>;
  loc: ReturnType<typeof useLocation>;
};

export default function ExploreHeader(props: Props) {
  const { gap, from, to, building, noReturn, minutesLeft, gapStart, gapEnd, now, setNow, setUntil, mode, setMode, travelSource, useHere, setUseHere, loc } = props;
  return (
    <header className="bg-slab px-4 pb-4 pt-4 text-on-slab">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm text-on-slab/70 underline-offset-2 hover:underline">
          Back to my day
        </Link>
        <ReadAloudToggle dark />
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-4xl font-extrabold leading-none text-edge tabular-nums">{duration(Math.max(0, minutesLeft))}</p>
          <p className="mt-1 text-sm text-on-slab/80">
            {shortDate(gap.date!)} · {from.name}{" "}
            {noReturn ? (
              <>
                · done for the day · until{" "}
                <input
                  type="time"
                  aria-label="Until"
                  value={gap.end}
                  onChange={(e) => setUntil(e.target.value)}
                  className="rounded bg-on-slab/15 px-1 text-on-slab [color-scheme:dark]"
                />
              </>
            ) : (
              <>
                → {to.name} at {gap.end}
              </>
            )}
          </p>
        </div>
      </div>
      <label className="mt-4 block text-xs text-on-slab/70">
        Pretend it&apos;s <b className="time text-on-slab">{toHHMM(now)}</b>
        <input
          type="range"
          min={gapStart}
          max={Math.max(gapStart, gapEnd - 15)}
          step={5}
          value={now}
          onChange={(e) => setNow(Number(e.target.value))}
          className="mt-1 w-full accent-[#ffd23f]"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex rounded-full bg-on-slab/10 p-1 text-sm" role="radiogroup" aria-label="How you'll get around">
          {([["walk", "Walk"], ["transit", "Walk + Tube/bus"]] as const).map(([m, label]) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              onClick={() => {
                setMode(m);
                saveTravelMode(m);
              }}
              className={`whitespace-nowrap rounded-full px-3 py-1 font-bold ${mode === m ? "bg-on-slab text-slab" : "text-on-slab/80"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "transit" && (
          <span className="text-xs text-on-slab/60">
            {travelSource === "loading" ? "Getting Tube/bus times…" : travelSource === "google" ? "Times from Google Maps" : "Estimated times"}
          </span>
        )}
      </div>
      <div className="mt-3 text-sm">
        <button
          onClick={() => setUseHere((on) => !on)}
          aria-pressed={useHere}
          className={`rounded-full px-3 py-1 font-bold ${useHere && (loc.status === "on" || loc.status === "demo") ? "bg-on-slab text-slab" : "bg-on-slab/10 text-on-slab"}`}
        >
          {useHere ? "Stop using my location" : "Use my location"}
        </button>
        <p className="mt-1 text-xs text-on-slab/70" role="status">
          {loc.status === "asking" && "Finding you… "}
          {loc.status === "on" && loc.live && `Starting from where you are (±${loc.live.accuracy} m). `}
          {loc.status === "demo" && "Demo location in use. "}
          {loc.status === "denied" && `Location is blocked, so we're starting from ${building.name}. You can allow it in your browser settings. `}
          {loc.status === "unavailable" && `Couldn't find your location, so we're starting from ${building.name}. `}
          {loc.status === "off" && `Starting from ${building.name}. `}
          Your location is only used on this device.
        </p>
      </div>
    </header>  );
}
