"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Gamepad2,
  Users,
  Bot,
  ArrowLeftRight,
  Menu,
  X,
  ChevronLeft,
  LogOut,
  Landmark,
  Inbox,
  Banknote,
  PiggyBank,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const SIDEBAR_STORAGE_KEY = "odfinex-admin-sidebar-open";

type AdminLayoutProps = {
  children: React.ReactNode;
  user: {
    id: string;
    displayName?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  };
  pendingDeposits?: number;
  pendingWithdrawals?: number;
};

export function AdminLayout({
  children,
  user,
  pendingDeposits = 0,
  pendingWithdrawals = 0,
}: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) setSidebarOpen(stored === "true");
  }, []);

  function toggleSidebar() {
    setSidebarOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }

  const navSections: NavSection[] = [
    {
      title: "General",
      items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
    },
    {
      title: "Jeux",
      items: [{ label: "Jeux", href: "/games", icon: Gamepad2 }],
    },
    {
      title: "Comptes",
      items: [
        { label: "Joueurs", href: "/players", icon: Users },
        { label: "Comptes & Bots", href: "/accounts", icon: Bot },
      ],
    },
    {
      title: "Activite",
      items: [{ label: "Transactions", href: "/transactions", icon: ArrowLeftRight }],
    },
    {
      title: "Finance",
      items: [
        { label: "Tableau de bord finance", href: "/finance", icon: PiggyBank },
        { label: "Payment rails", href: "/payment-rails", icon: Landmark },
        { label: "Depots NatCash", href: "/deposit-requests", icon: Inbox, badge: pendingDeposits },
        { label: "Retraits", href: "/withdrawal-requests", icon: Banknote, badge: pendingWithdrawals },
      ],
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-sidebar transition-all duration-300 ease-in-out",
          sidebarOpen ? "w-60" : "w-0 -translate-x-full lg:w-16 lg:translate-x-0",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          {sidebarOpen && (
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="text-primary">Odfinex</span>
              <span className="text-muted-foreground">Admin</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hidden lg:inline-flex"
            aria-label="Toggle sidebar"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform duration-200", !sidebarOpen && "rotate-180")} />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-2 py-3">
          <nav className="flex flex-col gap-4">
            {navSections.map((section) => (
              <div key={section.title} className="flex flex-col gap-1">
                {sidebarOpen && (
                  <p className="px-3 pb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {section.title}
                  </p>
                )}
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {sidebarOpen && <span className="flex-1">{item.label}</span>}
                      {!!item.badge && (
                        <span
                          className={cn(
                            "flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.7rem] font-semibold text-primary-foreground",
                            !sidebarOpen && "absolute right-1 top-1 h-4 min-w-4 text-[0.6rem]",
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={cn("flex flex-1 flex-col transition-all duration-300", sidebarOpen ? "lg:pl-60" : "lg:pl-16")}>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="lg:hidden"
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {(user.displayName ?? user.email ?? "A").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">{user.displayName ?? user.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/api/auth/signout">
                  <LogOut className="mr-2 h-4 w-4" />
                  Deconnexion
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
