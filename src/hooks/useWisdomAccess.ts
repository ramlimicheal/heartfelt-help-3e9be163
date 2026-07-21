import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type WisdomAccessState =
  | { status: "loading" }
  | { status: "allowed"; mode: "canary" | "on" }
  | {
      status: "denied";
      mode: "off" | "canary" | "on";
      reason:
        | "unified_disabled"
        | "unauthenticated"
        | "email_unverified"
        | "canary_denied"
        | "misconfigured"
        | "network_error";
    };

/**
 * Read-only probe of the Wisdom unified-turn access gate.
 * Uses the server's verified claims (never trusts client identity).
 */
export function useWisdomAccess(): WisdomAccessState {
  const [state, setState] = useState<WisdomAccessState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const res = await fetch("/api/wisdom/access", {
          method: "GET",
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });
        const body = (await res.json()) as {
          allowed: boolean;
          mode: "off" | "canary" | "on";
          reason?: WisdomAccessState extends { status: "denied"; reason: infer R } ? R : never;
        };
        if (cancelled) return;
        if (body.allowed && (body.mode === "canary" || body.mode === "on")) {
          setState({ status: "allowed", mode: body.mode });
        } else {
          setState({
            status: "denied",
            mode: body.mode,
            reason: (body.reason ?? "unified_disabled") as never,
          });
        }
      } catch {
        if (!cancelled) {
          setState({ status: "denied", mode: "off", reason: "network_error" });
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setState({ status: "loading" });
        // Trigger re-run by scheduling a microtask that flips cancelled ref
        // — simpler: force a state reset then rerun via effect dep.
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
