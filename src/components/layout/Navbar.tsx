import { useState } from "react";
import { ArrowUpRight, LogOut, Menu, User, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AppLogo } from "@/components/AppLogo";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/courts", label: "Courts" },
  { href: "/open-play", label: "Open Play" },
  { href: "/faq", label: "Help" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const closeMenu = () => setOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 md:px-8 md:pt-7">
      <nav className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between rounded-full border border-border/80 bg-card/90 px-4 text-foreground shadow-lg backdrop-blur-xl md:px-7">
        <Link to="/" className="flex items-center gap-3" onClick={closeMenu}>
          <AppLogo />
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "text-sm font-bold transition-colors duration-500 ease-[cubic-bezier(.32,.72,0,1)] hover:text-primary",
                location.pathname === link.href ? "text-primary" : "text-foreground/68",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-full">
                  <User className="mr-2 h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                  {user.user_metadata?.full_name || user.email?.split("@")[0]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/profile">My profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void signOut()}>
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link
                to="/auth"
                className="inline-flex h-10 items-center rounded-full px-4 text-sm font-bold text-foreground/75 transition-colors duration-500 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Sign in
              </Link>
              <Link
                to="/courts"
                className="group inline-flex h-11 items-center gap-3 rounded-full bg-brand-lime py-1 pl-5 pr-1 text-sm font-extrabold text-brand-ink transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[.98]"
              >
                <span>Book a court</span>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-ink text-brand-lime transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                </span>
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            className="grid h-10 w-10 place-items-center rounded-full border border-border text-foreground transition-[background-color,color,transform] duration-500 ease-[cubic-bezier(.32,.72,0,1)] hover:bg-accent hover:text-accent-foreground active:scale-[.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {open ? (
              <X className="h-5 w-5 stroke-[1.5]" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5 stroke-[1.5]" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="mx-auto mt-3 max-w-[1320px] overflow-hidden rounded-[2rem] border border-border bg-card/95 p-6 text-foreground shadow-xl backdrop-blur-xl lg:hidden">
          <div className="flex flex-col gap-2">
            {links.map((link, index) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={closeMenu}
                className="font-display translate-y-0 py-2 text-4xl text-foreground transition-[color,transform] duration-500 ease-[cubic-bezier(.32,.72,0,1)] hover:text-primary"
                style={{ transitionDelay: `${index * 45}ms` }}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-5 border-t border-border pt-5">
              {user ? (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="text-sm font-bold text-primary"
                >
                  Sign out
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    onClick={closeMenu}
                    to="/auth"
                    className="text-sm font-bold text-foreground"
                  >
                    Sign in
                  </Link>
                  <Link
                    onClick={closeMenu}
                    to="/courts"
                    className="inline-flex items-center gap-3 text-sm font-bold text-primary"
                  >
                    Book a court
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
