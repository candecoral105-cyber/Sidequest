// Explore map: Google Maps when there's a key, otherwise OpenStreetMap, so it works with no keys at all.
"use client";
import dynamic from "next/dynamic";
import type { Building } from "@/data/buildings";
import type { Fit } from "@/lib/fit";
import type { TravelMode } from "@/lib/geo";
import type { Position } from "@/lib/location";
import type { Gap } from "@/lib/types";
import PlaceCard from "./PlaceCard";

const mapLoading = () => <div className="grid h-full place-items-center text-ink-soft">Loading map…</div>;
const MapView = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  ? dynamic(() => import("./GoogleMapView"), { ssr: false, loading: mapLoading })
  : dynamic(() => import("./LeafletMapView"), { ssr: false, loading: mapLoading });

type Props = {
  from: Building;
  to: Building;
  showNext: boolean;
  me: Position | null;
  fits: Fit[];
  focus: [number, number][];
  visible: boolean;
  selectedId: string | null;
  gap: Gap;
  zone: [number, number][] | null;
  mode: TravelMode;
  noReturn: boolean;
  setSelectedId: (id: string | null) => void;
  showCard: boolean; // phones: the map is showing, so tapping a pin shows its card over the map
  googleTimes: boolean;
};

export default function ExploreMap({ from, to, gap, zone, mode, noReturn, selectedId, setSelectedId, showNext, me, fits, focus, visible, showCard, googleTimes }: Props) {
  return (
        <section className={`relative min-h-0 flex-1 ${showCard ? "" : "hidden md:block"}`} aria-label="Map">
      <MapView from={from} to={to} showNext={showNext} me={me} fits={fits} focus={focus} ellipse={zone} selectedId={selectedId}
        onSelect={(id) => setSelectedId(id)} visible={visible} />
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[260px] rounded-xl bg-card/95 p-3 text-xs shadow">
        <p className="flex items-center gap-2 font-bold">
          <span className="platform-edge inline-block h-3 w-5 rounded-sm" aria-hidden /> Reach zone
        </p>
        <p className="mt-1 text-ink-soft">
          {!zone
            ? "Not enough time left for a stop."
            : noReturn
              ? `Anywhere inside, you can get there and stay 20 min before ${gap.end}.`
              : mode === "transit"
              ? "Roughly where you can stop for 20 min by walking or Tube/bus and still make your next class."
              : "Anywhere inside, you can stop for 20 min and still make your next class."}
        </p>
      </div>
      {showCard && selectedId && (
        <div className="absolute inset-x-3 bottom-3 z-[600] md:hidden">
          {fits.filter((f) => f.place.id === selectedId).map((f) => (
            <PlaceCard key={f.place.id} fit={f} to={to} gap={gap} googleTimes={googleTimes} selected onSelect={() => setSelectedId(null)} />
          ))}
        </div>
      )}
    </section>
  );
}
