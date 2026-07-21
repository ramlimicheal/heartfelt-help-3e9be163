/**
 * Isolated HTTP test server for the unified Wisdom route.
 *
 * - Binds ONLY to 127.0.0.1 on an ephemeral port (port 0 → OS picks free).
 * - Never touches Lovable preview/prod flags. WISDOM_UNIFIED_TURN is set on
 *   `process.env` only for the duration of this in-process server.
 * - Refuses to start if the DB URL looks like a production database and no
 *   explicit override (WISDOM_TEST_ALLOW_PROD_DB=1) is present.
 * - Never prints tokens, service-role keys, prompts, or model output.
 * - Guarantees teardown via a `stop()` returned from `startTestServer()`.
 *
 * Used by later sub-turns (2b/2c) to run the real POST /api/wisdom/turn
 * handler against a real Supabase test database, with the fake gateway
 * seam active. This module only owns lifecycle; it does not run cases.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";

export interface TestServerHandle {
  url: string;              // http://127.0.0.1:<port>
  port: number;
  runId: string;
  stop: () => Promise<void>;
}

function looksLikeProductionDb(dbUrl: string | undefined): boolean {
  if (!dbUrl) return false;
  // Heuristic: hostnames marked prod, or an explicit env label.
  const label = (process.env.SUPABASE_ENV ?? "").toLowerCase();
  if (label === "production" || label === "prod") return true;
  return /(^|[.-])prod(\.|-|$)/i.test(dbUrl);
}

export async function startTestServer(): Promise<TestServerHandle> {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("testServer: NODE_ENV must be 'test' to start the isolated server.");
  }
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (looksLikeProductionDb(dbUrl) && process.env.WISDOM_TEST_ALLOW_PROD_DB !== "1") {
    throw new Error(
      "testServer: refusing to run against a production-looking database. " +
      "Set WISDOM_TEST_ALLOW_PROD_DB=1 to explicitly override (not recommended).",
    );
  }

  // Per-run isolation identifier — used by the fake gateway keying.
  const runId = process.env.WISDOM_TEST_RUN_ID ?? randomUUID().slice(0, 12);
  process.env.WISDOM_TEST_RUN_ID = runId;

  // Enable unified turn ONLY in this process. Never written to disk/.env.
  const prevFlag = process.env.WISDOM_UNIFIED_TURN;
  process.env.WISDOM_UNIFIED_TURN = "on";

  // Fake model seam gate: NODE_ENV=test + WISDOM_TEST_FAKE_MODEL=1 + runId.
  const prevFake = process.env.WISDOM_TEST_FAKE_MODEL;
  process.env.WISDOM_TEST_FAKE_MODEL = "1";

  // Lazy-import the route handler so env is set before module init reads it.
  const routeMod = await import("@/routes/api/wisdom/turn");
  // The TanStack file route exposes `Route.options.server.handlers.POST`.
  // Reach into it to invoke the handler with a synthetic Request.
  const RouteAny = (routeMod as unknown as { Route: { options: { server: { handlers: { POST: (ctx: { request: Request }) => Promise<Response> } } } } }).Route;
  const post = RouteAny.options.server.handlers.POST;

  const server = http.createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = Buffer.concat(chunks);
      const url = `http://127.0.0.1${req.url ?? "/"}`;
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
        else if (typeof v === "string") headers.set(k, v);
      }
      const request = new Request(url, {
        method: req.method,
        headers,
        body: body.length && req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
      });
      const response = await post({ request });
      res.statusCode = response.status;
      response.headers.forEach((v, k) => res.setHeader(k, v));
      const reader = response.body?.getReader();
      if (!reader) {
        res.end();
        return;
      }
      // Stream SSE frames through without buffering.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch {
      // Never leak the error text — could contain prompts/tokens if misused.
      res.statusCode = 500;
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as AddressInfo;
  const port = addr.port;
  const url = `http://127.0.0.1:${port}`;

  const stop = async () => {
    await new Promise<void>((r) => server.close(() => r()));
    if (prevFlag === undefined) delete process.env.WISDOM_UNIFIED_TURN;
    else process.env.WISDOM_UNIFIED_TURN = prevFlag;
    if (prevFake === undefined) delete process.env.WISDOM_TEST_FAKE_MODEL;
    else process.env.WISDOM_TEST_FAKE_MODEL = prevFake;
  };

  return { url, port, runId, stop };
}
