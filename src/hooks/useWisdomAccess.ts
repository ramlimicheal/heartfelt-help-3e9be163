import { useSession } from "./useSession";

export type WisdomAccessState =
  | { status: "loading" }
  | { status: "allowed"; mode: "on" }
  | { status: "denied"; mode: "on"; reason: "unauthenticated" };

/**
 * Access is now simply "are you signed in?". No founder allowlist.
 */
export function useWisdomAccess(): WisdomAccessState {
  const { user, ready } = useSession();
  if (!ready) return { status: "loading" };
  if (!user) return { status: "denied", mode: "on", reason: "unauthenticated" };
  return { status: "allowed", mode: "on" };
}
