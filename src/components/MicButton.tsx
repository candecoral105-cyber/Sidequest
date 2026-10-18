// Mic button next to the mood search: say how you feel instead of typing.
"use client";
import { useEffect, useRef, useState } from "react";
import { canListen, listen, type Listener } from "@/lib/listen";
import { stopSpeaking } from "@/lib/voice";

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

// Tap to start and tap again to stop, or hold while talking and let go.
export default function MicButton({ onText, onError, disabled }: { onText: (t: string) => void; onError: (m: string) => void; disabled: boolean }) {
  const [state, setState] = useState<"idle" | "listening" | "working">("idle");
  const listener = useRef<Listener | null>(null);
  const stopWhenReady = useRef(false);
  const downAt = useRef(0);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(canListen());
    return () => listener.current?.cancel();
  }, []);
  // Keep the space while we check, so the search box doesn't jump sideways when the mic appears.
  if (!supported) return <span className="w-11 shrink-0" aria-hidden />;

  async function start() {
    stopSpeaking();
    stopWhenReady.current = false;
    setState("listening");
    listener.current = await listen(
      (text) => {
        listener.current = null;
        setState("idle");
        if (text) onText(text);
        else onError("Didn't catch anything. Tap the mic and try again.");
      },
      (msg) => {
        listener.current = null;
        setState("idle");
        onError(msg);
      },
    );
    if (stopWhenReady.current) finish();
  }
  function finish() {
    if (!listener.current) {
      stopWhenReady.current = true;
      return;
    }
    setState("working");
    listener.current.stop();
  }

  return (
    <button
      type="button"
      disabled={disabled || state === "working"}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        downAt.current = Date.now();
        if (state === "idle") start();
        else if (state === "listening") finish();
      }}
      onPointerUp={() => {
        if (state === "listening" && Date.now() - downAt.current > 400) finish();
      }}
      onClick={(e) => {
        if (e.detail !== 0) return; // keyboard (Enter/Space) toggles
        if (state === "idle") start();
        else if (state === "listening") finish();
      }}
      aria-label={state === "listening" ? "Stop recording" : "Speak how you feel"}
      aria-pressed={state === "listening"}
      className={`grid w-11 shrink-0 touch-none select-none place-items-center rounded-xl disabled:opacity-60 ${
        state === "listening" ? "animate-pulse bg-event text-on-action" : "border border-rail bg-card text-ink"
      }`}
    >
      {state === "working" ? "…" : <MicIcon />}
    </button>
  );
}
