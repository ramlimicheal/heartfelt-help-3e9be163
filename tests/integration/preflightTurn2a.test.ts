/**
 * Turn 2a.1 preflight — proves invariants required by the 15-case matrix.
 *
 * Uses VERIFIED-TLS pg introspection (Supabase root CA, rejectUnauthorized:
 * true). Never disables certificate verification.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { createVerifiedPgClient } from "../lib/verifiedPg";
import { startTestServer, nonSecretDbIdentity, type TestServerHandle } from "../lib/testServer";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_DB_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("preflight: SUPABASE_DB_URL / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required.");
}

const EXPECTED_FNS: Array<{ name: string; args: string }> = [
  { name: "persist_unified_turn", args: "uuid, uuid, jsonb, jsonb, text, integer, integer, integer, integer" },
  { name: "fail_unified_turn", args: "uuid, uuid, text, text, boolean" },
  { name: "claim_turn_retry", args: "uuid, uuid, text, integer, integer" },
  { name: "wisdom_turn_rate_limit_v2", args: "uuid, integer, integer" },
  { name: "wisdom_turn_rate_limit_check", args: "uuid, integer, integer" },
  { name: "wisdom_turn_attempts_cleanup", args: "integer" },
];

let db: Client;
let server: TestServerHandle;
const prevNodeEnv = process.env.NODE_ENV;
const prevFlag = process.env.WISDOM_UNIFIED_TURN;

beforeAll(async () => {
  (globalThis as { __PREFLIGHT_AMBIENT__?: string | undefined }).__PREFLIGHT_AMBIENT__ = prevFlag;
  process.env.NODE_ENV = "test";
  db = createVerifiedPgClient();
  await db.connect();
  server = await startTestServer();
});

afterAll(async () => {
  await server?.stop();
  await db?.end();
  if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNodeEnv;
});

describe("Turn 2a.1 preflight — non-secret DB identity + production denial", () => {
  it("prints only non-secret DB identity and confirms it is not production", () => {
    const id = nonSecretDbIdentity(SUPABASE_DB_URL!);
    // Non-secret fields only. Never log password/DB URL.
    // eslint-disable-next-line no-console
    console.log(
      `[preflight] non-secret db identity: host=${id.host} port=${id.port} ` +
      `database=${id.database} projectRef=${id.projectRef} env=${process.env.SUPABASE_ENV ?? "(unset)"}`,
    );
    expect(id.host).not.toMatch(/(^|[.-])prod(\.|-|$)/i);
    expect(process.env.SUPABASE_ENV ?? "").not.toMatch(/^prod(uction)?$/i);
    if (process.env.SUPABASE_PROJECT_ID && id.projectRef) {
      expect(id.projectRef).toBe(process.env.SUPABASE_PROJECT_ID);
    }
  });

  it("WISDOM_TEST_ALLOW_PROD_DB is not honored — the harness rejects it", async () => {
    // Simulate an attacker/dev setting the override; startTestServer must throw.
    const prev = process.env.WISDOM_TEST_ALLOW_PROD_DB;
    process.env.WISDOM_TEST_ALLOW_PROD_DB = "1";
    try {
      await expect(startTestServer()).rejects.toThrow(/not honored/i);
    } finally {
      if (prev === undefined) delete process.env.WISDOM_TEST_ALLOW_PROD_DB;
      else process.env.WISDOM_TEST_ALLOW_PROD_DB = prev;
    }
  });
});

describe("Turn 2a.1 preflight — wisdom_turns invariants", () => {
  it("UNIQUE(triggering_user_message_id) exists", async () => {
    const { rows } = await db.query(`
      select 1 from pg_indexes
      where schemaname='public' and tablename='wisdom_turns'
        and indexname='wisdom_turns_triggering_user_message_id_key'
        and indexdef ilike '%UNIQUE%'
    `);
    expect(rows.length).toBe(1);
  });

  it("UNIQUE(idempotency_key) exists", async () => {
    const { rows } = await db.query(`
      select 1 from pg_indexes
      where schemaname='public' and tablename='wisdom_turns'
        and indexname='wisdom_turns_idempotency_key_key'
        and indexdef ilike '%UNIQUE%'
    `);
    expect(rows.length).toBe(1);
  });

  it("redundant message+payload index is absent", async () => {
    const { rows } = await db.query(`
      select indexname from pg_indexes
      where schemaname='public' and tablename='wisdom_turns'
        and indexname in ('wisdom_turns_msg_payload_uidx','wisdom_turns_msg_payload_key')
    `);
    expect(rows).toEqual([]);
  });

  it("attempt_count is NOT NULL, defaults to 1", async () => {
    const { rows } = await db.query(`
      select is_nullable, column_default from information_schema.columns
      where table_schema='public' and table_name='wisdom_turns' and column_name='attempt_count'
    `);
    expect(rows[0]?.is_nullable).toBe("NO");
    expect(String(rows[0]?.column_default ?? "")).toMatch(/^1(::| |$)/);
  });

  it("payload_hash is not part of any unique/PK constraint", async () => {
    const { rows } = await db.query(`
      select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid=con.conrelid
      join pg_namespace nsp on nsp.oid=rel.relnamespace
      where nsp.nspname='public' and rel.relname='wisdom_turns'
        and con.contype in ('u','p')
        and 'payload_hash' = ANY (
          select attname from pg_attribute
          where attrelid=rel.oid and attnum = ANY(con.conkey)
        )
    `);
    expect(rows).toEqual([]);
  });
});

describe("Turn 2a.1 preflight — SECURITY DEFINER hardening (per-function)", () => {
  it.each(EXPECTED_FNS)(
    "$name: SECURITY DEFINER, search_path pinned, service_role has EXECUTE, PUBLIC/anon/authenticated do not",
    async ({ name, args }) => {
      const oidRes = await db.query(
        `select p.oid::text as oid, p.prosecdef, p.proconfig
         from pg_proc p
         where p.pronamespace='public'::regnamespace and p.proname=$1
           and pg_get_function_identity_arguments(p.oid)=$2`,
        [name, args],
      );
      expect(oidRes.rows.length, `${name} not found with args (${args})`).toBe(1);
      const row = oidRes.rows[0] as { oid: string; prosecdef: boolean; proconfig: string[] | null };
      expect(row.prosecdef).toBe(true);

      const cfg = row.proconfig ?? [];
      const sp = cfg.find((c) => c.startsWith("search_path="));
      // Turn 2a.1 hardened value: pg_catalog first, pg_temp last.
      expect(sp).toBe("search_path=pg_catalog, public, pg_temp");

      // has_function_privilege — the authoritative source.
      const priv = await db.query(
        `select
           has_function_privilege('service_role',  $1::oid, 'EXECUTE') as svc,
           has_function_privilege('anon',          $1::oid, 'EXECUTE') as anon,
           has_function_privilege('authenticated', $1::oid, 'EXECUTE') as authd`,
        [row.oid],
      );
      const p = priv.rows[0] as { svc: boolean; anon: boolean; authd: boolean };
      expect(p.svc, `${name}: service_role must have EXECUTE`).toBe(true);
      expect(p.anon, `${name}: anon must NOT have EXECUTE`).toBe(false);
      expect(p.authd, `${name}: authenticated must NOT have EXECUTE`).toBe(false);

      // Absent PUBLIC grant in proacl.
      const acl = await db.query(
        `select coalesce(array_to_string(proacl::text[], ','), '') as acl_text
         from pg_proc where oid=$1::oid`,
        [row.oid],
      );
      const aclText = (acl.rows[0] as { acl_text: string }).acl_text;
      // PUBLIC EXECUTE appears as a bare "=X/..." entry (no role name before =).
      expect(aclText).not.toMatch(/(^|,)=X\//);
    },
  );

  it("PUBLIC, anon, authenticated cannot CREATE in public schema", async () => {
    const { rows } = await db.query(`
      select
        has_schema_privilege('anon',         'public','CREATE') as anon_c,
        has_schema_privilege('authenticated','public','CREATE') as authd_c
    `);
    const r = rows[0] as { anon_c: boolean; authd_c: boolean };
    expect(r.anon_c).toBe(false);
    expect(r.authd_c).toBe(false);
    // PUBLIC — inspect nspacl for a bare "=UC/..." or "=C/..." entry.
    const acl = await db.query(
      `select coalesce(array_to_string(nspacl::text[], ','), '') as t
       from pg_namespace where nspname='public'`,
    );
    const t = (acl.rows[0] as { t: string }).t;
    expect(t).not.toMatch(/(^|,)=[A-Za-z]*C[A-Za-z]*\//);
  });
});

describe("Turn 2a.1 preflight — real service-role RPC smoke", () => {
  it("service_role can invoke wisdom_turn_attempts_cleanup via PostgREST", async () => {
    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Generate a tagged attempt for a synthetic user, then invoke cleanup
    // with a very small age so the row is eligible, then confirm it is gone.
    const syntheticUser = randomUUID();
    const insertErr = (
      await admin.from("wisdom_turn_attempts").insert({
        user_id: syntheticUser,
        created_at: new Date(Date.now() - 10_000).toISOString(),
      })
    ).error;
    expect(insertErr, `seed insert failed: ${insertErr?.message ?? ""}`).toBeNull();

    const { data, error } = await admin.rpc("wisdom_turn_attempts_cleanup", {
      p_older_than_seconds: 5,
    });
    expect(error, `rpc error: ${error?.message ?? ""}`).toBeNull();
    // The RPC returns the number of deleted rows (integer >= 1).
    expect(typeof data).toBe("number");
    expect((data as number) >= 1).toBe(true);

    // Verify the tagged row is gone (deterministic cleanup).
    const { data: remaining, error: selErr } = await admin
      .from("wisdom_turn_attempts")
      .select("id")
      .eq("user_id", syntheticUser);
    expect(selErr).toBeNull();
    expect(remaining ?? []).toEqual([]);
  });
});

describe("Turn 2a.1 preflight — wisdom_turn_attempts ledger", () => {
  it("has only user_id / created_at / id columns (no user content)", async () => {
    const { rows } = await db.query(`
      select column_name from information_schema.columns
      where table_schema='public' and table_name='wisdom_turn_attempts'
      order by ordinal_position
    `);
    const names = rows.map((r: { column_name: string }) => r.column_name).sort();
    expect(names).toEqual(["created_at", "id", "user_id"]);
  });

  it("RLS enabled with zero policies", async () => {
    const { rows: rls } = await db.query(`
      select rowsecurity from pg_tables
      where schemaname='public' and tablename='wisdom_turn_attempts'
    `);
    expect(rls[0]?.rowsecurity).toBe(true);
    const { rows: pols } = await db.query(`
      select policyname from pg_policies
      where schemaname='public' and tablename='wisdom_turn_attempts'
    `);
    expect(pols).toEqual([]);
  });

  it("(user_id, created_at) lookup index exists", async () => {
    const { rows } = await db.query(`
      select indexdef from pg_indexes
      where schemaname='public' and tablename='wisdom_turn_attempts'
    `);
    const found = rows.some((r: { indexdef: string }) =>
      /user_id/i.test(r.indexdef) && /created_at/i.test(r.indexdef),
    );
    expect(found).toBe(true);
  });
});

describe("Turn 2a.1 preflight — last_error sanitization", () => {
  it("fail_unified_turn stores only {code,stage,retryable,at}", async () => {
    const { rows } = await db.query(`
      select pg_get_functiondef(p.oid) as def
      from pg_proc p
      where p.pronamespace='public'::regnamespace and p.proname='fail_unified_turn'
    `);
    const src = String(rows[0]?.def ?? "");
    expect(src).toMatch(/jsonb_build_object\(\s*'code'/);
    expect(src).toMatch(/'stage'/);
    expect(src).toMatch(/'retryable'/);
    expect(src).toMatch(/'at'/);
    for (const banned of ["'prompt'", "'story'", "'content'", "'result'", "'output'"]) {
      expect(src).not.toContain(banned);
    }
  });
});

describe("Turn 2a.1 preflight — fake gateway safety", () => {
  it("WISDOM_UNIFIED_TURN was not silently on in the parent process before startup", () => {
    const ambient = (globalThis as { __PREFLIGHT_AMBIENT__?: string | undefined })
      .__PREFLIGHT_AMBIENT__;
    expect(ambient === undefined || ambient === "" || ambient === "off").toBe(true);
  });

  it("fake gateway cannot be selected via HTTP header/body/query", async () => {
    const res = await fetch(`${server.url}/api/wisdom/turn`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-wisdom-test-fake-model": "1",
        "x-wisdom-test-run-id": "attacker",
        "authorization": "Bearer not.a.real.jwt",
      },
      body: JSON.stringify({
        sessionId: "00000000-0000-0000-0000-000000000000",
        triggeringUserMessageId: "00000000-0000-0000-0000-000000000000",
        userText: "hello",
      }),
    });
    expect([400, 401]).toContain(res.status);
  });

  it("isolated test server bound to 127.0.0.1 on an ephemeral port", () => {
    expect(server.url.startsWith("http://127.0.0.1:")).toBe(true);
    expect(server.port).toBeGreaterThan(0);
  });
});
