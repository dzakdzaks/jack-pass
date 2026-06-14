import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BrandMark } from "@/ui/BrandMark";
import { SyncStatus } from "@/features/sync/SyncStatus";
import { useVault } from "@/features/vault/vaultStore";
import { cn } from "@/ui/cn";

const navItems = [
  { to: "/", label: "Vault", end: true },
  { to: "/generator", label: "Generator", end: false },
  { to: "/settings", label: "Settings", end: false },
];

export function AppLayout() {
  const lock = useVault((s) => s.lock);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh flex-col bg-surface-soft sm:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-[240px] shrink-0 flex-col gap-[24px] border-r border-hairline bg-canvas p-[24px] sm:flex">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-[10px] text-left"
        >
          <BrandMark size={32} />
          <span className="text-[18px] font-semibold text-ink">JackPass</span>
        </button>
        <nav className="flex flex-col gap-[4px]">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "rounded-[12px] px-[16px] py-[10px] text-[15px] font-semibold",
                  isActive ? "bg-surface-strong text-ink" : "text-body hover:bg-surface-soft",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-[12px]">
          <SyncStatus />
          <button
            type="button"
            onClick={lock}
            className="rounded-[100px] border border-hairline px-[16px] py-[10px] text-[14px] font-semibold text-ink hover:bg-surface-soft"
          >
            Lock vault
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-hairline bg-canvas px-[16px] py-[12px] sm:hidden">
        <div className="flex items-center gap-[8px]">
          <BrandMark size={28} />
          <span className="text-[16px] font-semibold text-ink">JackPass</span>
        </div>
        <div className="flex items-center gap-[8px]">
          <SyncStatus />
          <button
            type="button"
            onClick={lock}
            aria-label="Lock vault"
            className="rounded-[100px] border border-hairline px-[12px] py-[6px] text-[13px] font-semibold text-ink"
          >
            Lock
          </button>
        </div>
      </header>

      <main className="min-w-0 flex-1 pb-[72px] sm:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-hairline bg-canvas sm:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-[2px] py-[10px] text-[12px] font-semibold",
                isActive ? "text-primary" : "text-muted",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
