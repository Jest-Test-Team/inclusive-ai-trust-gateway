// Proxy to the trust gateway (Go) on Back4App. The agency API key is
// injected server-side so it never ships to the browser.
// Configure GATEWAY_API_BASE_URL (or NEXT_PUBLIC_API_BASE_URL) in Vercel.
import { createProxyHandler } from "../../../lib/serverProxy";

export default createProxyHandler({
  originEnv: ["GATEWAY_API_BASE_URL", "NEXT_PUBLIC_API_BASE_URL"],
  defaultOrigin: "https://aitrustgateway-yc07jtbe.b4a.run",
  injectKey: {
    header: "X-Api-Key",
    env: ["GATEWAY_API_KEY", "NEXT_PUBLIC_API_KEY"],
    fallback: "dev-key",
  },
});
