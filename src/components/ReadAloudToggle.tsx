// The Read aloud switch (home screen and Explore header).
"use client";
import { setReadAloud, speak, useReadAloud } from "@/lib/voice";

export default function ReadAloudToggle({ dark = false, hint }: { dark?: boolean; hint?: string }) {
  const on = useReadAloud();
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span>
        <span className={`block font-bold ${dark ? "text-sm text-on-slab" : ""}`}>Read aloud</span>
        {hint && <span className="block text-sm text-ink-soft">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-label="Read aloud"
        checked={on}
        onChange={(e) => {
          setReadAloud(e.target.checked);
          if (e.target.checked) speak("Read aloud is on.");
        }}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-study after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:transition-transform peer-checked:after:translate-x-5 ${
          dark ? "bg-on-slab/25 peer-checked:bg-on-slab after:bg-on-slab peer-checked:after:bg-slab" : "bg-rail peer-checked:bg-action after:bg-white peer-checked:after:bg-on-action"
        }`}
      />
    </label>
  );
}
