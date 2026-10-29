import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Reveal } from "@/components/motion/Reveal";
import nightCourtImage from "@/assets/brand/picklebox-night-court.png";

export function CTASection() {
  return (
    <section className="bg-background px-3 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8">
      <div className="group relative mx-auto overflow-hidden rounded-[2rem] ring-1 ring-border md:max-w-[1480px] md:rounded-[2.5rem]">
        <img
          src={nightCourtImage}
          alt="An available pickleball court under lights at night"
          width={1672}
          height={941}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1800ms] ease-[cubic-bezier(.32,.72,0,1)] group-hover:scale-[1.025]"
        />
        <div className="media-scrim-cta absolute inset-0" />
        <div className="relative z-10 px-7 py-28 text-brand-chalk md:px-14 md:py-36 lg:px-24">
          <Reveal variant="left">
            <p className="text-sm font-extrabold text-brand-lime">Your next game starts here</p>
            <h2 className="font-display mt-5 max-w-3xl text-[2.75rem] leading-[.92] sm:text-5xl md:text-7xl">
              Get your people
              <br />
              on the court.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-6 max-w-md text-base font-semibold leading-7 text-brand-chalk">
              A couple of taps now. A good evening later.
            </p>
          </Reveal>
          <Reveal delay={260}>
            <Link
              to="/courts"
              className="group/cta inline-flex h-14 items-center gap-4 rounded-full bg-brand-lime py-1 pl-6 pr-1 text-sm font-extrabold text-brand-ink transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[.98]"
            >
              See available courts
              <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-ink text-brand-lime transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)] group-hover/cta:translate-x-1 group-hover/cta:-translate-y-0.5">
                <ArrowUpRight className="h-5 w-5 stroke-[1.5]" aria-hidden="true" />
              </span>
            </Link>
          </Reveal>
          <Reveal delay={360}>
            <p className="mt-10 flex w-fit items-center gap-2 rounded-full border border-brand-chalk/25 bg-brand-night/85 px-3 py-2 text-xs font-extrabold text-brand-chalk shadow-lg">
              <ShieldCheck className="h-4 w-4 stroke-[1.5] text-brand-lime" aria-hidden="true" />
              Clear confirmation and secure GCash payment.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
