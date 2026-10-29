import { ArrowUpRight, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { Reveal } from "@/components/motion/Reveal";
import heroImage from "@/assets/brand/picklebox-hero-blue-hour.png";

export function HeroSection() {
  return (
    <section className="bg-background px-3 pb-6 pt-[94px] md:px-8 md:pb-8 md:pt-[118px]">
      <div className="group relative mx-auto flex min-h-[720px] max-w-[1480px] items-end overflow-hidden rounded-[2rem] ring-1 ring-border md:min-h-[780px] md:rounded-[2.5rem]">
        <img
          src={heroImage}
          alt="A floodlit pickleball court in San Carlos City"
          width={1672}
          height={941}
          className="absolute inset-0 h-full w-full object-cover object-[62%_center] transition-transform duration-[1800ms] ease-[cubic-bezier(.32,.72,0,1)] group-hover:scale-[1.025]"
        />
        <div className="media-scrim-hero absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-brand-night/90 to-transparent" />
        <svg
          className="pointer-events-none absolute inset-x-0 bottom-0 h-44 w-full text-brand-lime/25"
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M-40 145C205 53 415 173 692 111s440-3 798-88" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M-40 158C206 82 410 192 698 131s466 2 782-82" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
        <div className="relative z-10 w-full px-7 pb-10 pt-32 text-brand-chalk md:px-14 md:pb-14 lg:px-24">
          <div className="max-w-[750px]">
            <Reveal variant="left">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-brand-chalk/30 bg-brand-night/85 px-4 py-2 text-xs font-extrabold shadow-sm backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-brand-lime" />
                Courts are open tonight
              </div>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="font-display text-[2.75rem] leading-[.93] sm:text-7xl md:text-8xl lg:text-[6.9rem]">
                The court is
                <br />
                <span className="text-brand-lime">calling your name.</span>
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-7 max-w-[560px] rounded-r-2xl border-l-2 border-brand-lime bg-brand-night/90 px-5 py-4 text-base font-semibold leading-7 shadow-lg md:text-lg">
                Book a court, bring your favorite people, and make one more game the plan for tonight.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  to="/courts"
                  className="group inline-flex h-14 items-center gap-4 rounded-full bg-brand-lime py-1 pl-6 pr-1 text-sm font-extrabold text-brand-ink transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[.98]"
                >
                  Book a court
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-ink text-brand-lime transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)] group-hover:translate-x-1 group-hover:-translate-y-0.5">
                    <ArrowUpRight className="h-5 w-5 stroke-[1.5]" aria-hidden="true" />
                  </span>
                </Link>
                <Link
                  to="/open-play"
                  className="inline-flex h-14 items-center gap-3 rounded-full border border-brand-chalk/40 bg-brand-night/45 px-6 text-sm font-bold text-brand-chalk transition-colors duration-500 ease-[cubic-bezier(.32,.72,0,1)] hover:bg-brand-chalk/10"
                >
                  <CalendarDays className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                  See Open Play
                </Link>
              </div>
            </Reveal>
          </div>
          <Reveal delay={420}>
            <div className="mt-16 grid max-w-[630px] grid-cols-3 gap-2 border-t border-brand-chalk/30 pt-4 text-[10px] font-bold text-brand-chalk/90 sm:text-xs">
              <span>Book by the hour</span>
              <span>Open Play nights</span>
              <span>San Carlos City</span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
