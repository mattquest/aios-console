/**
 * Helpers for reading aios message-event payloads.
 *
 * Message ``content`` round-trips LiteLLM shapes: either a plain string
 * or an array of typed parts (``text`` / ``image_url``). The harness also
 * has two channel conventions the chat must understand:
 *
 * - connector sends: assistant tool_calls named ``<connector>_send``
 *   (signal_send, telegram_send, …) whose ``text`` argument is what the
 *   user actually received — first-class speech, not plumbing.
 * - internal monologue: assistant text prefixed with
 *   ``INTERNAL_MONOLOGUE_NOT_SEEN_BY_USER:`` while a channel is bound —
 *   private thinking, never delivered.
 */

import type { ToolCall } from "@/lib/types";

export const MONOLOGUE_PREFIX = "INTERNAL_MONOLOGUE_NOT_SEEN_BY_USER:";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; url: string };

/**
 * Normalize message content (string | part array | anything) into a list
 * of renderable parts. Unknown part shapes degrade to their text-ish
 * fields rather than crashing the transcript.
 */
export function contentParts(content: unknown): ContentPart[] {
  if (typeof content === "string") {
    return content ? [{ type: "text", text: content }] : [];
  }
  if (!Array.isArray(content)) return [];
  const parts: ContentPart[] = [];
  for (const raw of content) {
    if (typeof raw === "string") {
      if (raw) parts.push({ type: "text", text: raw });
      continue;
    }
    if (typeof raw !== "object" || raw === null) continue;
    const block = raw as {
      type?: string;
      text?: unknown;
      image_url?: unknown;
    };
    if (typeof block.text === "string" && block.text) {
      parts.push({ type: "text", text: block.text });
      continue;
    }
    if (block.type === "image_url") {
      const url =
        typeof block.image_url === "string"
          ? block.image_url
          : typeof (block.image_url as { url?: unknown })?.url === "string"
            ? ((block.image_url as { url: string }).url)
            : null;
      if (url) parts.push({ type: "image", url });
    }
  }
  return parts;
}

/** Concatenated text of all text parts — for previews and prefix checks. */
export function contentText(content: unknown): string {
  return contentParts(content)
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/** True when assistant text opted out of delivery (private thinking). */
export function isMonologue(text: string): boolean {
  return text.trimStart().startsWith(MONOLOGUE_PREFIX);
}

/** Drop the monologue prefix for display. */
export function stripMonologue(text: string): string {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith(MONOLOGUE_PREFIX)) return text;
  return trimmed.slice(MONOLOGUE_PREFIX.length).trimStart();
}

/**
 * If a tool call is a connector send (``<connector>_send`` with a string
 * ``text`` argument), return the delivered text; otherwise null.
 */
export function connectorSendText(call: ToolCall): string | null {
  if (!/^[a-z0-9-]+_send$/.test(call.function.name)) return null;
  try {
    const args = JSON.parse(call.function.arguments) as { text?: unknown };
    return typeof args.text === "string" ? args.text : null;
  } catch {
    return null;
  }
}
