// OpenStreetMap version of the Explore map (Leaflet), used when there's no Google key.
"use client";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type L from "leaflet";
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
  focus: [number, number][]; // points the map should zoom to show
  me?: Position | null; // your live location (blue dot)
  showNext?: boolean; // false when you're done for the day (no next place)
};

// Leaflet can't move a map that's hidden (zero size), so every move checks first.
const isVisible = (map: L.Map) => map.getSize().x > 0 && map.getSize().y > 0;

function FlyTo({ target, visible }: { target: [number, number] | null; visible: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (target && visible && isVisible(map)) map.flyTo(target, Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [target, map, visible]);
  return null;
}

function FitBounds({ points, visible }: { points: [number, number][]; visible: boolean }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (!visible) return;
    // Wait a frame so the map knows its real size after being shown.
    const id = requestAnimationFrame(() => {
      map.invalidateSize();
      if (points.length && isVisible(map)) map.fitBounds(points, { padding: [30, 30], maxZoom: 16 });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, visible]);
  return null;
}

export default function LeafletMapView({ from, to, fits, ellipse, selectedId, onSelect, visible, focus, me, showNext = true }: Props) {
  const dark = useIsDark();
  const fromIsMe = from.id.startsWith("here@");
  const selected = fits.find((f) => f.place.id === selectedId);
  const boundsPts: [number, number][] = [[from.lat, from.lng], [to.lat, to.lng], ...focus];

  return (
    <MapContainer center={[from.lat, from.lng]} zoom={15} className="h-full w-full" zoomControl={false}>
      <TileLayer
        key={dark ? "dark" : "light"}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        url={`https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`}
      />
      <FitBounds points={boundsPts} visible={visible} />
      <FlyTo target={selected ? [selected.place.lat, selected.place.lng] : null} visible={visible} />

      {/* Reach zone: an ellipse with your current and next building as the two foci */}
      {ellipse && (
        <Polygon
          positions={ellipse}
          pathOptions={{ color: "#b38900", weight: 2, dashArray: "6 6", fillColor: "#ffd23f", fillOpacity: 0.18 }}
        />
      )}

      {selected && (
        <Polyline
          positions={[[from.lat, from.lng], [selected.place.lat, selected.place.lng], [to.lat, to.lng]]}
          pathOptions={{ color: "#1a2238", weight: 3, dashArray: "2 8", lineCap: "round" }}
        />
      )}

      {fits.map((f) => {
        const isSel = f.place.id === selectedId;
        return (
          <CircleMarker
            key={f.place.id}
            center={[f.place.lat, f.place.lng]}
            radius={isSel ? 12 : f.fits ? 8 : 5}
            eventHandlers={{ click: () => onSelect(f.place.id) }}
            pathOptions={{
              color: "#fff",
              weight: 2,
              fillColor: f.fits ? PIN_COLOR[f.place.type] : "#9aa3b2",
              fillOpacity: f.fits ? 1 : 0.5,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>{f.place.name}</Tooltip>
          </CircleMarker>
        );
      })}

      {me && (
        <>
          <Circle center={[me.lat, me.lng]} radius={me.accuracy} pathOptions={{ color: "#0b57d0", weight: 1, fillColor: "#0b57d0", fillOpacity: 0.12 }} />
          <CircleMarker center={[me.lat, me.lng]} radius={8} pathOptions={{ color: "#fff", weight: 3, fillColor: "#0b57d0", fillOpacity: 1 }}>
            <Tooltip direction="left" offset={[-8, 0]} permanent>You are here</Tooltip>
          </CircleMarker>
        </>
      )}

      {[...(fromIsMe ? [] : [{ b: from, label: "You" }]), ...(showNext ? [{ b: to, label: "Next" }] : [])].map(({ b, label }, i) => (
        <CircleMarker
          key={b.id + i}
          center={[b.lat, b.lng]}
          radius={9}
          pathOptions={{ color: "#1a2238", weight: 5, fillColor: "#fff", fillOpacity: 1 }}
        >
          <Tooltip permanent direction={label === "You" ? "left" : "right"} offset={[label === "You" ? -8 : 8, 0]}>
            {label}: 
            {b.name}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
