import { ArrowUpRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { AppLogo } from "@/components/AppLogo";

export function Footer() {
  return (
    <footer className="bg-brand-ink text-white">
      <div className="site-container pb-6 pt-12 md:pt-16">
        <div className="grid gap-10 pb-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_.7fr_1fr]">
          <div>
            <Link to="/" aria-label="The Pickle Box home" className="inline-block rounded-lg bg-white p-2"><AppLogo className="h-16 w-24" /></Link>
            <p className="mt-5 max-w-xs text-sm leading-6 text-white/70">A place to play. A reason to connect.<br />A community to belong to.</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Make a plan</h2>
            <div className="mt-4 flex flex-col items-start gap-3 text-sm text-white/70">
              <Link to="/courts" className="hover:text-brand-lime">Book a court</Link>
              <Link to="/open-play" className="hover:text-brand-lime">Open Play</Link>
              <Link to="/bookings" className="hover:text-brand-lime">My bookings</Link>
              <Link to="/help" className="hover:text-brand-lime">Help & questions</Link>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Find your way here</h2>
            <p className="mt-4 flex gap-2 text-sm leading-6 text-white/70"><MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" /><span>Endrina St., San Carlos City<br />Negros Occidental, Philippines</span></p>
            <a href="https://www.google.com/maps/search/?api=1&query=The+Pickle+Box+Endrina+Street+San+Carlos+City+Negros+Occidental"
              target="_blank" rel="noreferrer" className="text-link mt-3 text-brand-lime">Get directions <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-white/15 pr-20 pt-5 text-xs text-white/60 md:pr-48">
          <p>© {new Date().getFullYear()} The Pickle Box.</p><p>Play. Connect. Belong.</p>
        </div>
      </div>
    </footer>
  );
}
