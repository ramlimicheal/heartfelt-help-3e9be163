import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/home")({
  component: () => <Navigate to="/wisdom" />,
});
