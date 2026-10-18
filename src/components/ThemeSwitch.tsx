// Light and dark: a quick sun/moon button for the header, and an Auto / Light / Dark choice for the settings.
"use client";
import { setTheme, useIsDark, useThemeChoice, type ThemeChoice } from "@/lib/theme";

const Sun = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
  </svg>
);
const Moon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
);

/** One tap flips between light and dark (and remembers it). */
export function ThemeButton() {
  const dark = useIsDark();
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-ink shadow-card"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}

/** Auto follows the phone's own setting. */
export function ThemeChoices() {
  const choice = useThemeChoice();
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-bold">Appearance</span>
      <div className="flex rounded-full bg-paper p-1 text-sm" role="radiogroup" aria-label="Appearance">
        {(["auto", "light", "dark"] as ThemeChoice[]).map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={choice === c}
            onClick={() => setTheme(c)}
            className={`press rounded-full px-3 py-1.5 font-bold capitalize ${choice === c ? "bg-action text-on-action" : "text-ink-soft hover:text-ink"}`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
