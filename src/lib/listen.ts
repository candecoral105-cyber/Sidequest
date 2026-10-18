// The mic: ElevenLabs speech-to-text (key stays on the server), or the browser's own recognition as a fallback.
"use client";
import { elevenLabsReady, fallBackToBrowserVoice } from "./voice";

type Recognition = { lang: string; interimResults: boolean; start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

function browserRecognition(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

const hasRecorder = () => typeof navigator.mediaDevices?.getUserMedia === "function" && "MediaRecorder" in window;

export const canListen = () =>
  typeof window !== "undefined" && (hasRecorder() || Boolean(browserRecognition()));

export type Listener = { stop: () => void; cancel: () => void };
const MAX_RECORD_MS = 15000;

/** Call stop() to finish; `done` gets the words ("" if nothing was heard). */
export async function listen(done: (text: string) => void, onError: (msg: string) => void): Promise<Listener> {
  const useEleven = (await elevenLabsReady()) && hasRecorder();
  if (!useEleven) return listenWithBrowser(done, onError);

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    onError("Microphone access was blocked. Allow it in your browser settings, or type instead.");
    return { stop() {}, cancel() {} };
  }
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  let cancelled = false;
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    clearTimeout(timer);
    if (cancelled) return;
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    if (blob.size === 0) return done("");
    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    const form = new FormData();
    form.append("file", blob, `speech.${ext}`);
    try {
      const res = await fetch("/api/stt", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      done(data.text ?? "");
    } catch {
      onError(browserRecognition() ? "Couldn't catch that. Tap the mic and try again." : "Couldn't catch that. Try typing instead.");
      fallBackToBrowserVoice(); // use the browser's recognition for the next try
    }
  };
  recorder.start();
  const timer = setTimeout(() => recorder.state === "recording" && recorder.stop(), MAX_RECORD_MS);
  return {
    stop: () => recorder.state === "recording" && recorder.stop(),
    cancel: () => {
      cancelled = true;
      if (recorder.state === "recording") recorder.stop();
    },
  };
}

function listenWithBrowser(done: (text: string) => void, onError: (msg: string) => void): Listener {
  const rec = browserRecognition();
  if (!rec) {
    onError("Voice input isn't available in this browser. Try typing instead.");
    return { stop() {}, cancel() {} };
  }
  let heard = "";
  let cancelled = false;
  rec.lang = "en-GB";
  rec.interimResults = false;
  rec.onresult = (e) => {
    heard = Array.from(e.results).map((r) => r[0].transcript).join(" ");
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed") onError("Microphone access was blocked. Allow it in your browser settings, or type instead.");
  };
  rec.onend = () => !cancelled && done(heard.trim());
  rec.start();
  return {
    stop: () => rec.stop(),
    cancel: () => {
      cancelled = true;
      rec.abort();
    },
  };
}

