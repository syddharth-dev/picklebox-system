import { ArrowUpRight, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Reveal } from "@/components/motion/Reveal";
import openPlayImage from "@/assets/brand/picklebox-open-play.png";

export function OpenPlayHighlight() {
  return (
    <section className="bg-background px-6 py-28 text-foreground md:px-10 md:py-36 lg:px-16">
      <div className="mx-auto max-w-[1320px]">
        <div className="grid gap-10 md:grid-cols-12 md:items-end">
          <Reveal variant="left" className="md:col-span-7">
            <p className="text-sm font-bold tracking-wide text-muted-foreground">Open Play</p>
            <h2 className="font-display mt-5 max-w-2xl text-[2.75rem] leading-[.92] sm:text-5xl md:text-7xl">
              You don’t need a full
              <br />
              team to play.
            </h2>
          </Reveal>
          <Reveal variant="right" delay={120} className="md:col-span-4 md:col-start-9">
            <p className="text-base leading-7 text-muted-foreground">
              Come by yourself, rotate in, and leave knowing a few more people who are always up for a game.
            </p>
            <Link to="/open-play" className="group mt-7 inline-flex items-center gap-3 text-sm font-extrabold">
              Find an Open Play slot
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)] group-hover:translate-x-1 group-hover:-translate-y-0.5">
                <ArrowUpRight className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
              </span>
            </Link>
          </Reveal>
        </div>

        <Reveal variant="scale" delay={160}>
          <div className="group relative mt-14 overflow-hidden rounded-[2rem] bg-foreground/10 p-1 ring-1 ring-border transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-1">
            <div className="relative overflow-hidden rounded-[1.7rem]">
              <img
                src={openPlayImage}
                alt="Friends playing an evening doubles rally"
                width={1672}
                height={941}
                loading="lazy"
                className="h-[430px] w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(.32,.72,0,1)] group-hover:scale-[1.035] md:h-[580px]"
              />
              <div className="media-scrim-bottom absolute inset-0" />
              <div className="absolute bottom-0 left-0 max-w-lg p-6 text-brand-chalk md:p-10">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-lime text-brand-ink transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)] group-hover:rotate-[-8deg] group-hover:scale-110">
                  <UsersRound className="h-5 w-5 stroke-[1.4]" aria-hidden="true" />
                </span>
                <p className="font-display mt-5 text-3xl leading-[1.04] md:text-4xl">
                  A relaxed rally is a very good way to meet the neighborhood.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
