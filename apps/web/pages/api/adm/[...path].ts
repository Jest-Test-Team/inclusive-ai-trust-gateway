// Proxy to the ADM stack (combined gateway + SIEM) on Choreo.
// Configure ADM_API_BASE_URL (or NEXT_PUBLIC_ADM_API_BASE_URL) in Vercel.
import { createProxyHandler } from "../../../lib/serverProxy";

export default createProxyHandler({
  originEnv: ["ADM_API_BASE_URL", "NEXT_PUBLIC_ADM_API_BASE_URL"],
});
