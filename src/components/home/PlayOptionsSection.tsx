import { ArrowRight, CalendarDays, QrCode, Users } from "lucide-react";
import { Link } from "react-router-dom";

const options = [
  {
    title: "Court bookings",
    icon: CalendarDays,
    description: "Get your group together. Choose an available court, pick your hours, and make time to play.",
    action: "Find a court",
    to: "/courts",
  },
  {
    title: "Open Play",
    icon: Users,
    description: "Coming on your own? Find a session, check the skill level and available spots, and join the game.",
    action: "Explore sessions",
    to: "/open-play",
  },
  {
    title: "Check-in passes",
    icon: QrCode,
    description: "Keep your reservation details in one place. Once payment is approved, your QR pass is ready for check-in.",
    action: "View my bookings",
    to: "/bookings",
  },
];

export function PlayOptionsSection() {
  return (
    <section aria-labelledby="play-options-title" className="site-container site-section">
      <div className="mx-auto max-w-3xl text-center">
        <h2 id="play-options-title" className="section-title">Choose how you want to play.</h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
          Reserve a court for your group, join a scheduled session on your own, or return to a confirmed booking.
        </p>
      </div>
      <div className="mt-10 grid gap-6 md:mt-14 md:grid-cols-3 lg:gap-8">
        {options.map(({ title, icon: Icon, description, action, to }) => (
          <article key={title} className="play-option">
            <div className="relative z-10 flex min-h-48 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-lime/20 text-primary">
                <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <h3 className="text-xl font-extrabold lg:text-2xl">{title}</h3>
            </div>
            <div className="relative mt-7 flex flex-1 flex-col items-center px-7 pb-7 pt-6 text-center text-brand-ink lg:px-9">
              <div className="play-option-sea" aria-hidden="true">
                <svg viewBox="0 0 480 32" preserveAspectRatio="none" className="absolute -top-[27px] h-7 w-full" focusable="false">
                  <path d="M0 14C80-8 130 3 220 15S370-2 480 12V32H0Z" className="fill-brand-ink" />
                  <path d="M0 22C90 4 150 30 240 22S390 6 480 20V32H0Z" className="fill-brand-lime" />
                </svg>
              </div>
              <p className="relative mb-5 max-w-sm text-sm leading-7 lg:text-base">{description}</p>
              <Link to={to} className="text-link relative mt-auto rounded-sm focus-visible:outline-brand-ink">
                {action} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
