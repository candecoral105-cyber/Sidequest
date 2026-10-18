// My plans on the home screen: everything you've added, grouped by day.
"use client";
import Link from "next/link";
import { buildingById } from "@/data/buildings";
import { directionsUrl, removePlan, usePlans, type Plan } from "@/lib/plans";
import { shortDate, toHHMM } from "@/lib/time";
import GoogleMapsAttribution from "./GoogleMapsAttribution";
import { TYPE_COLOR } from "./PlaceCard";

export default function MyPlans() {
  const plans = usePlans();
  const byDate = plans.reduce<Record<string, Plan[]>>((acc, p) => ((acc[p.date] ??= []).push(p), acc), {});

  return (
    <section className="mt-8" aria-labelledby="my-plans">
      <h2 id="my-plans" className="font-display text-xl font-bold">My plans</h2>
      {plans.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Nothing yet. Open a gap and tap “Add to my day” on anything you like.</p>
      ) : (
        Object.entries(byDate).map(([date, list]) => (
          <div key={date} className="mt-3">
            <h3 className="text-sm font-bold text-ink-soft">{shortDate(date)}</h3>
            <ul className="mt-2 space-y-3">
              {list.map((p) => {
                const from = buildingById(p.fromId);
                const to = buildingById(p.toId);
                const map = `/explore?day=${p.day}&date=${p.date}&start=${p.gapStart}&end=${p.gapEnd}&from=${p.fromId}&to=${p.toId}&focus=${encodeURIComponent(p.placeId)}`;
                return (
                  <li key={p.id} className="rounded-2xl bg-card p-4 shadow-card">
                    <div className="flex items-start gap-3">
                      <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: TYPE_COLOR[p.type] }} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg font-bold leading-snug">{p.name}</p>
                        <p className="time text-sm">{toHHMM(p.startAt)}–{toHHMM(p.endAt)}</p>
                        {p.address && <p className="text-sm text-ink-soft">{p.address}</p>}
                      </div>
                    </div>
                    <p className="mt-2 flex justify-between gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
                      <span>Leave {from.name.split(" (")[0]} <b className="time">{toHHMM(p.leaveAt)}</b></span>
                      <span className="text-right">{p.toId === "none" ? "Done" : `Back at ${to.name.split(" (")[0]}`} by <b className="time">{toHHMM(p.backAt)}</b></span>
                    </p>
                    <div className="mt-2 flex gap-2 text-sm">
                      <a href={directionsUrl(p, from)} target="_blank" rel="noreferrer" className="flex-1 rounded-xl bg-action px-3 py-2 text-center font-bold text-on-action">
                        Directions
                      </a>
                      <Link href={map} className="flex-1 rounded-xl bg-paper px-3 py-2 text-center font-bold">
                        View on map
                      </Link>
                      <button onClick={() => removePlan(p.id)} className="flex-1 rounded-xl bg-paper px-3 py-2 font-bold" aria-label={`Remove ${p.name}`}>
                        Remove
                      </button>
                    </div>
                    {p.source === "google" && <GoogleMapsAttribution className="mt-2 text-right" />}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
