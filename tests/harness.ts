/**
 * Disposable test-user harness for Checkpoint 2 integration tests.
 *
 * - Uses the service-role key ONLY to (a) create two disposable auth users
 *   and (b) tear them down in a finally hook.
 * - All user-behavior assertions run through per-user authenticated clients
 *   so RLS and DB triggers are actually exercised.
 * - Aborts loudly if the test DB or admin credentials are missing — never
 *   downgrades to a false green.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing Supabase test credentials (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY). " +
      "Integration tests cannot run without them — refusing to false-green.",
  );
}

const RUN_ID = process.env.WISDOM_TEST_RUN_ID ?? randomUUID().slice(0, 8);

// Opaque sb_* keys are not JWTs; strip the default Authorization bearer that
// supabase-js adds and keep only the apikey header.
function opaqueKeyFetch(key: string): typeof fetch {
  return (input, init) => {
    const h = new Headers(init?.headers);
    if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
      h.delete("Authorization");
    }
    h.set("apikey", key);
    return fetch(input, { ...init, headers: h });
  };
}

export function adminClient(): SupabaseClient {
  // Service role: send BOTH apikey and Authorization: Bearer <service key>.
  // For opaque sb_secret_ keys, PostgREST reads the role from apikey; but
  // supabase-js defaults are fine — do not strip Authorization here, because
  // some code paths still require the bearer to identify service_role.
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function authedClientWithToken(accessToken: string): SupabaseClient {
  const key = SUPABASE_PUBLISHABLE_KEY!;
  return createClient(SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        // Bearer the USER's access token so RLS applies as that user.
        h.set("Authorization", `Bearer ${accessToken}`);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
}

async function provisionUser(label: string): Promise<TestUser> {
  const admin = adminClient();
  const email = `wisdom+ck2-${label}-${RUN_ID}-${randomUUID().slice(0, 6)}@example.test`;
  const password = `Test-${randomUUID()}`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (cErr || !created.user) {
    throw new Error(`harness: could not create test user (${label}): ${cErr?.message}`);
  }
  const userId = created.user.id;

  // Sign in with a publishable-key auth client to obtain a real access token.
  const key = SUPABASE_PUBLISHABLE_KEY!;
  const authClient = createClient(SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: opaqueKeyFetch(key) },
  });
  const { data: signIn, error: sErr } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (sErr || !signIn.session) {
    throw new Error(`harness: sign-in failed for ${label}: ${sErr?.message}`);
  }
  const client = authedClientWithToken(signIn.session.access_token);
  return { id: userId, email, password, client };
}

export interface TestContext {
  userA: TestUser;
  userB: TestUser;
  admin: SupabaseClient;
  cleanup: () => Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const admin = adminClient();
  const userA = await provisionUser("a");
  const userB = await provisionUser("b");
  const cleanup = async () => {
    for (const u of [userA, userB]) {
      try {
        await admin.auth.admin.deleteUser(u.id);
      } catch {
        /* best effort */
      }
    }
  };
  return { userA, userB, admin, cleanup };
}
