// Light or dark look: follows the phone's setting unless you pick one, and is remembered on this device.
"use client";
import { useSyncExternalStore } from "react";

export type ThemeChoice = "auto" | "light" | "dark";
const KEY = "sq-theme-v1"; // also read by the start-up script in layout.tsx
const listeners = new Set<() => void>();

function getChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

/** Puts the chosen look on the page (the same rule the start-up script in layout.tsx uses). */
function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "auto" && systemDark());
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {}
  apply(choice);
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  // "Auto" follows the phone switching between light and dark while the app is open.
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (getChoice() === "auto") apply("auto");
    fn();
  };
  mq.addEventListener("change", onSystem);
  return () => {
    listeners.delete(fn);
    mq.removeEventListener("change", onSystem);
  };
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, getChoice, () => "auto");
}

/** Whether the page is dark right now (for the map tiles, which can't read CSS colours). */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme === "dark",
    () => false,
  );
}

