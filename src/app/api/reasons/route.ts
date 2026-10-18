// Server route: Gemini writes a one-line reason for each top pick.
import { NextResponse } from "next/server";
import { askGemini, hasGemini } from "@/lib/gemini";

type Pick = { id: string; name: string; type: string; society: string | null; tags: string[]; price: number; walk: number; by?: "walk" | "transit"; spare: number; time: string };

export async function POST(req: Request) {
  const { mood, picks } = (await req.json()) as { mood: string; picks: Pick[] };
  if (!hasGemini() || !picks?.length) return NextResponse.json({ reasons: {} });

  const prompt = `You help London university students use the gap between classes well.
The student said: "${mood || "no preference"}".
For each option below, write ONE short reason (max 16 words) why it suits them right now.
Be warm and specific, mention one concrete fact (travel time, price, time spare, what happens there). No emojis. Don't invent facts.
Options:
${picks.map((p) => `- id=${p.id}: ${p.name} (${p.type}${p.society ? `, run by ${p.society}` : ""}); tags: ${p.tags.join(", ")}; ${p.price === 0 ? "free" : `£${p.price}`}; ${p.walk} min ${p.by === "transit" ? "by Tube/bus" : "walk"}; ${p.time}; ${p.spare} min spare before next class`).join("\n")}`;

  try {
    const out = await askGemini<{ reasons: { id: string; reason: string }[] }>([{ text: prompt }], {
      type: "OBJECT",
      properties: {
        reasons: {
          type: "ARRAY",
          items: { type: "OBJECT", properties: { id: { type: "STRING" }, reason: { type: "STRING" } }, required: ["id", "reason"] },
        },
      },
      required: ["reasons"],
    });
    return NextResponse.json({ reasons: Object.fromEntries(out.reasons.map((r) => [r.id, r.reason])) });
  } catch (e) {
    console.error("Reasons failed:", e);
    return NextResponse.json({ reasons: {} });
  }
}
