import { NextRequest } from "next/server";

const gatewayOrigin =
  process.env.GATEWAY_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://aitrustgateway-97n0puz9.b4a.run";

const gatewayApiKey = process.env.GATEWAY_API_KEY ?? process.env.NEXT_PUBLIC_API_KEY ?? "dev-key";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const target = new URL(path.join("/"), trimTrailingSlash(gatewayOrigin) + "/");
  target.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("X-Api-Key", gatewayApiKey);

  const response = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
  });

  const outHeaders = new Headers(response.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outHeaders,
  });
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
