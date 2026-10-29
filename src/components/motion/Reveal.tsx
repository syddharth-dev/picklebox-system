import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/useInView";

type RevealVariant = "up" | "left" | "right" | "scale";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: RevealVariant;
  threshold?: number;
}

export function Reveal({ children, className, delay = 0, variant = "up", threshold = 0.2 }: RevealProps) {
  const { ref, isInView } = useInView<HTMLDivElement>(threshold);

  return <div ref={ref} className={cn("motion-reveal", `motion-reveal--${variant}`, isInView && "motion-reveal--visible", className)} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>{children}</div>;
}
