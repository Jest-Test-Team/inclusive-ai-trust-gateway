import type { NextApiRequest, NextApiResponse } from "next";

const gatewayOrigin =
  process.env.GATEWAY_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://aitrustgateway-97n0puz9.b4a.run";

const gatewayApiKey = process.env.GATEWAY_API_KEY ?? process.env.NEXT_PUBLIC_API_KEY ?? "dev-key";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const path = Array.isArray(req.query.path) ? req.query.path.join("/") : String(req.query.path ?? "");
  const target = new URL(path, trimTrailingSlash(gatewayOrigin) + "/");
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
    if (!value || key.toLowerCase() === "host") continue;
    headers.set(key, Array.isArray(value) ? value.join(",") : value);
  }
  headers.set("X-Api-Key", gatewayApiKey);

  const response = await fetch(target, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body ?? {}),
    cache: "no-store",
  });

  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (key === "content-encoding" || key === "content-length") return;
    res.setHeader(key, value);
  });
  res.send(Buffer.from(await response.arrayBuffer()));
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
