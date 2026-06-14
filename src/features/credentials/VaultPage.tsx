import { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useVault } from "@/features/vault/vaultStore";
import { Button } from "@/ui/Button";
import { Badge } from "@/ui/Badge";
import { cn } from "@/ui/cn";
import { allTags, filterCredentials } from "./search";

export function VaultPage() {
  const items = useVault((s) => s.unlocked?.data.items ?? []);
  const navigate = useNavigate();
  const location = useLocation();
  const detailActive = location.pathname !== "/";

  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const tags = useMemo(() => allTags(items), [items]);
  const filtered = useMemo(
    () => filterCredentials(items, { query, tag, favoritesOnly }),
    [items, query, tag, favoritesOnly],
  );

  const selectedId = location.pathname.match(/\/credentials\/([^/]+)/)?.[1] ?? null;

  return (
    <div className="flex h-full">
      {/* List pane: hidden on mobile when a detail route is active */}
      <section
        className={cn(
          "flex w-full flex-col border-r border-hairline bg-canvas sm:w-[380px] sm:shrink-0",
          detailActive && "hidden sm:flex",
        )}
      >
        <div className="flex flex-col gap-[12px] border-b border-hairline p-[16px]">
          <div className="flex items-center gap-[12px]">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vault"
              aria-label="Search vault"
              className="h-[44px] w-full rounded-[100px] border-0 bg-surface-strong px-[20px] text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button onClick={() => navigate("/credentials/new")} aria-label="Add credential">
              Add
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-[8px]">
            <FilterChip active={favoritesOnly} onClick={() => setFavoritesOnly((v) => !v)}>
              Favorites
            </FilterChip>
            {tags.map((t) => (
              <FilterChip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                {t}
              </FilterChip>
            ))}
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <li className="p-[32px] text-center text-[14px] text-muted">
              {items.length === 0 ? "Your vault is empty. Add your first credential." : "No matches."}
            </li>
          )}
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => navigate(`/credentials/${item.id}`)}
                className={cn(
                  "flex w-full items-center gap-[12px] border-b border-hairline-soft px-[16px] py-[14px] text-left hover:bg-surface-soft",
                  selectedId === item.id && "bg-surface-strong",
                )}
              >
                <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-surface-strong text-[16px] font-semibold text-ink">
                  {(item.title || "?").charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-[8px]">
                    <span className="truncate text-[15px] font-semibold text-ink">
                      {item.title || "Untitled"}
                    </span>
                    {item.favorite && <span aria-label="Favorite" className="text-accent-yellow">★</span>}
                  </span>
                  <span className="block truncate text-[13px] text-muted">{item.username || item.url}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Detail pane */}
      <section className={cn("min-w-0 flex-1", !detailActive && "hidden sm:block")}>
        <Outlet />
      </section>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="focus:outline-none">
      <Badge tone={active ? "brand" : "neutral"}>{children}</Badge>
    </button>
  );
}

export function VaultEmptyDetail() {
  return (
    <div className="hidden h-full items-center justify-center p-[48px] text-center text-[15px] text-muted sm:flex">
      Select a credential to view its details.
    </div>
  );
}
