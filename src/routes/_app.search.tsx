import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { Search, Package, Building2, Truck, Users, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_app/search")({
  component: SearchPage,
});

type SearchResultGroup<T> = {
  title: string;
  icon: typeof Search;
  href: string;
  items: T[];
};

type UserResult = {
  id: string;
  name: string;
  email: string;
  role?: string;
};

type CustomerResult = {
  id: string;
  company?: string;
  contact?: string;
  email?: string;
  agentName?: string;
};

type CarrierResult = {
  id: string;
  legalName?: string;
  companyName?: string;
  dba?: string;
  mcNumber?: string;
  dotNumber?: string;
  contactName?: string;
  contactEmail?: string;
};

type LoadResult = {
  id: string;
  ref?: string;
  loadNumber?: string;
  customerName?: string;
  carrierName?: string;
  status?: string;
};

function SearchPage() {
  const [query, setQuery] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") ?? "";
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultGroup<any>[]>([]);

  useEffect(() => {
    const syncQuery = () => {
      const nextQuery = new URLSearchParams(window.location.search).get("q") ?? "";
      setQuery(nextQuery);
    };

    syncQuery();
    window.addEventListener("popstate", syncQuery);
    return () => window.removeEventListener("popstate", syncQuery);
  }, []);

  const q = query;

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    let active = true;
    setLoading(true);

    async function loadResults() {
      try {
        const [usersResponse, customersResponse, carriersResponse, loadsResponse] = await Promise.all([
          apiFetch<{ users?: UserResult[]; total?: number }>('/api/users?search=' + encodeURIComponent(q.trim()) + '&pageSize=5'),
          apiFetch<{ customers?: CustomerResult[] }>('/api/customers'),
          apiFetch<{ carriers?: CarrierResult[] }>('/api/carriers?limit=5&q=' + encodeURIComponent(q.trim())),
          apiFetch<{ loads?: LoadResult[] }>('/api/loads'),
        ]);

        if (!active) return;

        const searchTerm = q.trim().toLowerCase();
        const users = (usersResponse.data.users ?? []).filter((item) =>
          [item.name, item.email, item.role].some((value) => value?.toLowerCase().includes(searchTerm)),
        );
        const customers = (customersResponse.data.customers ?? []).filter((item) =>
          [item.company, item.contact, item.email, item.agentName].some((value) => value?.toLowerCase().includes(searchTerm)),
        );
        const carriers = (carriersResponse.data.carriers ?? []).filter((item) =>
          [item.legalName, item.companyName, item.dba, item.mcNumber, item.dotNumber, item.contactName, item.contactEmail].some((value) => value?.toLowerCase().includes(searchTerm)),
        );
        const loads = (loadsResponse.data.loads ?? []).filter((item) =>
          [item.ref, item.loadNumber, item.customerName, item.carrierName, item.status].some((value) => value?.toLowerCase().includes(searchTerm)),
        );

        setResults([
          {
            title: 'Users',
            icon: Users,
            href: '/users',
            items: users.slice(0, 5),
          },
          {
            title: 'Customers',
            icon: Building2,
            href: '/customers',
            items: customers.slice(0, 5),
          },
          {
            title: 'Carriers',
            icon: Truck,
            href: '/carriers',
            items: carriers.slice(0, 5),
          },
          {
            title: 'Loads',
            icon: Package,
            href: '/loads',
            items: loads.slice(0, 5),
          },
        ].filter((group) => group.items.length > 0));
      } catch (error) {
        console.error(error);
        if (active) {
          setResults([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadResults();
    return () => {
      active = false;
    };
  }, [q]);

  const hasQuery = q.trim().length > 0;
  const hasResults = results.length > 0;

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    if (typeof window !== "undefined") {
      const nextUrl = new URL("/search", window.location.origin);
      nextUrl.searchParams.set("q", trimmed);
      window.location.assign(nextUrl.toString());
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search"
        description={hasQuery ? `Results for “${q}”` : "Search across loads, customers, carriers, and users."}
      />

      <form onSubmit={submitSearch} className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, email, reference, company, or MC number"
              className="h-10 pl-9"
            />
          </div>
          <Button type="submit" className="sm:w-auto">
            Search
          </Button>
        </div>
      </form>

      {!hasQuery ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Enter a term to search across the portal.
        </div>
      ) : loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Looking for matches...
        </div>
      ) : !hasResults ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No matching records found for “{q}”.
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.title} className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    <h2 className="text-sm font-semibold">{group.title}</h2>
                  </div>
                  <Link to={group.href} className="text-sm text-primary hover:underline">
                    View all
                  </Link>
                </div>

                <ul className="space-y-2">
                  {group.items.map((item, index) => {
                    const primary =
                      (item as any).name ??
                      (item as any).company ??
                      (item as any).legalName ??
                      (item as any).companyName ??
                      (item as any).ref ??
                      (item as any).loadNumber ??
                      "Untitled";
                    const secondary =
                      (item as any).email ??
                      (item as any).contact ??
                      (item as any).contactName ??
                      (item as any).contactEmail ??
                      (item as any).customerName ??
                      (item as any).carrierName ??
                      (item as any).role ??
                      (item as any).status ??
                      "";

                    return (
                      <li key={index} className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{primary}</div>
                          {secondary ? <div className="truncate text-xs text-muted-foreground">{secondary}</div> : null}
                        </div>
                        <ArrowRight className="ml-3 size-4 shrink-0 text-muted-foreground" />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
