import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import rallyImage from "@/assets/venue/rally.jpg";
import { Reveal } from "@/components/motion/Reveal";

export function OpenPlayHighlight() {
  return (
    <section className="bg-brand-ink text-white">
      <div className="site-container site-section grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-20">
        <Reveal variant="scale" threshold={0.12} className="photo-frame photo-interaction bg-white/10">
          <img src={rallyImage} alt="The Pickle Box community enjoying a game together" width={1302} height={868}
            loading="lazy" className="aspect-[4/3] h-full w-full object-cover" />
        </Reveal>
        <div>
          <h2 className="section-title max-w-lg">Come for a game.<br />Find your people.</h2>
          <p className="mt-6 max-w-md text-base leading-7 text-white/75">
            No full group? No problem. Choose a session for your level, register your spot,
            and meet the people on the other side of the net.
          </p>
          <Link to="/open-play" className="action-link mt-8 inline-flex min-h-12 items-center gap-8 rounded-lg bg-brand-lime px-6 text-sm font-bold text-brand-ink hover:bg-brand-lime/90 focus-visible:outline-brand-lime">
            Explore Open Play <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="mt-4 max-w-md text-xs leading-5 text-white/65">Browse session fees, skill levels, and available spots without an account. Sign in only when you are ready to register.</p>
        </div>
      </div>
    </section>
  );
}
