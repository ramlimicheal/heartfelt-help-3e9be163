/**
 * Isolated HTTP test server for the unified Wisdom route.
 *
 * - Binds ONLY to 127.0.0.1 on an ephemeral port (port 0 → OS picks free).
 * - Never touches Lovable preview/prod flags. WISDOM_UNIFIED_TURN is set on
 *   `process.env` only for the duration of this in-process server.
 * - Fails closed if the target database looks like production. There is no
 *   override — Turn 2b–2d cannot run against production.
 * - Never prints tokens, service-role keys, prompts, or model output.
 * - Guarantees teardown via a `stop()` returned from `startTestServer()`.
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

export interface NonSecretDbIdentity {
  host: string;
  port: string;
  database: string;
  projectRef: string; // Supabase project ref (non-secret)
}

/**
 * Extract non-secret DB identity from SUPABASE_DB_URL. Never returns the
 * password. `projectRef` is derived from the pooler username suffix
 * (`postgres.<ref>`), falling back to hostname parsing.
 */
export function nonSecretDbIdentity(dbUrl: string): NonSecretDbIdentity {
  const u = new URL(dbUrl);
  const userParts = u.username.split(".");
  const projectRef = userParts.length > 1
    ? userParts[userParts.length - 1]
    : (u.hostname.split(".")[0] ?? "");
  return {
    host: u.hostname,
    port: u.port,
    database: u.pathname.replace(/^\//, ""),
    projectRef,
  };
}

/**
 * Fail-closed production check. There is NO override for this route suite.
 * A database is considered production if:
 *   - SUPABASE_ENV === 'production' | 'prod', OR
 *   - the host/URL contains a `prod` label, OR
 *   - the project ref does not match SUPABASE_PROJECT_ID (i.e. someone
 *     pointed the harness at a different project's DB).
 */
export function assertNotProductionDb(dbUrl: string, expectedProjectRef?: string): NonSecretDbIdentity {
  const id = nonSecretDbIdentity(dbUrl);
  const label = (process.env.SUPABASE_ENV ?? "").toLowerCase();
  if (label === "production" || label === "prod") {
    throw new Error(`testServer: SUPABASE_ENV=${label} — refusing to run.`);
  }
  if (/(^|[.-])prod(\.|-|$)/i.test(id.host)) {
    throw new Error(`testServer: DB host '${id.host}' looks like production — refusing to run.`);
  }
  if (expectedProjectRef && id.projectRef && expectedProjectRef !== id.projectRef) {
    throw new Error(
      `testServer: project ref mismatch (SUPABASE_PROJECT_ID=${expectedProjectRef}, ` +
      `DB ref=${id.projectRef}) — refusing to run.`,
    );
  }
  return id;
}

export async function startTestServer(): Promise<TestServerHandle> {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("testServer: NODE_ENV must be 'test' to start the isolated server.");
  }
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    throw new Error("testServer: SUPABASE_DB_URL required.");
  }
  // No override. If someone tries `WISDOM_TEST_ALLOW_PROD_DB=1`, reject.
  if (process.env.WISDOM_TEST_ALLOW_PROD_DB) {
    throw new Error(
      "testServer: WISDOM_TEST_ALLOW_PROD_DB is not honored by this route suite. " +
      "Point tests at a non-production project.",
    );
  }
  assertNotProductionDb(dbUrl, process.env.SUPABASE_PROJECT_ID);

  const runId = process.env.WISDOM_TEST_RUN_ID ?? randomUUID().slice(0, 12);
  process.env.WISDOM_TEST_RUN_ID = runId;

  const prevFlag = process.env.WISDOM_UNIFIED_TURN;
  process.env.WISDOM_UNIFIED_TURN = "on";

  const prevFake = process.env.WISDOM_TEST_FAKE_MODEL;
  process.env.WISDOM_TEST_FAKE_MODEL = "1";

  const routeMod = await import("@/routes/api/wisdom/turn");
  const RouteAny = (routeMod as unknown as {
    Route: { options: { server: { handlers: { POST: (ctx: { request: Request }) => Promise<Response> } } } };
  }).Route;
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
      if (!reader) { res.end(); return; }
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch {
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
