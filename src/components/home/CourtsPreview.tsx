import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import communityImage from "@/assets/venue/community.jpg";
import rallyImage from "@/assets/venue/rally.jpg";
import { Reveal } from "@/components/motion/Reveal";

export function CourtsPreview() {
  return (
    <section id="venue" className="site-container site-section border-t border-border">
      <Reveal threshold={0.12} className="grid gap-9 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="flex flex-col items-start justify-center">
          <h2 className="section-title max-w-xl">Good games.<br />Great company.</h2>
          <p className="section-copy mt-7">
            A familiar face across the net. A rally that goes one shot longer.
            That is what brings us back. The Pickle Box is a place to play and feel part of the game.
          </p>
          <Link to="/courts" className="text-link mt-5">Find your court <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        <figure className="photo-frame photo-interaction">
          <img src={communityImage} alt="Players greeting each other across the net at The Pickle Box" width={1302} height={868}
            loading="lazy" className="aspect-[3/2] h-full w-full object-cover" />
        </figure>
      </Reveal>
      <div className="mt-12 grid gap-8 border-t border-border pt-8 md:grid-cols-[.8fr_1.2fr] md:items-center md:gap-16">
        <img src={rallyImage} alt="Friends sharing a moment after their pickleball game" width={1302} height={868}
          loading="lazy" className="aspect-[3/2] w-full rounded-xl object-cover" />
        <div>
          <h3 className="font-display text-4xl leading-none md:text-5xl">Your court. Your kind of game.</h3>
          <dl className="mt-6 divide-y divide-border text-sm">
            <div className="flex justify-between gap-5 py-4"><dt className="font-semibold">The setting</dt><dd className="text-right text-muted-foreground">Covered indoor courts</dd></div>
            <div className="flex justify-between gap-5 py-4"><dt className="font-semibold">Your reservation</dt><dd className="text-right text-muted-foreground">Choose your court and hours</dd></div>
            <div className="flex justify-between gap-5 py-4"><dt className="font-semibold">The neighborhood</dt><dd className="text-right text-muted-foreground">San Carlos City, Negros Occidental</dd></div>
          </dl>
          <a href="https://www.google.com/maps/search/?api=1&query=The+Pickle+Box+Endrina+Street+San+Carlos+City+Negros+Occidental"
            target="_blank" rel="noreferrer" className="text-link mt-3">
            Get directions <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
