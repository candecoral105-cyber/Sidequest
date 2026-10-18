// Campus buildings and stations, with their map positions and the names timetables use for them.
// lat/lng: right-click the spot in Google Maps and copy the coordinates.
export type Building = {
  id: string;
  name: string;
  uni: "KCL" | "UCL" | "Imperial" | "Other";
  lat: number;
  lng: number;
  aliases?: string[]; // words that might appear in a timetable "location" field
};

export const BUILDINGS: Building[] = [
  { id: "bush-house", name: "Bush House", uni: "KCL", lat: 51.5129, lng: -0.1174, aliases: ["bush house", "bh"] },
  { id: "strand", name: "Strand Building", uni: "KCL", lat: 51.5115, lng: -0.116, aliases: ["strand", "king's building", "kings building"] },
  { id: "waterloo", name: "Franklin-Wilkins (Waterloo)", uni: "KCL", lat: 51.5036, lng: -0.1135, aliases: ["franklin", "waterloo", "fwb"] },
  { id: "guys", name: "Guy's Campus", uni: "KCL", lat: 51.5033, lng: -0.0873, aliases: ["guy's", "guys", "london bridge"] },
  { id: "ucl-main", name: "UCL Main Building", uni: "UCL", lat: 51.5246, lng: -0.134, aliases: ["ucl", "gower", "wilkins", "main building"] },
  { id: "senate-house", name: "Senate House", uni: "Other", lat: 51.5207, lng: -0.1287, aliases: ["senate"] },
  { id: "imperial-sk", name: "Imperial South Kensington", uni: "Imperial", lat: 51.4988, lng: -0.1749, aliases: ["imperial", "south kensington", "skempton", "huxley", "sherfield"] },
];

export const STATIONS: Building[] = [
  { id: "stn-waterloo", name: "Waterloo station", uni: "Other", lat: 51.5031, lng: -0.1132 },
  { id: "stn-london-bridge", name: "London Bridge station", uni: "Other", lat: 51.5048, lng: -0.0865 },
  { id: "stn-kings-cross", name: "King's Cross station", uni: "Other", lat: 51.5308, lng: -0.1238 },
  { id: "stn-victoria", name: "Victoria station", uni: "Other", lat: 51.4952, lng: -0.1441 },
  { id: "stn-liverpool-street", name: "Liverpool Street station", uni: "Other", lat: 51.5178, lng: -0.0823 },
];

/** Special destinations: "none" = done for the day (no trip back), "here" = back to where you started. */
export const NOWHERE = "none";
export const HERE = "here";

export function buildingById(id: string): Building {
  return BUILDINGS.find((b) => b.id === id) ?? STATIONS.find((b) => b.id === id) ?? BUILDINGS[0];
}

// null when nothing matches, so the app says "Location unknown" instead of guessing.
// Aliases match whole words only, so "bh" doesn't match "Bhangra".
export function matchBuilding(text: string | undefined): Building | null {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return null;
  const word = (a: string) => new RegExp(`(^|[^a-z])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z])`).test(t);
  for (const b of BUILDINGS) {
    if (b.aliases?.some(word) || t.includes(b.name.toLowerCase())) return b;
  }
  return null;
}
