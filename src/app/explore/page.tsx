// Explore screen: the places that fit the chosen gap, as a list and on a map.
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import ExploreHeader from "@/components/ExploreHeader";
import ExploreMap from "@/components/ExploreMap";
import FilterChips, { UNI_CHIPS } from "@/components/FilterChips";
import MicButton from "@/components/MicButton";
import { weekDates } from "@/components/MoreThisWeek";
import ResultsList from "@/components/ResultsList";
import { buildingById } from "@/data/buildings";
import { readDemoMode } from "@/lib/demo";
import { BUFFER_MIN, byMood, checkFit, fitScore, happensOn, moodMatch, passesFilters, tagWeights, type Fit } from "@/lib/fit";
import { readGapParams } from "@/lib/gapParams";
import { reachCircle, reachEllipse, type TravelMode } from "@/lib/geo";
import { demoPosition, hereAsBuilding, useLocation } from "@/lib/location";
import { moodFallback } from "@/lib/mood";
import { mergeLive } from "@/lib/livePlaces";
import { loadCommunity, staticPlaces } from "@/lib/places";
import { duration, toMin } from "@/lib/time";
import { loadTravelMode, useTravelTimes } from "@/lib/travel";
import type { Filters, Gap, MoodFilters, Place } from "@/lib/types";
import { useLivePlaces } from "@/lib/useLivePlaces";
import { useTopPicks } from "@/lib/useTopPicks";
import { onSpeakingChange, stopSpeaking, useReadAloud } from "@/lib/voice";

const QUICK_STOP = 20; // the reach zone shows where a 20-minute stop still fits

function pickReason(f: Fit, mood: MoodFilters | null) {
  const bits: string[] = [];
  const matched = mood ? f.place.tags.filter((t) => mood.tags.includes(t) && t !== "free") : [];
  if (matched.length) bits.push(matched.slice(0, 2).join(" and "));
  if (f.place.price === 0) bits.push("free");
  bits.push(`${f.walkThere} min away`);
  const first = bits.join(", ");
  return `${first.charAt(0).toUpperCase()}${first.slice(1)}, with ${duration(f.spareMin + BUFFER_MIN)} to spare.`;
}

function Explore() {
  const sp = useSearchParams();
  const router = useRouter();
  const params = readGapParams(sp);
  const { noReturn, backToStart } = params;

  const demo = useMemo(() => demoPosition(params.demoLocation), [params.demoLocation]);
  const [useHere, setUseHere] = useState(params.wantsHere || Boolean(demo));
  const loc = useLocation(useHere, demo);
  const building = buildingById(params.wantsHere ? params.fallback : params.from);
  const from = useMemo(() => (loc.used ? hereAsBuilding(loc.used) : building), [loc.used, building]);
  const to = useMemo(
    () =>
      noReturn || backToStart
        ? { ...from, id: backToStart ? "here" : "none", name: backToStart ? "where you started" : from.name }
        : buildingById(params.to),
    [noReturn, backToStart, from, params.to],
  );
  const gap: Gap = {
    day: params.day,
    date: params.date,
    start: params.start,
    end: params.end,
    fromId: building.id,
    fromPoint: loc.used ? { lat: loc.used.lat, lng: loc.used.lng } : undefined,
    toId: noReturn ? "none" : backToStart ? "here" : params.to,
    toPoint: backToStart ? { lat: from.lat, lng: from.lng } : undefined,
  };
  const gapStart = toMin(gap.start);
  const gapEnd = toMin(gap.end);
  function setUntil(v: string) {
    if (!/^\d{2}:\d{2}$/.test(v)) return;
    const q = new URLSearchParams(sp.toString());
    q.set("end", v);
    router.replace(`/explore?${q.toString()}`);
  }

  const [now, setNow] = useState(gapStart);
  const [filters, setFilters] = useState<Filters>({ tags: [], types: [], maxPrice: null, unis: [] });
  const [mood, setMood] = useState<MoodFilters | null>(null);
  const [moodText, setMoodText] = useState("");
  const [moodLoading, setMoodLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(params.focus); // "View on map" from My plans
  const [view, setView] = useState<"list" | "map">(params.focus ? "map" : "list");
  const [isDesktop, setIsDesktop] = useState(false);
  const [basePlaces, setBasePlaces] = useState<Place[]>(() => staticPlaces()); // our events + society events + snapshot
  const [mode, setMode] = useState<TravelMode>("walk");
  const [demoMode, setDemoMode] = useState<boolean | null>(null); // null until read, so demo mode never calls Google
  const live = useLivePlaces({ from, gapMinutes: gapEnd - gapStart, mode, date: gap.date!, start: gap.start, end: gap.end, enabled: demoMode === false });
  const places = useMemo(() => mergeLive(basePlaces, live), [basePlaces, live]);
  const travel = useTravelTimes(mode, from, to, gap.date!, gap.start, places);
  const [voiceMsg, setVoiceMsg] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const readAloud = useReadAloud();
  const [readPending, setReadPending] = useState(false);

  useEffect(() => setMode(loadTravelMode()), []);
  useEffect(() => setDemoMode(readDemoMode(sp.get("demo"))), [sp]);
  useEffect(() => onSpeakingChange(setSpeaking), []);
  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => {
    if (!readAloud) setReadPending(false);
  }, [readAloud]);
  useEffect(() => {
    const community = loadCommunity();
    if (community.length) setBasePlaces([...staticPlaces(), ...community]);
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const weights = useMemo(() => tagWeights(places), [places]);
  // Without a mood: closest, soonest fits first. With a mood: what matches it first, and fit only breaks ties.
  const { fitting, notFitting, matching, others } = useMemo(() => {
    const all = places.filter((p) => passesFilters(p, filters)).map((p) => {
      const f = checkFit(p, gap, now, travel.times?.[p.id]);
      const match = mood ? moodMatch(p, mood, weights) : { matches: true, primary: false, relevance: 0 };
      return { ...f, score: f.fits ? fitScore(f, now) : 0, match };
    });
    const fits = all.filter((f) => f.fits);
    return {
      fitting: fits,
      matching: fits.filter((f) => f.match.matches).sort(mood ? byMood : (a, b) => b.score - a.score),
      others: fits.filter((f) => !f.match.matches).sort((a, b) => b.score - a.score),
      notFitting: all.filter((f) => !f.fits && f.reason !== "Not on this day"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, weights, filters, now, mood, travel.times, from.id, gap.day, gap.date, gap.start, gap.end, gap.fromId, gap.toId]);

  const uniCounts = useMemo(() => {
    const week = weekDates().map((d) => [d, new Date(`${d}T12:00:00`).getDay()] as const);
    return Object.fromEntries(
      UNI_CHIPS.map((u) => [u, places.filter((p) => passesFilters(p, { ...filters, unis: [u] }) && week.some(([d, wd]) => happensOn(p, d, wd))).length]),
    );
  }, [places, filters]);
  const placeTypes = useMemo(() => new Set<string>(places.map((p) => p.type)), [places]);
  const fittingIds = useMemo(() => new Set(fitting.map((f) => f.place.id)), [fitting]);
  const moreThisWeek = useMemo(
    () => (filters.unis.length ? places.filter((p) => passesFilters(p, filters) && !fittingIds.has(p.id)) : []),
    [places, filters, fittingIds],
  );

  // There and back: an ellipse with you and your next place as the foci. Done for the day: a circle around you.
  const zone = useMemo(
    () => (noReturn ? reachCircle(from, gapEnd - now - QUICK_STOP, mode) : reachEllipse(from, to, gapEnd - BUFFER_MIN - now - QUICK_STOP, mode)),
    [from, to, gapEnd, now, mode, noReturn],
  );

  async function searchMood(text: string) {
    if (!text.trim()) return;
    stopSpeaking();
    setVoiceMsg("");
    setMoodLoading(true);
    try {
      // Slow or no internet: after 12 s, or if the request fails, match the words on this device instead.
      const res = await fetch("/api/mood", { method: "POST", body: JSON.stringify({ text }), signal: AbortSignal.timeout(12_000) });
      if (!res.ok) throw new Error(`mood ${res.status}`);
      setMood(await res.json());
    } catch {
      setMood(moodFallback(text));
      setVoiceMsg("Couldn't reach the server, so this is a simpler keyword search.");
    } finally {
      if (readAloud) setReadPending(true);
      setMoodLoading(false);
    }
  }

  const minutesLeft = gapEnd - now;
  const top = matching.slice(0, 3);
  const rest = matching.slice(3);

  const { aiReasonFor, readTop, clearReasons } = useTopPicks({ mood, moodText, top, minutesLeft, moodLoading, readPending, setReadPending });
  const reasonFor = (f: Fit) => aiReasonFor(f) || pickReason(f, mood);

  const select = (f: Fit) => setSelectedId(selectedId === f.place.id ? null : f.place.id);

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <section className={`flex min-h-0 flex-col md:w-[420px] md:shrink-0 ${view === "map" ? "h-auto" : "flex-1"}`}>
        <ExploreHeader
          {...{ gap, from, to, building, noReturn, minutesLeft, gapStart, gapEnd, now, setNow, setUntil, mode, setMode, useHere, setUseHere, loc }}
          travelSource={travel.source}
        />

        <div className="space-y-3 bg-paper px-4 pt-4 pb-3 md:pb-0">
          <div className={`space-y-3 ${view === "map" ? "hidden md:block" : ""}`}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                searchMood(moodText);
              }}
              className="flex gap-2"
            >
              <MicButton
                disabled={moodLoading}
                onText={(t) => {
                  setMoodText(t);
                  searchMood(t);
                }}
                onError={setVoiceMsg}
              />
              <input
                value={moodText}
                onChange={(e) => setMoodText(e.target.value)}
                placeholder="How are you feeling? e.g. tired and broke"
                aria-label="How are you feeling?"
                className="min-w-0 flex-1 rounded-xl border border-rail bg-card px-3 py-2.5"
              />
              <button className="press rounded-xl bg-action px-4 font-bold text-on-action disabled:opacity-60" disabled={moodLoading}>
                {moodLoading ? "…" : "Go"}
              </button>
            </form>
            {voiceMsg && <p className="rounded-xl bg-card px-3 py-2 text-sm" role="status">{voiceMsg}</p>}
            {mood && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 text-sm">
                <span>{mood.summary}</span>
                <button
                  onClick={() => {
                    setMood(null);
                    setMoodText("");
                    clearReasons();
                    stopSpeaking();
                  }}
                  className="font-bold underline"
                >
                  Clear
                </button>
              </div>
            )}
            <FilterChips filters={filters} setFilters={setFilters} uniCounts={uniCounts} types={placeTypes} />
            {demoMode && <p className="text-xs text-ink-soft">Demo mode: saved places only (add ?demo=0 to the address to go live).</p>}
          </div>

          <div className="flex rounded-xl bg-card p-1 md:hidden" role="tablist">
            {(["list", "map"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`flex-1 rounded-lg py-1.5 text-sm font-bold ${view === v ? "bg-action text-on-action" : ""}`}
              >
                {v === "list" ? `List (${fitting.length})` : "Map"}
              </button>
            ))}
          </div>
        </div>

        <ResultsList
          hidden={view === "map"}
          {...{ gap, to, noReturn, gapStart, gapEnd, fitting, notFitting, top, rest, others, mood, filters, moreThisWeek }}
          {...{ readAloud, speaking, selectedId, select, reasonFor, aiReasonFor }}
          googleTimes={travel.source === "google"}
          onReadTop={() => readTop.current()}
        />
      </section>

      <ExploreMap
        {...{ from, to, gap, zone, mode, noReturn, selectedId, setSelectedId }}
        showNext={!noReturn && !backToStart}
        me={loc.live}
        fits={[...fitting, ...notFitting]}
        focus={fitting.map((f) => [f.place.lat, f.place.lng] as [number, number])}
        visible={isDesktop || view === "map"}
        showCard={view === "map"}
        googleTimes={travel.source === "google"}
      />
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense>
      <Explore />
    </Suspense>
  );
}
