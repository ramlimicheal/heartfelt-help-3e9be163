import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { SESSIONS } from "@/lib/wisdom/mock/seed";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // Wisdom lives at /wisdom; index redirects there.
    throw redirect({ to: "/wisdom" });
  },
  component: () => null,
});

export const _unused = SESSIONS; // keep import graph stable if seed changes
export const _link = Link;
