import { useRef, useState } from "react";
import { ArrowUpRight, CalendarDays, LogOut, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AppLogo } from "@/components/AppLogo";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const links = [
  { href: "/courts", label: "Courts" },
  { href: "/open-play", label: "Open Play" },
  { href: "/bookings", label: "My bookings" },
  { href: "/help", label: "Help" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const handleSignOut = async () => {
    try { await signOut(); }
    catch { toast({ title: "Could not sign out", description: "Please try again.", variant: "destructive" }); }
  };
  const closeMenu = () => setOpen(false);
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-brand-ink/10 bg-white text-brand-ink [color-scheme:light]"
      onKeyDown={(event) => { if (event.key === "Escape" && open) { closeMenu(); menuButton.current?.focus(); } }}>
      <a href="#main-content" className="absolute left-4 top-3 z-50 -translate-y-24 rounded-lg bg-brand-ink px-4 py-3 text-sm text-white focus:translate-y-0">Skip to content</a>
      <nav aria-label="Main navigation" className="site-container flex h-24 items-center justify-between gap-4">
        <Link to="/" aria-label="The Pickle Box home" onClick={closeMenu} className="shrink-0">
          <AppLogo className="h-[70px] w-24 rounded-none" />
        </Link>
        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link key={link.href} to={link.href} aria-current={location.pathname === link.href ? "page" : undefined}
              className={cn("rounded-lg px-4 py-3 text-sm font-semibold transition-colors hover:bg-brand-ink/5 focus-visible:outline-brand-ink",
                location.pathname === link.href && "bg-brand-lime/30")}>{link.label}</Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="border-brand-ink/15 bg-white text-brand-ink hover:bg-brand-ink/5 hover:text-brand-ink" />
          <div className="hidden lg:block">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="max-w-[160px] gap-2 text-brand-ink hover:bg-brand-ink/5 hover:text-brand-ink">
                    <User className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{user.user_metadata?.full_name || "My account"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild><Link to="/profile"><User className="mr-2 h-4 w-4" />My profile</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/bookings"><CalendarDays className="mr-2 h-4 w-4" />My bookings</Link></DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleSignOut()}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : <Link to="/auth" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold focus-visible:outline-brand-ink">Sign in</Link>}
          </div>
          <Link to="/courts" className="action-link hidden min-h-11 items-center gap-5 rounded-lg bg-brand-ink px-5 text-sm font-bold text-white hover:bg-brand-ink/90 focus-visible:outline-brand-ink sm:inline-flex">
            Book a court <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button ref={menuButton} type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-site-nav"
            onClick={() => setOpen((current) => !current)} className="grid h-11 w-11 place-items-center rounded-lg border border-brand-ink/15 hover:bg-brand-ink/5 focus-visible:outline-brand-ink lg:hidden">
            <span className="menu-glyph" data-open={open} aria-hidden="true"><span /><span /></span>
          </button>
        </div>
      </nav>
      {open && (
        <nav id="mobile-site-nav" aria-label="Mobile navigation" className="menu-enter site-container max-h-[calc(100dvh-6rem)] overflow-y-auto border-t border-brand-ink/10 py-5 lg:hidden">
          <div className="grid gap-1">
            {links.map((link) => <Link key={link.href} to={link.href} onClick={closeMenu}
              aria-current={location.pathname === link.href ? "page" : undefined}
              className={cn("rounded-lg px-3 py-3 text-base font-semibold hover:bg-brand-ink/5", location.pathname === link.href && "bg-brand-lime/30")}>{link.label}</Link>)}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-brand-ink/10 pt-4">
            <Link to={user ? "/profile" : "/auth"} onClick={closeMenu} className="min-h-11 content-center px-3 text-sm font-semibold">{user ? "My profile" : "Sign in"}</Link>
            {user && <button type="button" onClick={() => { closeMenu(); void handleSignOut(); }} className="min-h-11 px-3 text-sm">Sign out</button>}
            <Link to="/courts" onClick={closeMenu} className="ml-auto min-h-11 content-center rounded-lg bg-brand-lime px-5 text-sm font-bold">Book a court</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
