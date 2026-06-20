/**
 * Channel metadata on inbound connector messages (Signal, etc.).
 * aios stamps these on user-role events delivered from connectors.
 */

export interface MessageMetadata {
  channel?: string;
  chat_type?: string;
  chat_name?: string;
  sender_name?: string;
  sender_uuid?: string;
}

export interface ChannelLabel {
  source: string;
  detail: string;
  channel?: string;
}

export function parseMessageMetadata(data: {
  metadata?: unknown;
}): MessageMetadata | null {
  const m = data.metadata;
  if (!m || typeof m !== "object") return null;
  return m as MessageMetadata;
}

export function channelLabel(meta: MessageMetadata | null): ChannelLabel {
  if (!meta?.channel) {
    return { source: "console", detail: "web / api" };
  }
  const ch = meta.channel;
  if (ch.startsWith("signal/")) {
    if (meta.chat_type === "group") {
      return {
        source: "signal",
        detail: `group · ${meta.chat_name ?? "unnamed"}`,
        channel: ch,
      };
    }
    if (meta.chat_type === "dm") {
      return {
        source: "signal",
        detail: `dm · ${meta.sender_name ?? "unknown"}`,
        channel: ch,
      };
    }
    return { source: "signal", detail: meta.chat_type ?? "chat", channel: ch };
  }
  const connector = ch.split("/")[0] ?? "channel";
  return {
    source: connector,
    detail: meta.chat_name ?? meta.chat_type ?? ch,
    channel: ch,
  };
}

/** Friendly label for connector *_send tool results. */
export function channelLabelFromSendResult(
  name: string | undefined,
  content: unknown,
): ChannelLabel | null {
  if (!name?.endsWith("_send")) return null;
  const text = typeof content === "string" ? content : "";
  try {
    const parsed = JSON.parse(text) as { channel?: string };
    if (!parsed.channel) return null;
    const ch = parsed.channel;
    if (ch.startsWith("signal/")) {
      const tail = ch.split("/").pop() ?? "";
      const looksDm = tail.length < 40;
      return {
        source: "signal",
        detail: looksDm ? "dm" : "group",
        channel: ch,
      };
    }
    return { source: ch.split("/")[0] ?? "channel", detail: "delivered", channel: ch };
  } catch {
    return null;
  }
}