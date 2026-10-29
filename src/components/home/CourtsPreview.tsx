import { ArrowUpRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Reveal } from "@/components/motion/Reveal";
import venueImage from "@/assets/brand/picklebox-venue-dusk.png";

export function CourtsPreview() {
  return (
    <section id="courts" className="bg-brand-lime px-6 py-28 text-brand-ink md:px-10 md:py-36 lg:px-16">
      <div className="mx-auto max-w-[1320px]">
        <div className="grid gap-10 md:grid-cols-12 md:items-end">
          <Reveal variant="left" className="md:col-span-7">
            <p className="text-sm font-bold tracking-wide text-brand-ink/65">Your neighborhood court club</p>
            <h2 className="font-display mt-5 max-w-2xl text-[2.75rem] leading-[.92] sm:text-5xl md:text-7xl">
              The place for
              <br />
              one more game.
            </h2>
          </Reveal>
          <Reveal variant="right" delay={120} className="md:col-span-4 md:col-start-9">
            <p className="text-base leading-7 text-brand-ink/72">
              Good light, good courts, and a little more time outside. Come for a reservation or make an evening of it.
            </p>
            <Link to="/courts" className="group mt-7 inline-flex items-center gap-3 text-sm font-extrabold">
              Explore our courts
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-ink text-brand-lime transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)] group-hover:translate-x-1 group-hover:-translate-y-0.5">
                <ArrowUpRight className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
              </span>
            </Link>
          </Reveal>
        </div>

        <Reveal variant="scale" delay={160}>
          <div className="group mt-14 rounded-[2rem] bg-brand-ink/10 p-1 ring-1 ring-brand-ink/15 transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-1">
            <div className="relative overflow-hidden rounded-[1.7rem]">
              <img
                src={venueImage}
                alt="The Pickle Box courts glowing at dusk"
                width={1672}
                height={941}
                loading="lazy"
                className="h-[440px] w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(.32,.72,0,1)] group-hover:scale-[1.035] md:h-[580px]"
              />
              <div className="media-scrim-bottom absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 flex flex-col justify-between gap-5 p-6 text-brand-chalk md:flex-row md:items-end md:p-10">
                <div>
                  <p className="font-display text-3xl">A home court feeling.</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-brand-chalk/72">
                    Find the court that fits the day, then make the rest of the evening yours.
                  </p>
                </div>
                <p className="flex items-center gap-2 text-xs font-bold text-brand-lime">
                  <MapPin className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                  San Carlos City, Negros Occidental
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
