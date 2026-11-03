import { ArrowRight, CalendarSearch, QrCode, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useInView } from "@/hooks/useInView";

const steps = [
  { title: "Find your time", icon: CalendarSearch, text: "Choose a date, then select an available court and the hours you want." },
  { title: "Send your payment", icon: Smartphone, text: "Pay with GCash and submit your reference. Staff will verify your payment." },
  { title: "See you on court", icon: QrCode, text: "After approval, open your check-in QR from My bookings and show it when you arrive." },
];

export function BookingFlowSection() {
  const { ref, isInView, canAnimate } = useInView<HTMLDivElement>(0.25);
  const [path, setPath] = useState("");

  useEffect(() => {
    const track = ref.current;
    if (!track) return;
    const measure = () => {
      const bounds = track.getBoundingClientRect();
      const points = Array.from(track.querySelectorAll("[data-step-marker]")).map((marker) => {
        const rect = marker.getBoundingClientRect();
        return { x: rect.left - bounds.left + rect.width / 2, y: rect.top - bounds.top + rect.height / 2 };
      });
      if (points.length !== 3 || bounds.width === 0) return;
      const [first, second, third] = points;
      const start = `M${first.x} ${first.y}`;
      if (Math.abs(third.x - first.x) < 1) {
        setPath(`${start} L${second.x} ${second.y} L${third.x} ${third.y}`);
      } else {
        const curveTo = (from: typeof first, to: typeof first) => {
          const dx = (to.x - from.x) / 3;
          return `C${from.x + dx} ${from.y - 24} ${to.x - dx} ${to.y + 24} ${to.x} ${to.y}`;
        };
        setPath(`${start} ${curveTo(first, second)} ${curveTo(second, third)}`);
      }
    };
    measure();
    if (typeof ResizeObserver !== "function") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [ref]);

  return (
    <section aria-labelledby="booking-flow-title" className="site-container site-section">
      <div className="mx-auto max-w-3xl text-center">
        <h2 id="booking-flow-title" className="section-title">Book your court<br />in 3 simple steps.</h2>
        <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-muted-foreground md:text-lg">From finding a time to your first serve. Here is how to get on court.</p>
      </div>
      <div ref={ref} className="booking-track relative mt-12 md:mt-16" data-playing={isInView && canAnimate}>
        <svg className="pointer-events-none absolute inset-0 h-full w-full text-border" aria-hidden="true" focusable="false">
          <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 7" />
        </svg>
        <ol className="booking-steps relative grid gap-9 md:grid-cols-3 md:gap-8">
          {steps.map(({ title, icon: Icon, text }, index) => (
            <li key={title} className="relative grid grid-cols-[80px_1fr] items-start gap-x-5 md:flex md:flex-col md:items-center md:text-center">
              <div data-step-marker className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-brand-lime text-brand-ink ring-8 ring-background md:h-24 md:w-24">
                <Icon className="h-8 w-8 md:h-9 md:w-9" strokeWidth={1.75} aria-hidden="true" />
                <span className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-xs font-extrabold text-foreground">0{index + 1}</span>
              </div>
              <div className="pb-2 pt-1 md:mt-7 md:p-0">
                <h3 className="mb-3 text-lg font-extrabold lg:text-xl">{title}</h3>
                <p className="mx-auto max-w-sm text-sm leading-7 text-muted-foreground lg:text-base">{text}</p>
              </div>
            </li>
          ))}
        </ol>
        {path && (
          <span key={path} className="booking-ball" style={{ offsetPath: `path("${path}")` }} aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-full w-full" focusable="false">
              <circle cx="12" cy="12" r="10.5" fill="#B7E34B" stroke="#142B3B" strokeWidth="1.5" />
              <g fill="#142B3B">
                <ellipse cx="7" cy="7.5" rx="1.3" ry="1.7" transform="rotate(35 7 7.5)" />
                <ellipse cx="17" cy="7.5" rx="1.3" ry="1.7" transform="rotate(-35 17 7.5)" />
                <circle cx="12" cy="12" r="1.6" />
                <ellipse cx="7.5" cy="17" rx="1.7" ry="1.3" transform="rotate(35 7.5 17)" />
                <ellipse cx="16.5" cy="17" rx="1.7" ry="1.3" transform="rotate(-35 16.5 17)" />
              </g>
            </svg>
          </span>
        )}
      </div>
      <div className="mt-10 text-center md:mt-12">
        <Link to="/courts" className="action-link inline-flex min-h-12 items-center justify-center gap-4 rounded-xl bg-primary px-7 text-sm font-bold text-primary-foreground hover:bg-primary/90">Start a booking <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
