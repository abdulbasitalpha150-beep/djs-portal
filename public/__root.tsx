import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Route Not Found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The requested page doesn't exist or may have been moved.
        </p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground">
          Return to Portal
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    console.error("Application Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Unable to Load Page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred while loading this page. Please try again.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
            Try Again
          </button>
          <a href="/" className="rounded-md border px-4 py-2">Dashboard</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DJ's Freight Broker LLC | Secure Agent Portal" },
      { name: "description", content: "Secure internal portal for DJ's Freight Broker LLC agents and operations staff." },
      { name: "keywords", content: "freight broker, logistics, dispatch, loads, carriers, trucking" },
      { name: "author", content: "DJ's Freight Broker LLC" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "theme-color", content: "#0F172A" },
      { property: "og:title", content: "DJ's Freight Broker LLC | Secure Agent Portal" },
      { property: "og:description", content: "Internal operations portal for authorized personnel." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://djs-portal.vercel.app" },
      { property: "og:site_name", content: "DJ's Freight Broker LLC" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "DJ's Freight Broker LLC | Secure Agent Portal" },
      { name: "twitter:description", content: "Internal operations portal for authorized personnel." },
      { name: "application-name", content: "DJ's Freight Portal" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: "https://djs-portal.vercel.app" },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const themeInit = `(function(){try{const s=localStorage.getItem("theme");const d=matchMedia("(prefers-color-scheme: dark)").matches;const t=s==="light"||s==="dark"?s:(d?"dark":"light");document.documentElement.dataset.theme=t;document.documentElement.classList.toggle("dark",t==="dark");document.documentElement.style.colorScheme=t;}catch{document.documentElement.dataset.theme="dark";document.documentElement.style.colorScheme="dark";}})();`;
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
