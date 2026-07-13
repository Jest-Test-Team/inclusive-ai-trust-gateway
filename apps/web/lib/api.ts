// Gateway API config. When NEXT_PUBLIC_API_BASE_URL is unset the dashboard
// runs in offline demo mode using deterministic sample data from @iatg/shared.

import { createGatewayClient } from "@iatg/shared";

export const gatewayOrigin = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
export const apiBaseURL = "/api/gateway";
export const apiKey = process.env.NEXT_PUBLIC_API_KEY ?? "dev-key";
export const liveMode = gatewayOrigin !== "";

export const gateway = createGatewayClient({ baseURL: apiBaseURL, apiKey });

/** Opens the gateway's live feed; returns a cleanup function. */
export function openLiveFeed(onEvent: (channel: string, data: unknown) => void): () => void {
  if (!liveMode) return () => {};
  const socket = new WebSocket(
    `${gatewayOrigin.replace(/^http/, "ws").replace(/\/+$/, "")}/ws?api_key=${encodeURIComponent(apiKey)}`,
  );
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
