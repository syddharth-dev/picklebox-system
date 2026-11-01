import { useState } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { venueDate } from "@/lib/openPlay";
import venueImage from "@/assets/venue/courts.jpg";
import { addDays, format, parseISO } from "date-fns";

export function HeroSection() {
  const [date, setDate] = useState(venueDate);
  const navigate = useNavigate();
  return (
    <section className="site-container hero-sequence pb-10 pt-32 md:pt-36">
      <div className="hero-location mb-5 flex items-center gap-2 text-xs font-semibold text-muted-foreground sm:text-sm">
        <MapPin className="h-4 w-4" aria-hidden="true" />
        San Carlos City, Negros Occidental
      </div>
      <div className="mb-8 grid items-end gap-6 md:grid-cols-[1.85fr_1fr] md:gap-12">
        <h1 className="hero-headline font-display text-[clamp(3.3rem,10vw,9.5rem)] uppercase leading-[.83]">
          <span className="whitespace-nowrap">Play. Connect.</span><br />Belong.
        </h1>
        <p className="hero-intro max-w-sm text-base leading-7 text-muted-foreground md:pb-1 md:text-lg">
          Your people. Your place to play. Book a court with friends, or find your next game at Open Play.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-[1.65fr_1fr] lg:grid-cols-[2.15fr_1fr]">
        <div className="hero-courts photo-frame photo-interaction relative min-h-[280px] md:min-h-[420px]">
          <img src={venueImage} alt="The Pickle Box's blue indoor courts in San Carlos City" width={1302} height={868}
            loading="eager" className="absolute inset-0 h-full w-full object-cover object-center" />
        </div>
        <form className="hero-booking flex flex-col justify-center rounded-xl bg-brand-lime p-7 text-brand-ink lg:p-9"
          onSubmit={(event) => { event.preventDefault(); navigate("/courts?date=" + date); }}>
          <h2 className="font-display max-w-xs text-5xl leading-[.95] lg:text-[3.6rem]">Make time<br />for a game.</h2>
          <label htmlFor="home-booking-date" className="mb-2 mt-7 text-sm font-semibold">When do you want to play?</label>
          <input id="home-booking-date" type="date" required min={venueDate()} max={format(addDays(parseISO(venueDate()), 60), "yyyy-MM-dd")} value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-12 w-full rounded-lg border-0 bg-white px-4 text-base text-brand-ink [color-scheme:light] focus-visible:outline-brand-ink" />
          <button type="submit" className="action-link mt-3 flex h-12 items-center justify-between rounded-lg bg-brand-ink px-5 text-sm font-bold text-white hover:bg-brand-ink/90 focus-visible:outline-brand-ink">
            Find a court <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <Link to="/open-play" className="mx-auto mt-3 min-h-11 content-center text-sm font-semibold underline underline-offset-4">
            Looking for Open Play?
          </Link>
        </form>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">A home court for every kind of player.</p>
    </section>
  );
}
