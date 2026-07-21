/**
 * Verified-TLS pg client factory for the Turn 2a preflight and later route tests.
 *
 * - Uses `rejectUnauthorized: true`.
 * - Pins the Supabase root CA (bundled in the sandbox at /tmp/supabase-ca.crt,
 *   or SUPABASE_CA_CERT_PATH if provided by CI).
 * - Never logs the password, service key, or CA contents.
 */
import { Client, type ClientConfig } from "pg";
import fs from "node:fs";

function loadSupabaseCa(): string {
  const explicit = process.env.SUPABASE_CA_CERT_PATH;
  const candidates = [
    explicit,
    "/tmp/supabase-ca.crt",
    "/etc/ssl/certs/supabase-ca.crt",
  ].filter((p): p is string => typeof p === "string" && p.length > 0);
  for (const p of candidates) {
    try {
      const buf = fs.readFileSync(p);
      if (buf.length > 0) return buf.toString("utf8");
    } catch { /* try next */ }
  }
  throw new Error(
    "verifiedPg: Supabase CA not found. Place the prod CA at /tmp/supabase-ca.crt " +
    "or set SUPABASE_CA_CERT_PATH. Do NOT disable certificate verification.",
  );
}

export function createVerifiedPgClient(overrides: Partial<ClientConfig> = {}): Client {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) throw new Error("verifiedPg: SUPABASE_DB_URL required.");
  const ca = loadSupabaseCa();
  return new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: true, ca },
    ...overrides,
  });
}
