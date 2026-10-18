// Shared data shapes: places, classes, gaps and filters.
export type PlaceType = "event" | "cafe" | "study" | "activity" | "deal";

export type Place = {
  id: string;
  name: string;
  type: PlaceType;
  uni: string | null;
  society: string | null;
  day: number | null; // 0 = Sunday ... 6 = Saturday; null = every day
  // Optional real dates (all "YYYY-MM-DD"). If any are set, they decide which days it's on:
  dates?: string[]; // one-off events: the exact dates
  dateFrom?: string; // ranges, e.g. an exhibition (either end can be missing)
  dateTo?: string;
  days?: number[]; // recurring weekdays, e.g. [1,2,3,4,5] for "Mon to Fri"
  open: string; // "HH:MM" (for events: start time)
  close: string; // "HH:MM" (for events: end time)
  lat: number;
  lng: number;
  price: number; // £, 0 = free
  tags: string[];
  minutesNeeded: number;
  address: string;
  link: string;
  deal: string | null;
  source?: "ours" | "google" | "community";
  mapsUrl?: string; // Google Maps link (imported places)
  live?: boolean; // fetched from Google just now for this gap (/api/places), not from the saved snapshot
};

export type ClassBlock = {
  id: string;
  title: string;
  day: number; // 0-6
  start: string; // "HH:MM", UK time
  end: string;
  buildingId: string | null; // null = location unknown (tap it to pick the building)
  date?: string; // "YYYY-MM-DD" for calendar imports; weekly timetables (sample, screenshot) have none
  seriesId?: string; // same for every repeat of one event (e.g. a weekly lecture), so choices apply to all
  location?: string; // the location text from the calendar
  manualId?: string; // set on classes you added by hand: the id of the saved class (one entry for every week it repeats)
};

export type Gap = {
  day: number;
  date?: string; // "YYYY-MM-DD"; if missing, the next date that falls on `day`
  start: string;
  end: string;
  fromId: string; // building you're leaving (also the fallback when your location isn't available)
  fromPoint?: { lat: number; lng: number }; // "Use my location": start from here instead of the building
  toPoint?: { lat: number; lng: number }; // destination given as a point (e.g. "back to where I am")
  // toId "none": you're done for the day, so there's no trip back; things only need to finish by `end`.
  toId: string; // building of the next class
};

export type Filters = {
  tags: string[];
  types: string[];
  maxPrice: number | null; // null = any
  unis: string[];
};

export type MoodFilters = {
  tags: string[];
  types: string[];
  maxPrice: number | null;
  summary: string;
  primaryTag?: string | null; // the ONE tag that matters most (ranked first)
  required?: string[]; // tags or types the words clearly name ("sports" -> sport); places without one don't match
};
