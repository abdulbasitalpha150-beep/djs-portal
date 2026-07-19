import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  if (typeof window !== "undefined") {
    navigate({ to: "/login", replace: true });
  }
  return null;
}
