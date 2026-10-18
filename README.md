# SideQuest

Turn the gaps between your classes into something worth doing, and still make it back on time.

## The problem

A lot of us at KCL, UCL and Imperial commute, and our timetables are full of long gaps: two or three hours between a
morning lecture and an afternoon lab, sometimes on a different campus. Going home isn't worth it, so most of that time
gets spent waiting around in a corridor or the library café. There are society events, free museums, study spaces and
sports sessions all around us, but in the moment it's hard to know which ones you could actually get to and back from
before your next class.

## Our solution

SideQuest reads your timetable, finds your free gaps, and for each gap shows only the things that fit: society events
from the three universities, cafés, study spots, museums, parks and sport. Every suggestion tells you when to leave and
when you'll be back, and a map shows how far you can go. The idea is to make the first step into campus life easier
for people who usually just wait between classes.

## Main features

- Import your timetable from a university calendar file (.ics), a screenshot (read by Gemini), or add classes by hand
- Your week drawn like a Tube line: classes are stations, free gaps are the yellow platform edge
- For each gap, only places and events that fit, with leave and back-by times
- A map with the "reach zone", which shrinks as you slide the time forward
- Mood search ("tired and broke", "want to meet people"), typed or spoken
- Walking or walking plus Tube/bus, from a campus building or your live location
- Filters for type, price and university (KCL, UCL, Imperial, open to all)
- "Add to my day" to plan stops inside a gap, with clash warnings
- A page for societies to upload an event poster, which Gemini turns into a listing
- Places near you come live from Google Places, on top of our saved list (add `?demo=1` to the Explore address to use
  only the saved list, which helps on bad Wi-Fi)
- An optional Read aloud mode that reads the top picks out loud (off by default)
- Light and dark mode (follows your phone, or pick one with the sun/moon button)

## Tracks

- Main track: Society, "The First Step"
- Side tracks: ElevenLabs, Gemini API, Best Domain (GoDaddy Registry) 

## How it works

Something only counts as fitting if the trip there, plus the time it needs, plus the trip to your next class, plus a
5-minute buffer, is less than the time left in the gap. The map draws this as an ellipse whose two focus points are
where you are now and where your next class is: an ellipse is exactly the set of points whose distances to the two
foci add up to at most a fixed amount, which here is your travel budget. If you're done for the day there's no trip
back, so the zone becomes a circle around you. Moving the "Pretend it's..." slider shrinks the zone as the gap runs out.

## Project structure

```
src/app                      pages and server routes
  page.tsx                   home screen (My day): your week, timeline, plans, timetable upload
  explore/page.tsx           Explore screen: what fits the chosen gap, as a list and a map
  societies/page.tsx         page for societies to upload a poster and publish an event
  layout.tsx, globals.css    fonts, colours and shared styles
  api/                       server routes, so API keys never reach the browser
    mood, reasons            Gemini: mood search and a reason for each top pick
    timetable, poster        Gemini: reading timetable screenshots and event posters
    places, travel, geocode  Google: live places, Tube/bus times, finding a venue
    stt, tts, voice          ElevenLabs: speech to text, text to speech, is voice set up
src/components               reusable pieces of the screens (timeline, place card, map, filters, forms)
src/lib                      the logic
  fit.ts                     the fit rule, filters and ranking
  geo.ts                     walking and Tube/bus estimates, the reach ellipse and circle
  timetable.ts, calendar.ts  finding gaps, the sample week, and .ics import
  gemini.ts, elevenlabs.ts   calling Gemini and ElevenLabs from the server
  voice.ts, listen.ts        Read aloud and the mic in the browser
  storage.ts, plans.ts       saving your timetable, settings and plans on your device
  livePlaces.ts, places.ts   live Google places, and merging all our place data
src/data
  places.json                our hand-collected society events and spots
  google-places.json         a saved snapshot of cafés, libraries, parks, museums and sport from Google Places
  buildings.ts               campus buildings and stations with their map positions
public                       images (the screenshot above)
scripts/import-google-places.mjs   refreshes google-places.json from Google Places
```

## Running it locally

You need Node.js (the LTS version from nodejs.org).

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open http://localhost:3000. The app works without any API keys: it falls back to an OpenStreetMap map, estimated
travel times, keyword mood search and the browser's own voice. Only run one copy of `npm run dev` at a time, because two
copies share the `.next` folder and break each other.

Other commands: `npm run build` (production build), `npm run lint` (checks the code), and `npm run import-places`
(refreshes the saved Google places, needs a Google key).

## Environment variables

Put these in `.env.local`, which is never uploaded. `.env.example` explains where to get each key.

| Variable | What it's for |
|---|---|
| `GEMINI_API_KEY` | Mood search, reasons for each pick, reading timetable screenshots and posters |
| `GEMINI_MODEL` | Which Gemini model to use first |
| `GEMINI_FALLBACK_MODELS` | Optional: models to try when the main one is busy or out of free quota |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps in the browser (without it, OpenStreetMap is used) |
| `GOOGLE_MAPS_API_KEY` | Server-side Google calls: live places, Tube/bus times, finding venues |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | Optional: a Google Map ID for the map style |
| `ELEVENLABS_API_KEY` | Speech to text for the mic, and Read aloud |
| `ELEVENLABS_VOICE_ID` | Optional: a different Read aloud voice |
| `ELEVENLABS_TTS_MODEL`, `ELEVENLABS_STT_MODEL` | Optional: which ElevenLabs models to use |

## Data sources and privacy

- Society events: collected by hand from the KCLSU, Students' Union UCL and Imperial College Union event pages, plus
  public events from the Wellcome Collection, the Francis Crick Institute, the V&A, Tate Britain, the Courtauld, the
  Royal Parks, the British Library and Waterstones. Each event links to its original page, so check there for tickets
  and changes.
- Cafés, libraries, parks, museums and sports places: Google Places, both as a saved snapshot and live for each gap.
- Map positions, Tube/bus times and venue lookups: Google Maps Platform.
- Your timetable, plans and settings are saved only in your browser and never uploaded. Your location is never saved;
  it is only sent (to our server, then Google) when asking for Tube/bus times or nearby places. Timetable screenshots
  and posters are sent to Gemini to be read and are not stored.

## Built with

- [Next.js](https://nextjs.org), [React](https://react.dev), [TypeScript](https://www.typescriptlang.org), [Tailwind CSS](https://tailwindcss.com)
- [Google Maps Platform](https://developers.google.com/maps): Maps JavaScript API, Places API (New) and Routes API, via [@vis.gl/react-google-maps](https://visgl.github.io/react-google-maps/)
- [Leaflet](https://leafletjs.com) and [React Leaflet](https://react-leaflet.js.org), with map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors and tiles © [CARTO](https://carto.com/attributions)
- [Google Gemini API](https://ai.google.dev)
- [ElevenLabs](https://elevenlabs.io) speech to text and text to speech, with the browser's Web Speech API as a fallback
- [ical.js](https://github.com/kewisch/ical.js) for reading calendar files
- Fonts: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) and [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/), via [Fontsource](https://fontsource.org)
- [ESLint](https://eslint.org) for checking the code
- Developed with the help of Claude Code (Anthropic) as an AI coding assistant

## Team

- Nandana Anil 
- Rheanna Pereira 
- Aeshelle Cardozo
- Candela Cortes

Built during the IKU Womxn in STEM Hackathon, 17–18 October 2026. There was no prior work on this project.
