// Every place we show: our events, society events and the Google snapshot, plus university helpers.
import googlePlaces from "@/data/google-places.json";
import ourPlaces from "@/data/places.json";
import type { Place } from "./types";

export const UNIS = ["KCL", "UCL", "Imperial"] as const;
export const OPEN_TO_ALL = "Open to all";

/** Which university runs it, from the organiser's name. "KCL Barbell Club" -> KCL, "UCL Museums Society" -> UCL. */
export function uniFromOrganiser(text: string | null | undefined): string | null {
  const t = text ?? "";
  if (/\bKCL|KCLSU|King['’]s|Guy['’]s/i.test(t)) return "KCL";
  if (/\bUCL\b/i.test(t)) return "UCL";
  if (/Imperial/i.test(t)) return "Imperial";
  return null;
}

/** Fills in the university from the organiser if it's missing. */
const withUni = (p: Place): Place => (p.uni ? p : { ...p, uni: uniFromOrganiser(p.society) });

/** Run by someone other than a university (a museum, the Crick, Royal Parks...). Google-imported venues don't count. */
export const isOpenToAll = (p: Place) => !p.uni && Boolean(p.society) && p.source !== "google";

const COMMUNITY_KEY = "mtg-community-events-v1";

export function loadCommunity(): Place[] {
  try {
    return (JSON.parse(localStorage.getItem(COMMUNITY_KEY) ?? "[]") as Place[]).map(withUni);
  } catch {
    return [];
  }
}

export function saveCommunity(list: Place[]) {
  try {
    localStorage.setItem(COMMUNITY_KEY, JSON.stringify(list));
  } catch {}
}

export function staticPlaces(): Place[] {
  const ours = (ourPlaces as Place[]).map(withUni);
  const names = new Set(ours.map((p) => p.name.toLowerCase()));
  const fromGoogle = (googlePlaces as Place[]).filter((p) => !names.has(p.name.toLowerCase()));
  return [...ours, ...fromGoogle];
}
