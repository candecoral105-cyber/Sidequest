// Server route: tells the browser whether ElevenLabs voice is set up.
import { NextResponse } from "next/server";
import { hasElevenLabs } from "@/lib/elevenlabs";

// Only says whether a key is set, never the key itself.
export function GET() {
  return NextResponse.json({ elevenlabs: hasElevenLabs() });
}
