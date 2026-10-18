// ElevenLabs speech-to-text and text-to-speech, called only from the server so the key stays secret.
const BASE = "https://api.elevenlabs.io/v1";

export const hasElevenLabs = () => Boolean(process.env.ELEVENLABS_API_KEY);

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY is not set");
  return k;
}

/** Speech-to-text: an audio recording in, the words out. */
export async function transcribe(audio: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v2");
  form.append("file", audio, filename);
  form.append("tag_audio_events", "false"); // no "(laughs)" etc. in the text
  const res = await fetch(`${BASE}/speech-to-text`, { method: "POST", headers: { "xi-api-key": key() }, body: form });
  if (!res.ok) throw new Error(`ElevenLabs speech-to-text error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return String(data?.text ?? "").trim();
}

/** Text-to-speech: words in, an MP3 out. "Sarah" is a warm, friendly premade voice; change it with ELEVENLABS_VOICE_ID. */
export async function speak(text: string): Promise<Response> {
  const voice = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
  const res = await fetch(`${BASE}/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key(), "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_TTS_MODEL || "eleven_v4_turbo",
      voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.3, speed: 1 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs text-to-speech error ${res.status}: ${await res.text()}`);
  return res;
}
