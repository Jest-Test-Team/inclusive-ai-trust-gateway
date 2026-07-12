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
}

export function createProxyHandler(options: ProxyOptions) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    const origin = firstEnv(options.originEnv) ?? options.defaultOrigin ?? "";
    if (!origin) {
      res.status(503).json({
        error: `upstream not configured: set ${options.originEnv.join(" or ")} in the Vercel project env`,
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

    let response: Response;
    try {
      response = await fetch(target, {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body ?? {}),
        cache: "no-store",
      });
    } catch (error) {
      res.status(502).json({
        error: `upstream unreachable: ${target.origin}`,
        detail: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key === "content-encoding" || key === "content-length" || key === "transfer-encoding") return;
      res.setHeader(key, value);
    });
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
