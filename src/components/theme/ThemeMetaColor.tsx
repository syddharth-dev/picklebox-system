import { useEffect } from "react";
import { useTheme } from "next-themes";

const THEME_COLORS = {
  dark: "#142B3B",
  light: "#F8FAFC",
} as const;

export function ThemeMetaColor() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const color = resolvedTheme === "light" ? THEME_COLORS.light : THEME_COLORS.dark;

    meta?.setAttribute("content", color);
  }, [resolvedTheme]);

  return null;
}
