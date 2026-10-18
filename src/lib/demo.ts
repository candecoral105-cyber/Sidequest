// Demo mode: only our saved data, no live Google places (?demo=1 turns it on, ?demo=0 off).
"use client";

// For presenting on bad Wi-Fi. It's remembered on this device.
const KEY = "sq-demo-mode-v1";

export function readDemoMode(param: string | null): boolean {
  try {
    if (param === "1" || param === "0") localStorage.setItem(KEY, param);
    return localStorage.getItem(KEY) === "1";
  } catch {
    return param === "1";
  }
}
