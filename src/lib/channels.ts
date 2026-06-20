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

export type ChannelVariant =
  | "signal-dm"
  | "signal-group"
  | "signal-other"
  | "console"
  | "outbound";

export interface ChannelLabel {
  source: string;
  detail: string;
  channel?: string;
  variant: ChannelVariant;
  /** Short banner headline, e.g. "Signal DM from Matt" */
  headline: string;
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
    return {
      source: "console",
      detail: "web / api",
      variant: "console",
      headline: "Console message",
    };
  }
  const ch = meta.channel;
  if (ch.startsWith("signal/")) {
    if (meta.chat_type === "group") {
      const name = meta.chat_name ?? "unnamed group";
      return {
        source: "signal",
        detail: `group · ${name}`,
        channel: ch,
        variant: "signal-group",
        headline: `Signal group · ${name}`,
      };
    }
    if (meta.chat_type === "dm") {
      const who = meta.sender_name ?? "unknown";
      return {
        source: "signal",
        detail: `dm · ${who}`,
        channel: ch,
        variant: "signal-dm",
        headline: `Signal DM from ${who}`,
      };
    }
    return {
      source: "signal",
      detail: meta.chat_type ?? "chat",
      channel: ch,
      variant: "signal-other",
      headline: `Signal · ${meta.chat_type ?? "message"}`,
    };
  }
  const connector = ch.split("/")[0] ?? "channel";
  const detail = meta.chat_name ?? meta.chat_type ?? ch;
  return {
    source: connector,
    detail,
    channel: ch,
    variant: "signal-other",
    headline: `${connector} · ${detail}`,
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
        variant: looksDm ? "signal-dm" : "signal-group",
        headline: looksDm ? "Sent on Signal DM" : "Sent on Signal group",
      };
    }
    const connector = ch.split("/")[0] ?? "channel";
    return {
      source: connector,
      detail: "delivered",
      channel: ch,
      variant: "outbound",
      headline: `Sent via ${connector}`,
    };
  } catch {
    return null;
  }
}

export function outboundSendLabel(name: string): ChannelLabel {
  const source = name.replace(/_send$/, "");
  return {
    source,
    detail: "outbound",
    variant: "outbound",
    headline: `Outgoing · ${source}`,
  };
}