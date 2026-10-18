// Filter chips on the Explore screen: type, price, university and more.
"use client";
import { useState } from "react";
import { ALL_TAGS } from "@/lib/mood";
import { OPEN_TO_ALL, UNIS } from "@/lib/places";
import type { Filters } from "@/lib/types";

const TYPE_CHIPS = [
  { id: "event", label: "Events" },
  { id: "cafe", label: "Cafés" },
  { id: "study", label: "Study" },
  { id: "activity", label: "Activities" },
  { id: "deal", label: "Deals" },
];
const PRICE_CHIPS: { label: string; value: number | null }[] = [
  { label: "Any price", value: null },
  { label: "Free", value: 0 },
  { label: "Under £5", value: 5 },
];
export const UNI_CHIPS = [...UNIS, OPEN_TO_ALL];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${on ? "bg-action text-on-action" : "bg-card text-ink"}`}
    >
      {children}
    </button>
  );
}

type Props = {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  uniCounts: Record<string, number>;
  types: Set<string>; // place types that exist, so a chip never filters down to nothing
};

export default function FilterChips({ filters, setFilters, uniCounts, types }: Props) {
  const [more, setMore] = useState(false);
  const toggle = (key: "tags" | "types" | "unis", v: string) =>
    setFilters((f) => ({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] }));
  const row = "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  return (
    <>
      <div className={row}>
        {TYPE_CHIPS.filter((c) => types.has(c.id)).map((c) => (
          <Chip key={c.id} on={filters.types.includes(c.id)} onClick={() => toggle("types", c.id)}>
            {c.label}
          </Chip>
        ))}
      </div>
      <div className={row}>
        {PRICE_CHIPS.map((c) => (
          <Chip key={c.label} on={filters.maxPrice === c.value} onClick={() => setFilters((f) => ({ ...f, maxPrice: c.value }))}>
            {c.label}
          </Chip>
        ))}
        {UNI_CHIPS.map((u) => (
          <Chip key={u} on={filters.unis.includes(u)} onClick={() => toggle("unis", u)}>
            {u} ({uniCounts[u]})
          </Chip>
        ))}
      </div>
      <button onClick={() => setMore((m) => !m)} aria-expanded={more} className="text-sm font-bold underline">
        {more ? "Fewer filters" : `More filters${filters.tags.length ? ` (${filters.tags.length})` : ""}`}
      </button>
      {more && (
        <div className={row}>
          {ALL_TAGS.filter((t) => t !== "free").map((t) => (
            <Chip key={t} on={filters.tags.includes(t)} onClick={() => toggle("tags", t)}>
              {t}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
}
