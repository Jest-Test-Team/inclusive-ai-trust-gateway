// Gateway API client. When NEXT_PUBLIC_API_BASE_URL is unset the dashboard
// runs in offline demo mode using the deterministic scoring and sample data
// from @iatg/shared — the same fallback model the gateway itself uses.

export const apiBaseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
export const apiKey = process.env.NEXT_PUBLIC_API_KEY ?? "dev-key";

export const liveMode = apiBaseURL !== "";

export interface LiveSafetyEvent {
  id: string;
  eventType: string;
  severity: string;
  sessionId?: string;
  receivedAt: string;
}

export async function fetchSafetyEvents(): Promise<LiveSafetyEvent[]> {
  const res = await fetch(`${apiBaseURL}/v1/adm/events`, {
    headers: { "X-Api-Key": apiKey },
  });
  if (!res.ok) throw new Error(`gateway responded ${res.status}`);
  const body = (await res.json()) as { items: LiveSafetyEvent[] };
  return body.items;
}

/** Opens the gateway's live feed; returns a cleanup function. */
export function openLiveFeed(onEvent: (channel: string, data: unknown) => void): () => void {
  if (!liveMode) return () => {};
  const wsURL = apiBaseURL.replace(/^http/, "ws") + `/ws?api_key=${encodeURIComponent(apiKey)}`;
  const socket = new WebSocket(wsURL);
  socket.onmessage = (msg) => {
    try {
      const frame = JSON.parse(msg.data as string) as { channel: string; data: unknown };
      onEvent(frame.channel, frame.data);
    } catch {
      // ignore malformed frames
    }
  };
  return () => socket.close();
}
