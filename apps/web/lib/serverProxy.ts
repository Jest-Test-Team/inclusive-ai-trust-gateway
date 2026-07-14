// Shared pages-router proxy factory. Each upstream (trust gateway, ADM
// stack, ERH engine) gets one catch-all route built from this helper so
// browser code only ever talks same-origin and secrets stay server-side.

import type { NextApiRequest, NextApiResponse } from "next";

export interface ProxyOptions {
  /** Env var names checked in order for the upstream origin. */
  originEnv: string[];
  /** Fallback origin when no env var is set (empty = unconfigured). */
  defaultOrigin?: string;
  /** Header name/env pair injected server-side (e.g. gateway API key). */
  injectKey?: { header: string; env: string[]; fallback: string };
  /** Upstream fetch timeout (ms). Default 12s to fail before platform 504. */
  timeoutMs?: number;
}

export function createProxyHandler(options: ProxyOptions) {
  const timeoutMs = options.timeoutMs ?? 12_000;

  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    const origin = firstEnv(options.originEnv) ?? options.defaultOrigin ?? "";
    if (!origin) {
      res.status(503).json({
        error: `upstream not configured: set ${options.originEnv.join(" or ")} in the Vercel project env`,
        hint: "Redeploy after changing env vars. See services/instruction.md.",
      });
      return;
    }

    // Refuse known-dead Back4App temporary hosts so the UI gets a clear 503
    // instead of hanging until Vercel/Choreo returns a cryptic 504.
    try {
      if (/\.b4a\.run$/i.test(new URL(origin).hostname)) {
        res.status(503).json({
          error: `upstream host is a expired Back4App URL: ${origin}`,
          hint: "Replace with the Choreo public URL (GATEWAY_API_BASE_URL / ADM_API_BASE_URL / ERH_API_BASE_URL) and redeploy.",
        });
        return;
      }
    } catch {
      res.status(503).json({
        error: `upstream origin is not a valid URL: ${origin}`,
        hint: `Set ${options.originEnv.join(" or ")} to an https://… Choreo public URL.`,
      });
      return;
    }

    const path = Array.isArray(req.query.path) ? req.query.path.join("/") : String(req.query.path ?? "");
    const target = new URL(path, origin.replace(/\/+$/, "") + "/");
    for (const [key, value] of Object.entries(req.query)) {
      if (key === "path") continue;
      if (Array.isArray(value)) {
        for (const item of value) target.searchParams.append(key, item);
      } else if (value != null) {
        target.searchParams.set(key, String(value));
      }
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (!value) continue;
      const lower = key.toLowerCase();
      if (lower === "host" || lower === "connection" || lower === "content-length") continue;
      headers.set(key, Array.isArray(value) ? value.join(",") : value);
    }
    if (options.injectKey) {
      headers.set(
        options.injectKey.header,
        firstEnv(options.injectKey.env) ?? options.injectKey.fallback,
      );
    }

    const body = req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body ?? {});

    // Follow redirects manually so the method and body survive: default
    // fetch semantics convert POST into GET on 301/302, which turned every
    // POST surface (GraphQL, UCP, Connect-RPC, MCP) into 405s upstream.
    let response: Response;
    let hop = new URL(target);
    try {
      for (let i = 0; ; i++) {
        response = await fetch(hop, {
          method: req.method,
          headers,
          body,
          cache: "no-store",
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
        });
        const location = response.headers.get("location");
        if (i >= 3 || !location || ![301, 302, 307, 308].includes(response.status)) break;
        hop = new URL(location, hop);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const timedOut = /aborted|timeout|TimeoutError/i.test(detail);
      res.status(timedOut ? 504 : 502).json({
        error: timedOut
          ? `upstream timeout after ${timeoutMs}ms: ${hop.origin}`
          : `upstream unreachable: ${hop.origin}`,
        detail,
        hint: timedOut
          ? "Choreo component may be cold-starting, scaled to zero, or pointing at the wrong port (ERH must listen on 8080)."
          : "Check the Choreo component is Deployed and the Vercel env URL matches its public endpoint.",
      });
      return;
    }

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key === "content-encoding" || key === "content-length" || key === "transfer-encoding") return;
      res.setHeader(key, value);
    });
    // Surface a readable body when Choreo's edge returns opaque 503/504 JSON.
    if (response.status >= 500) {
      const text = await response.text();
      try {
        const parsed = JSON.parse(text) as { message?: string; description?: string; code?: string };
        res.json({
          error: `upstream ${response.status}`,
          upstream: hop.origin,
          message: parsed.message ?? parsed.description ?? text.slice(0, 200),
          code: parsed.code,
          hint:
            response.status === 503 || response.status === 504
              ? "Upstream pod failed to accept connections. In Choreo: confirm erh-engine/adm-stack is Running, endpoint port=8080, then Redeploy."
              : undefined,
        });
      } catch {
        res.send(text);
      }
      return;
    }
    res.send(Buffer.from(await response.arrayBuffer()));
  };
}

function firstEnv(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}
