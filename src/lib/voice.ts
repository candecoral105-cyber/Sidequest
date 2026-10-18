// Read aloud: ElevenLabs voice or the browser's, and only ever when the Read aloud setting is on.
"use client";
import { useSyncExternalStore } from "react";
import type { Fit } from "./fit";
import { toHHMM } from "./time";

// Everything that talks goes through speak(), which checks the setting first.

const READ_ALOUD_KEY = "sq-read-aloud-v1";
const settingListeners = new Set<() => void>();

function getReadAloud() {
  try {
    return localStorage.getItem(READ_ALOUD_KEY) === "1";
  } catch {
    return false;
  }
}

/** Turns reading aloud on or off everywhere. Turning it off stops anything playing straight away. */
export function setReadAloud(on: boolean) {
  try {
    localStorage.setItem(READ_ALOUD_KEY, on ? "1" : "0");
  } catch {}
  if (!on) stopSpeaking();
  settingListeners.forEach((l) => l());
}

function subscribeReadAloud(fn: () => void) {
  settingListeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== READ_ALOUD_KEY) return;
    if (!getReadAloud()) stopSpeaking(); // switched off in another tab
    fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    settingListeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function useReadAloud() {
  return useSyncExternalStore(subscribeReadAloud, getReadAloud, () => false);
}

let statusPromise: Promise<boolean> | null = null;
export function elevenLabsReady() {
  statusPromise ??= fetch("/api/voice")
    .then((r) => r.json())
    .then((d) => Boolean(d.elevenlabs))
    .catch(() => false);
  return statusPromise;
}

/** After ElevenLabs fails once, use the browser's own speech for the rest of the visit. */
export function fallBackToBrowserVoice() {
  statusPromise = Promise.resolve(false);
}

let current: { audio?: HTMLAudioElement; url?: string; ctrl?: AbortController } | null = null;
const listeners = new Set<(speaking: boolean) => void>();
const setSpeaking = (on: boolean) => listeners.forEach((l) => l(on));

/** Lets a component show a "Stop" button while something is being read out. */
export function onSpeakingChange(fn: (speaking: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function stopSpeaking() {
  if (current) {
    current.ctrl?.abort();
    current.audio?.pause();
    if (current.url) URL.revokeObjectURL(current.url);
    current = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  setSpeaking(false);
}

function browserSpeak(text: string) {
  if (!("speechSynthesis" in window)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    u.voice = voices.find((v) => v.lang === "en-GB") ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
    u.rate = 1;
    u.onend = u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

/** ElevenLabs voice, or the browser's if that fails. Does nothing while "Read aloud" is off. */
export async function speak(text: string) {
  if (!getReadAloud()) return;
  stopSpeaking();
  const mine = { ctrl: new AbortController() } as NonNullable<typeof current>;
  current = mine;
  setSpeaking(true);
  try {
    if (await elevenLabsReady()) {
      try {
        const res = await fetch("/api/tts", { method: "POST", body: JSON.stringify({ text }), signal: mine.ctrl!.signal });
        if (!res.ok) throw new Error(`tts ${res.status}`);
        const url = URL.createObjectURL(await res.blob());
        if (current !== mine) return URL.revokeObjectURL(url);
        const audio = new Audio(url);
        Object.assign(mine, { audio, url });
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onpause = () => resolve();
          audio.onerror = () => reject(new Error("audio failed"));
          audio.play().catch(reject);
        });
        return;
      } catch {
        if (current !== mine) return; // stopped on purpose
      }
    }
    if (current === mine && getReadAloud()) await browserSpeak(text);
  } finally {
    if (current === mine) {
      if (mine.url) URL.revokeObjectURL(mine.url);
      current = null;
      setSpeaking(false);
    }
  }
}

/** "3 hours 10 minutes" rather than "3h 10m", so voices read it naturally. */
function spokenDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  const hs = h === 1 ? "1 hour" : `${h} hours`;
  const ms = m === 1 ? "1 minute" : `${m} minutes`;
  if (h === 0) return ms;
  return m === 0 ? hs : `${hs} ${ms}`;
}

const away = (walk: number) => (walk <= 1 ? "one minute away" : `${walk} minutes away`);
const price = (p: number) => (p === 0 ? "free" : `${p} pounds`);
const sentence = (s: string) => (s && !/[.!?]$/.test(s.trim()) ? `${s.trim()}.` : s.trim());

export function cardSpeech(f: Fit, reason?: string) {
  const p = f.place;
  if (!f.fits) return `${p.name}. ${sentence(f.reason ?? "Doesn't fit this gap")}`;
  const what = p.type === "event" ? `on from ${p.open} to ${p.close}` : `about ${p.minutesNeeded} minutes there`;
  return [
    `${p.name}${p.society ? `, run by ${p.society}` : ""}, ${away(f.walkThere)}${f.thereBy === "transit" ? " by Tube or bus" : ""}, ${price(p.price)}, ${what}.`,
    reason ? sentence(reason) : "",
    `Leave at ${toHHMM(f.leaveAt)} and you're ${f.noReturn ? "done" : "back"} by ${toHHMM(f.backAt)}.`,
  ].filter(Boolean).join(" ");
}

export function topPicksSpeech(minutesLeft: number, top: Fit[], reasons: Record<string, string | undefined>) {
  if (top.length === 0) return `You've got ${spokenDuration(minutesLeft)}, but nothing matches right now. Try another search or remove a filter.`;
  const labels = ["Top pick", "Next", "And"];
  const parts = top.map((f, i) => `${labels[i]}: ${cardSpeech(f, reasons[f.place.id])}`);
  return `You've got ${spokenDuration(minutesLeft)}. ${parts.join(" ")}`;
}
