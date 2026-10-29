import { cn } from "@/lib/utils";

export function AppLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="430 550 1200 900"
      role="img"
      aria-label="The Pickle Box"
      className={cn("h-14 w-24 shrink-0 rounded-lg bg-white", className)}
    >
      {/* Trim the surrounding whitespace without altering the supplied image. */}
      <image href="/picklebox-logo.jpg" width="2000" height="2000" />
    </svg>
  );
}
