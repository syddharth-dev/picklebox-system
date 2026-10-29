import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme !== "light";
  const label = mounted
    ? `Switch to ${isDark ? "light" : "dark"} mode`
    : "Change color theme";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "h-10 w-10 rounded-full text-foreground transition-[background-color,color,transform] duration-500 ease-[cubic-bezier(.32,.72,0,1)] hover:bg-accent hover:text-accent-foreground active:scale-[.96]",
        className,
      )}
    >
      {mounted && isDark ? (
        <Sun className="h-[18px] w-[18px] stroke-[1.5]" aria-hidden="true" />
      ) : (
        <Moon className="h-[18px] w-[18px] stroke-[1.5]" aria-hidden="true" />
      )}
    </Button>
  );
}
