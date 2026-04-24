export const MAX_MOMENT_TEXT_CHARS = 140;

export interface MomentContent {
  text: string;
  image_url?: string | null;
  audio_url?: string | null;
}

export function serializeMomentContent(content: MomentContent): string {
  return JSON.stringify({
    text: content.text,
    image_url: content.image_url ?? null,
    audio_url: content.audio_url ?? null,
  });
}

export function deserializeMomentContent(raw: string): MomentContent {
  try {
    const parsed = JSON.parse(raw) as Partial<MomentContent>;
    if (typeof parsed?.text === "string") {
      return {
        text: parsed.text,
        image_url: parsed.image_url ?? null,
        audio_url: parsed.audio_url ?? null,
      };
    }
  } catch {
    // Backward-compatible fallback for legacy payloads that stored plain text.
  }

  return {
    text: raw,
    image_url: null,
    audio_url: null,
  };
}
