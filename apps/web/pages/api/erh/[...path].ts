// Proxy to the ERH engine on Back4App.
// Configure ERH_API_BASE_URL (or NEXT_PUBLIC_ERH_API_BASE_URL) in Vercel.
import { createProxyHandler } from "../../../lib/serverProxy";

export default createProxyHandler({
  originEnv: ["ERH_API_BASE_URL", "NEXT_PUBLIC_ERH_API_BASE_URL"],
  defaultOrigin: "https://erhengine-wtf46xkt.b4a.run",
});
