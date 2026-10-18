// Societies screen: upload a poster and publish an event for students whose gaps fit.
"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BUILDINGS, buildingById } from "@/data/buildings";
import { fileToSmallDataUrl } from "@/lib/image";
import { ALL_TAGS } from "@/lib/mood";
import { loadCommunity, saveCommunity, uniFromOrganiser } from "@/lib/places";
import { DAYS, shortDate, toMin } from "@/lib/time";
import type { Place } from "@/lib/types";

type Draft = {
  name: string;
  society: string;
  uni: string;
  date: string;
  open: string;
  close: string;
  address: string;
  price: number;
  tags: string[];
  nearId: string;
};

const EMPTY: Draft = { name: "", society: "", uni: "", date: "", open: "12:00", close: "13:00", address: "", price: 0, tags: [], nearId: "bush-house" };

export default function Societies() {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<Place[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setPublished(loadCommunity()), []);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function onPoster(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setStatus("Reading your poster with Gemini…");
    try {
      const image = await fileToSmallDataUrl(file);
      setPreview(image);
      const res = await fetch("/api/poster", { method: "POST", body: JSON.stringify({ image }) });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error ?? "Couldn't read that poster.");
        return;
      }
      setDraft((d) => ({
        ...d,
        ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== "" && v !== null)),
        tags: Array.isArray(data.tags) ? data.tags : d.tags,
      }));
      setStatus("Filled in from your poster. Check everything, then publish.");
    } catch (err) {
      // TypeError = no internet; SyntaxError = the server sent back an error page instead of an answer.
      const offline = err instanceof TypeError || err instanceof SyntaxError;
      setStatus(offline ? "Couldn't reach the server. Check your internet, or fill in the details by hand." : err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name || !draft.date) {
      setStatus("Add at least an event name and a date.");
      return;
    }
    if (!draft.open || !draft.close || toMin(draft.close) <= toMin(draft.open)) {
      setStatus("The end time needs to be after the start time.");
      return;
    }
    setBusy(true);
    // Find the venue on the map with Google; otherwise use the nearest campus building chosen below.
    let lat = buildingById(draft.nearId).lat;
    let lng = buildingById(draft.nearId).lng;
    if (draft.address) {
      try {
        const res = await fetch("/api/geocode", { method: "POST", body: JSON.stringify({ query: draft.address }) });
        if (res.ok) {
          const g = await res.json();
          lat = g.lat;
          lng = g.lng;
        }
      } catch {}
    }
    const day = new Date(`${draft.date}T12:00:00`).getDay();
    const ev: Place = {
      id: `community-${Date.now()}`,
      name: draft.name,
      type: "event",
      uni: draft.uni || uniFromOrganiser(draft.society), // "KCL Chess Society" -> KCL if they left it blank
      society: draft.society || null,
      day,
      dates: [draft.date], // a one-off event: only on the day it happens, not every week
      open: draft.open,
      close: draft.close,
      lat,
      lng,
      price: Number(draft.price) || 0,
      tags: draft.tags.length ? draft.tags : ["social"],
      minutesNeeded: Math.max(20, Math.min(90, toMin(draft.close) - toMin(draft.open))),
      address: draft.address,
      link: "",
      deal: null,
      source: "community",
    };
    const next = [...published, ev];
    saveCommunity(next);
    setPublished(next);
    setDraft(EMPTY);
    setPreview(null);
    setBusy(false);
    setStatus(`Published "${ev.name}". It now shows for anyone with a free gap on ${shortDate(draft.date)}.`);
  }

  function remove(id: string) {
    const next = published.filter((p) => p.id !== id);
    saveCommunity(next);
    setPublished(next);
  }

  const input = "rounded-lg border border-rail bg-card p-2";

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-6">
      <Link href="/" className="text-sm underline">Back to my day</Link>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Add your society event</h1>
      <p className="mt-1 text-ink-soft">
        Upload your poster and we&apos;ll fill in the details. Students whose free time fits will see it.
      </p>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPoster} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="mt-5 w-full rounded-xl bg-action px-4 py-4 font-bold text-on-action disabled:opacity-60"
      >
        {busy ? "Working…" : "Upload event poster"}
      </button>
      {status && <p className="mt-3 rounded-xl bg-card p-3 text-sm" role="status">{status}</p>}
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Your poster" className="mt-3 max-h-64 w-full rounded-xl object-contain" />
      )}

      <form onSubmit={publish} className="mt-5 space-y-3 rounded-2xl bg-card p-4 text-sm shadow-card">
        <label className="flex flex-col gap-1">Event name<input className={input} value={draft.name} onChange={(e) => set("name", e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">Society<input className={input} value={draft.society} onChange={(e) => set("society", e.target.value)} /></label>
          <label className="flex flex-col gap-1">University
            <select className={input} value={draft.uni} onChange={(e) => set("uni", e.target.value)}>
              <option value="">Choose</option><option>KCL</option><option>UCL</option><option>Imperial</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-1">Date<input type="date" className={input} value={draft.date} onChange={(e) => set("date", e.target.value)} /></label>
          <label className="flex flex-col gap-1">Starts<input type="time" className={input} value={draft.open} onChange={(e) => set("open", e.target.value)} /></label>
          <label className="flex flex-col gap-1">Ends<input type="time" className={input} value={draft.close} onChange={(e) => set("close", e.target.value)} /></label>
          <label className="col-span-2 flex flex-col gap-1">Price £ (0 if free)<input type="number" min={0} className={input} value={draft.price} onChange={(e) => set("price", Number(e.target.value))} /></label>
        </div>
        <label className="flex flex-col gap-1">Venue<input className={input} value={draft.address} onChange={(e) => set("address", e.target.value)} placeholder="e.g. Bush House, room 2.01" /></label>
        <label className="flex flex-col gap-1">Nearest campus building (used if we can&apos;t find the venue)
          <select className={input} value={draft.nearId} onChange={(e) => set("nearId", e.target.value)}>
            {BUILDINGS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <fieldset>
          <legend className="mb-1">Good for</legend>
          <div className="flex flex-wrap gap-2">
            {ALL_TAGS.map((t) => {
              const on = draft.tags.includes(t);
              return (
                <button type="button" key={t} aria-pressed={on}
                  onClick={() => set("tags", on ? draft.tags.filter((x) => x !== t) : [...draft.tags, t])}
                  className={`rounded-full px-3 py-1.5 font-bold ${on ? "bg-action text-on-action" : "bg-paper"}`}>
                  {t}
                </button>
              );
            })}
          </div>
        </fieldset>
        <button disabled={busy} className="w-full rounded-xl bg-action px-4 py-3 font-bold text-on-action disabled:opacity-60">Publish event</button>
      </form>

      {published.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold">Published events</h2>
          <ul className="mt-2 space-y-2">
            {published.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-card p-3 text-sm">
                <span><b>{p.name}</b><br />{p.dates?.[0] ? shortDate(p.dates[0]) : p.day !== null && DAYS[p.day]} {p.open}–{p.close}</span>
                <button onClick={() => remove(p.id)} className="font-bold underline">Remove</button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">For the demo, published events are saved in this browser.</p>
        </section>
      )}
    </main>
  );
}
