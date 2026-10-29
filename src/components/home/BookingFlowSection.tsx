import { useEffect, useState } from "react";
import { CalendarCheck2, Search, SmilePlus } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import arrivalImage from "@/assets/brand/picklebox-arrival-desk.png";

const routePath = "M0 45C170 12 325 70 500 37s320 24 500-21";
const steps = [
  { icon: Search, title: "Find a court", text: "Choose a date, a time, and the court that fits your crew." },
  { icon: CalendarCheck2, title: "Reserve your slot", text: "Confirm in a few taps with GCash, then keep the details in one place." },
  { icon: SmilePlus, title: "Show up to play", text: "Your court is ready. Bring your paddle—or simply bring the group." },
];

export function BookingFlowSection() {
  const { ref: routeRef, isInView: routeActive } = useInView<HTMLDivElement>(0.45);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
  }, []);

  return (
    <section className="overflow-hidden bg-muted/35 px-6 py-28 text-foreground md:px-10 md:py-36 lg:px-16">
      <div className="mx-auto max-w-[1320px]">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold tracking-wide text-muted-foreground">How booking works</p>
          <h2 className="font-display mt-5 text-[2rem] leading-[.98] sm:text-5xl md:text-7xl">
            From “who’s free?”
            <br />
            to <span className="text-primary">“see you there.”</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground">
            The practical stuff should never get in the way of a good rally.
          </p>
        </div>

        <div ref={routeRef} className="relative mt-16">
          <svg
            className="pointer-events-none absolute left-[16.5%] top-[40px] hidden h-10 w-[67%] overflow-visible text-foreground/25 md:block"
            viewBox="0 0 1000 80"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={routePath} fill="none" stroke="currentColor" strokeDasharray="8 11" strokeWidth="2" strokeLinecap="round" />
            {routeActive ? (
              <>
                <path
                  className="booking-route-draw stroke-primary"
                  d={routePath}
                  fill="none"
                  pathLength="1"
                  strokeDasharray="1"
                  strokeDashoffset="1"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                {reduceMotion ? (
                  <circle cx="1000" cy="16" r="13" className="fill-primary stroke-background" strokeWidth="5" />
                ) : (
                  <circle r="13" className="fill-primary stroke-background" strokeWidth="5">
                    <animateMotion dur="2.8s" path={routePath} calcMode="spline" keyTimes="0;1" keySplines=".32 .72 0 1" fill="freeze" />
                  </circle>
                )}
              </>
            ) : null}
          </svg>

          <div className="relative grid gap-12 md:grid-cols-3 md:gap-8">
            {steps.map(({ icon: Icon, title, text }, index) => (
              <article key={title} className="group text-center">
                <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground ring-8 ring-background transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] group-hover:-translate-y-2 group-hover:scale-105">
                  <Icon className="h-8 w-8 stroke-[1.4] transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] group-hover:rotate-[-8deg]" aria-hidden="true" />
                  <span className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full border border-border bg-card text-[10px] font-extrabold text-card-foreground">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="font-display mt-7 text-2xl transition-colors duration-500 ease-[cubic-bezier(.32,.72,0,1)] group-hover:text-primary">
                  {title}
                </h3>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="group mt-20 grid overflow-hidden rounded-[2rem] bg-foreground/5 p-1 ring-1 ring-border transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-1 md:grid-cols-[1.1fr_.9fr]">
          <div className="overflow-hidden rounded-[1.7rem]">
            <img
              src={arrivalImage}
              alt="The Pickle Box arrival counter beside the courts"
              width={1672}
              height={941}
              loading="lazy"
              className="h-full min-h-[300px] w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(.32,.72,0,1)] group-hover:scale-[1.035]"
            />
          </div>
          <div className="flex flex-col justify-center rounded-[1.7rem] bg-card p-8 md:p-12">
            <p className="text-sm font-bold text-primary">Keep it simple</p>
            <p className="font-display mt-4 text-3xl leading-[1.05] md:text-4xl">
              The confirmation you need—then it’s time to play.
            </p>
            <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">
              Everything is clear before you arrive, from the court to the time to your payment confirmation.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
