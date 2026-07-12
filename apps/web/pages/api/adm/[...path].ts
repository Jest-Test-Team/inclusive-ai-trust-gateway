// Proxy to the ADM stack (combined gateway + SIEM) on Back4App.
// Configure ADM_API_BASE_URL (or NEXT_PUBLIC_ADM_API_BASE_URL) in Vercel.
import { createProxyHandler } from "../../../lib/serverProxy";

export default createProxyHandler({
  originEnv: ["ADM_API_BASE_URL", "NEXT_PUBLIC_ADM_API_BASE_URL"],
  defaultOrigin: "https://admstack-wqcq8qn8.b4a.run",
});
