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
        "h-11 w-11 rounded-lg text-foreground transition-colors duration-200 hover:bg-accent hover:text-accent-foreground",
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
