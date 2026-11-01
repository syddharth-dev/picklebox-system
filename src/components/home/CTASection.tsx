import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export function CTASection() {
  return (
    <section className="bg-brand-lime text-brand-ink">
      <div className="site-container flex flex-col justify-between gap-8 py-14 sm:flex-row sm:items-center md:py-16">
        <h2 className="font-display text-6xl uppercase leading-[.92] md:text-8xl">See you<br className="sm:hidden" /> on court.</h2>
        <Link to="/courts" className="action-link flex min-h-14 w-fit items-center gap-12 rounded-lg bg-brand-ink px-6 text-sm font-bold text-white hover:bg-brand-ink/90 focus-visible:outline-brand-ink">
          Book your next game <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
