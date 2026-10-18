// Google Maps version of the Explore map: reach zone, pins, your location and the route.
"use client";
import { AdvancedMarker, APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import type { Building } from "@/data/buildings";
import type { Fit } from "@/lib/fit";
import type { Position } from "@/lib/location";
import { useIsDark } from "@/lib/theme";
import { PIN_COLOR } from "./PlaceCard";

type Props = {
  from: Building;
  to: Building;
  fits: Fit[];
  ellipse: [number, number][] | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  visible: boolean;
  focus: [number, number][];
  me?: Position | null; // your live location (blue dot)
  showNext?: boolean; // false when you're done for the day (no next place)
};

function Accuracy({ me }: { me: Position | null | undefined }) {
  const map = useMap();
  const maps = useMapsLibrary("maps");
  useEffect(() => {
    if (!map || !maps || !me) return;
    const c = new maps.Circle({
      map,
      center: { lat: me.lat, lng: me.lng },
      radius: me.accuracy,
      strokeColor: "#0b57d0",
      strokeWeight: 1,
      fillColor: "#0b57d0",
      fillOpacity: 0.12,
      clickable: false,
    });
    return () => c.setMap(null);
  }, [map, maps, me]);
  return null;
}

const toLL = ([lat, lng]: [number, number]) => ({ lat, lng });

/** Draws a Google Maps polygon or polyline and removes it when it changes. */
function Shape({ path, kind }: { path: [number, number][] | null; kind: "zone" | "route" }) {
  const map = useMap();
  const maps = useMapsLibrary("maps");
  const key = JSON.stringify(path);
  useEffect(() => {
    if (!map || !maps || !path) return;
    const shape =
      kind === "zone"
        ? new maps.Polygon({
            map,
            paths: path.map(toLL),
            strokeColor: "#b38900",
            strokeWeight: 2,
            fillColor: "#ffd23f",
            fillOpacity: 0.18,
            clickable: false,
          })
        : new maps.Polyline({
            map,
            path: path.map(toLL),
            strokeOpacity: 0,
            clickable: false,
            // Dotted line: Google draws dashes using repeated symbols.
            icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: "#1a2238", strokeWeight: 3, scale: 2 }, offset: "0", repeat: "10px" }],
          });
    return () => shape.setMap(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, maps, key, kind]);
  return null;
}

function Camera({ points, selected, visible }: { points: [number, number][]; selected: [number, number] | null; visible: boolean }) {
  const map = useMap();
  const core = useMapsLibrary("core");
  const key = JSON.stringify(points);
  useEffect(() => {
    if (!map || !core || !visible || !points.length) return;
    const b = new core.LatLngBounds();
    points.forEach((p) => b.extend(toLL(p)));
    map.fitBounds(b, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, core, key, visible]);
  useEffect(() => {
    if (!map || !selected || !visible) return;
    map.panTo(toLL(selected));
    if ((map.getZoom() ?? 0) < 16) map.setZoom(16);
  }, [map, selected, visible]);
  return null;
}

export default function GoogleMapView({ from, to, fits, ellipse, selectedId, onSelect, visible, focus, me, showNext = true }: Props) {
  const dark = useIsDark();
  const fromIsMe = from.id.startsWith("here@");
  const selected = fits.find((f) => f.place.id === selectedId);
  const selectedPos: [number, number] | null = selected ? [selected.place.lat, selected.place.lng] : null;
  const points: [number, number][] = [[from.lat, from.lng], [to.lat, to.lng], ...focus];

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <Map
        key={dark ? "dark" : "light"} // Google only reads the colour scheme when the map is created
        colorScheme={dark ? "DARK" : "LIGHT"}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID"}
        defaultCenter={{ lat: from.lat, lng: from.lng }}
        defaultZoom={15}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        className="h-full w-full"
      >
        <Camera points={points} selected={selectedPos} visible={visible} />
        <Shape path={ellipse} kind="zone" />
        <Shape
          path={selected ? [[from.lat, from.lng], [selected.place.lat, selected.place.lng], [to.lat, to.lng]] : null}
          kind="route"
        />

        {fits.map((f) => {
          const isSel = f.place.id === selectedId;
          const size = isSel ? 24 : f.fits ? 16 : 10;
          return (
            <AdvancedMarker
              key={f.place.id}
              position={{ lat: f.place.lat, lng: f.place.lng }}
              onClick={() => onSelect(f.place.id)}
              title={f.place.name}
              zIndex={isSel ? 1000 : f.fits ? 10 : 1}
            >
              <span
                style={{
                  display: "block",
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  border: "2px solid #fff",
                  background: f.fits ? PIN_COLOR[f.place.type] : "#9aa3b2",
                  opacity: f.fits ? 1 : 0.6,
                  boxShadow: "0 1px 3px rgba(26,34,56,.35)",
                }}
              />
            </AdvancedMarker>
          );
        })}

        <Accuracy me={me} />
        {me && (
          <AdvancedMarker position={{ lat: me.lat, lng: me.lng }} zIndex={2100} title="You are here">
            <span className="block h-4 w-4 rounded-full border-[3px] border-white bg-[#0b57d0] shadow" aria-label="You are here" />
          </AdvancedMarker>
        )}
        {[...(fromIsMe ? [] : [{ b: from, label: "You" }]), ...(showNext ? [{ b: to, label: "Next" }] : [])].map(({ b, label }, i) => (
          <AdvancedMarker key={b.id + i} position={{ lat: b.lat, lng: b.lng }} zIndex={2000}>
            <div className="flex items-center gap-1.5">
              <span className="block h-4 w-4 rounded-full border-[4px] border-ink bg-white" />
              <span className="rounded-md bg-slab px-1.5 py-0.5 text-[11px] font-bold text-on-slab">
                {label}: {b.name}
              </span>
            </div>
          </AdvancedMarker>
        ))}
      </Map>
    </APIProvider>
  );
}
