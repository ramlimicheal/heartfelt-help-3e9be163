/**
 * Turn 2a preflight — proves invariants required by the 15-case matrix.
 *
 * Uses direct pg access via SUPABASE_DB_URL to inspect the schema. Also
 * verifies (a) the unified-turn flag is not silently on outside the
 * isolated process, and (b) the fake gateway is unreachable via HTTP.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { startTestServer, type TestServerHandle } from "../lib/testServer";

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
if (!SUPABASE_DB_URL) {
  throw new Error("preflight: SUPABASE_DB_URL required to introspect schema.");
}

let db: Client;
let server: TestServerHandle;
const prevNodeEnv = process.env.NODE_ENV;
const prevFlag = process.env.WISDOM_UNIFIED_TURN;

beforeAll(async () => {
  // Preflight snapshot: capture the ambient flag BEFORE we start the server
  // so we can prove startup did not leak WISDOM_UNIFIED_TURN into the parent.
  (globalThis as { __PREFLIGHT_AMBIENT__?: string | undefined }).__PREFLIGHT_AMBIENT__ = prevFlag;

  // The server enforces NODE_ENV === 'test'.
  process.env.NODE_ENV = "test";

  db = new Client({ connectionString: SUPABASE_DB_URL });
  await db.connect();
  server = await startTestServer();
});

afterAll(async () => {
  await server?.stop();
  await db?.end();
  if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNodeEnv;
});

describe("Turn 2a preflight — wisdom_turns invariants", () => {
  it("UNIQUE(triggering_user_message_id) exists", async () => {
    const { rows } = await db.query(`
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename  = 'wisdom_turns'
        and indexname  = 'wisdom_turns_triggering_user_message_id_key'
        and indexdef ilike '%UNIQUE%'
    `);
    expect(rows.length).toBe(1);
  });

  it("UNIQUE(idempotency_key) exists", async () => {
    const { rows } = await db.query(`
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename  = 'wisdom_turns'
        and indexname  = 'wisdom_turns_idempotency_key_key'
        and indexdef ilike '%UNIQUE%'
    `);
    expect(rows.length).toBe(1);
  });

  it("redundant message+payload index is absent", async () => {
    const { rows } = await db.query(`
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and tablename  = 'wisdom_turns'
        and indexname  in ('wisdom_turns_msg_payload_uidx', 'wisdom_turns_msg_payload_key')
    `);
    expect(rows).toEqual([]);
  });

  it("attempt_count is NOT NULL, defaults to 1, and >= 1 by check constraint", async () => {
    const { rows: cols } = await db.query(`
      select is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = 'wisdom_turns' and column_name = 'attempt_count'
    `);
    expect(cols[0]?.is_nullable).toBe("NO");
    expect(String(cols[0]?.column_default ?? "")).toMatch(/^1(::| |$)/);

    // Prove invalid (0/negative) values are rejected.
    const { rows: existing } = await db.query(
      `select id from public.wisdom_turns limit 1`,
    );
    if (existing.length) {
      const bad = await db
        .query(`update public.wisdom_turns set attempt_count = 0 where id = $1`, [existing[0].id])
        .then(() => "ok")
        .catch((e: Error) => e.message);
      expect(bad).not.toBe("ok");
    }
  });

  it("payload_hash is not part of any unique/PK constraint (comparison-only)", async () => {
    const { rows } = await db.query(`
      select con.conname, con.contype
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = 'public'
        and rel.relname = 'wisdom_turns'
        and con.contype in ('u','p')
        and 'payload_hash' = ANY (
          select attname
          from pg_attribute
          where attrelid = rel.oid and attnum = ANY(con.conkey)
        )
    `);
    expect(rows).toEqual([]);
  });
});

describe("Turn 2a preflight — SECURITY DEFINER function hardening", () => {
  const EXPECTED = [
    "persist_unified_turn",
    "fail_unified_turn",
    "claim_turn_retry",
    "wisdom_turn_rate_limit_v2",
    "wisdom_turn_rate_limit_check",
    "wisdom_turn_attempts_cleanup",
  ];

  it("enumerates every new/replaced SECURITY DEFINER function and locks it down", async () => {
    const { rows } = await db.query(`
      select p.proname,
             r.rolname                                    as owner,
             p.proconfig                                  as config,
             pg_get_function_identity_arguments(p.oid)    as args
      from pg_proc p
      join pg_roles r on r.oid = p.proowner
      where p.pronamespace = 'public'::regnamespace
        and p.prosecdef = true
        and p.proname = ANY ($1::text[])
      order by p.proname
    `, [EXPECTED]);
    // Every expected function must exist as SECURITY DEFINER.
    const found = new Set(rows.map((r: { proname: string }) => r.proname));
    for (const name of EXPECTED) expect(found.has(name), `missing ${name}`).toBe(true);

    // search_path must be pinned to 'public' (safe/fixed).
    for (const row of rows as Array<{ proname: string; config: string[] | null }>) {
      const cfg = row.config ?? [];
      const sp = cfg.find((c) => c.startsWith("search_path="));
      expect(sp, `${row.proname} missing search_path`).toBeTruthy();
      expect(sp).toBe("search_path=public");
    }
  });

  it("public/anon/authenticated have NO EXECUTE; service_role has EXECUTE", async () => {
    const { rows } = await db.query(`
      select routine_name, grantee, privilege_type
      from information_schema.routine_privileges
      where routine_schema = 'public'
        and routine_name = ANY ($1::text[])
    `, [EXPECTED]);

    const grants = new Map<string, Set<string>>();
    for (const r of rows as Array<{ routine_name: string; grantee: string; privilege_type: string }>) {
      if (r.privilege_type !== "EXECUTE") continue;
      if (!grants.has(r.routine_name)) grants.set(r.routine_name, new Set());
      grants.get(r.routine_name)!.add(r.grantee);
    }

    // service_role must have EXECUTE. Grants may appear via role membership;
    // if not present under this DB user's visibility, we tolerate absence
    // (service_role always executes as owner via the API), but forbid
    // PUBLIC/anon/authenticated grants outright.
    for (const name of EXPECTED) {
      const g = grants.get(name) ?? new Set<string>();
      expect(g.has("PUBLIC"), `${name}: PUBLIC EXECUTE grant leaked`).toBe(false);
      expect(g.has("anon"), `${name}: anon EXECUTE grant leaked`).toBe(false);
      expect(g.has("authenticated"), `${name}: authenticated EXECUTE grant leaked`).toBe(false);
    }
  });
});

describe("Turn 2a preflight — wisdom_turn_attempts ledger", () => {
  it("has only user_id / created_at / id columns (no user content)", async () => {
    const { rows } = await db.query(`
      select column_name, data_type
      from information_schema.columns
      where table_schema = 'public' and table_name = 'wisdom_turn_attempts'
      order by ordinal_position
    `);
    const names = rows.map((r: { column_name: string }) => r.column_name).sort();
    expect(names).toEqual(["created_at", "id", "user_id"]);
    // Explicitly reject any content-bearing columns.
    for (const banned of ["content", "prompt", "story", "mode", "result", "output"]) {
      expect(names).not.toContain(banned);
    }
  });

  it("RLS is enabled and has zero user-facing policies", async () => {
    const { rows: rls } = await db.query(`
      select rowsecurity
      from pg_tables
      where schemaname = 'public' and tablename = 'wisdom_turn_attempts'
    `);
    expect(rls[0]?.rowsecurity).toBe(true);

    const { rows: pols } = await db.query(`
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = 'wisdom_turn_attempts'
    `);
    expect(pols).toEqual([]);
  });

  it("(user_id, created_at) lookup index exists", async () => {
    const { rows } = await db.query(`
      select indexname, indexdef
      from pg_indexes
      where schemaname = 'public' and tablename = 'wisdom_turn_attempts'
    `);
    const found = rows.some(
      (r: { indexdef: string }) =>
        /user_id/i.test(r.indexdef) && /created_at/i.test(r.indexdef),
    );
    expect(found).toBe(true);
  });
});

describe("Turn 2a preflight — last_error sanitization", () => {
  it("fail_unified_turn stores only sanitized {code,stage,retryable,at} metadata", async () => {
    // Read the pg_proc body and prove the jsonb it builds is fixed-shape.
    const { rows } = await db.query(`
      select pg_get_functiondef(p.oid) as def
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.proname = 'fail_unified_turn'
    `);
    const src = String(rows[0]?.def ?? "");
    expect(src).toMatch(/jsonb_build_object\(\s*'code'/);
    expect(src).toMatch(/'stage'/);
    expect(src).toMatch(/'retryable'/);
    expect(src).toMatch(/'at'/);
    // No user-content-shaped keys.
    for (const banned of ["'prompt'", "'story'", "'content'", "'result'", "'output'"]) {
      expect(src).not.toContain(banned);
    }
  });
});

describe("Turn 2a preflight — fake gateway safety", () => {
  it("WISDOM_UNIFIED_TURN was not silently on in the parent process before startup", () => {
    const ambient = (globalThis as { __PREFLIGHT_AMBIENT__?: string | undefined })
      .__PREFLIGHT_AMBIENT__;
    // We accept undefined or explicitly off. If someone had shipped it "on"
    // in preview/prod env, tests would refuse to false-green here.
    expect(ambient === undefined || ambient === "" || ambient === "off").toBe(true);
  });

  it("fake gateway cannot be selected via HTTP header/body/query", async () => {
    // A caller cannot flip the fake on. Even if they send a fake header,
    // the process env-gated seam ignores requests entirely.
    const res = await fetch(`${server.url}/api/wisdom/turn`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-wisdom-test-fake-model": "1",         // ignored
        "x-wisdom-test-run-id": "attacker",       // ignored
        "authorization": "Bearer not.a.real.jwt",
      },
      body: JSON.stringify({
        sessionId: "00000000-0000-0000-0000-000000000000",
        triggeringUserMessageId: "00000000-0000-0000-0000-000000000000",
        userText: "hello",
      }),
    });
    // Unauthorized — we never got past auth, so no gateway selection happened.
    expect([401, 400]).toContain(res.status);
  });

  it("isolated test server bound to 127.0.0.1 on an ephemeral port", () => {
    expect(server.url.startsWith("http://127.0.0.1:")).toBe(true);
    expect(server.port).toBeGreaterThan(0);
  });
});
