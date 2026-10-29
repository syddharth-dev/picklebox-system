import { CalendarCheck2, CreditCard, TimerReset } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import ritualImage from "@/assets/brand/picklebox-court-ritual.png";

const features = [
  { icon: CreditCard, title: "GCash ready", text: "Confirm your slot without chasing cash or screenshots.", tone: "surface" },
  { icon: CalendarCheck2, title: "Your court, held", text: "Live availability makes the answer clear before the group chat gets busy.", tone: "lime" },
  { icon: TimerReset, title: "Play on your time", text: "Choose the hour that works, from quick sets to long evenings.", tone: "surface" },
];

export function FeaturesSection() {
  return (
    <section className="relative overflow-hidden bg-background px-6 py-28 text-foreground md:px-10 md:py-36 lg:px-16">
      <div className="mx-auto max-w-[1320px]">
        <Reveal>
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-bold tracking-wide text-muted-foreground">What you get</p>
            <h2 className="font-display mt-5 text-[2rem] leading-[.98] sm:text-5xl md:text-7xl">
              Everything you need
              <br />
              to <span className="text-primary">get on court.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground">
              Clear availability, easy payment, and a booking flow built around a proper night out.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-3 md:gap-6">
          {features.map(({ icon: Icon, title, text, tone }, index) => (
            <Reveal key={title} delay={index * 90} variant={index === 0 ? "left" : index === 2 ? "right" : "up"}>
              <article className="group rounded-[2rem] bg-foreground/5 p-1 ring-1 ring-border transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-2">
                <div
                  className={
                    tone === "lime"
                      ? "flex min-h-[310px] flex-col rounded-[1.7rem] bg-brand-lime p-7 text-brand-ink transition-[background-color,transform] duration-700 ease-[cubic-bezier(.32,.72,0,1)] md:min-h-[350px]"
                      : "flex min-h-[310px] flex-col rounded-[1.7rem] bg-card p-7 text-card-foreground transition-[background-color,transform] duration-700 ease-[cubic-bezier(.32,.72,0,1)] group-hover:bg-muted md:min-h-[350px]"
                  }
                >
                  <span
                    className={
                      tone === "lime"
                        ? "grid h-12 w-12 place-items-center rounded-2xl bg-brand-chalk transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] group-hover:rotate-[-8deg] group-hover:scale-110"
                        : "grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] group-hover:rotate-[-8deg] group-hover:scale-110"
                    }
                  >
                    <Icon className="h-6 w-6 stroke-[1.4]" aria-hidden="true" />
                  </span>
                  <h3 className="font-display mt-auto text-2xl">{title}</h3>
                  <div className={tone === "lime" ? "mt-5 border-t border-brand-ink/20 pt-5" : "mt-5 border-t border-border pt-5"}>
                    <p className="text-sm leading-6 opacity-80">{text}</p>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={180} variant="scale">
          <div className="group relative mt-10 overflow-hidden rounded-[2rem] bg-foreground/5 p-1 ring-1 ring-border transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-1">
            <div className="grid items-stretch overflow-hidden rounded-[1.7rem] bg-card md:grid-cols-[.95fr_1.05fr]">
              <div className="overflow-hidden">
                <img
                  src={ritualImage}
                  alt="Paddles and a pickleball waiting at court side"
                  width={1672}
                  height={941}
                  loading="lazy"
                  className="h-full min-h-[280px] w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(.32,.72,0,1)] group-hover:scale-[1.04]"
                />
              </div>
              <div className="flex flex-col justify-between p-8 md:p-11">
                <p className="max-w-sm text-lg leading-8 text-muted-foreground">
                  No complicated membership, no waiting for a callback. Just find your time and make the plan.
                </p>
                <p className="font-display mt-12 max-w-md text-3xl leading-[1.05] text-foreground md:text-4xl">
                  Pick the court.
                  <br />
                  <span className="text-primary">We’ll save the spot.</span>
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
