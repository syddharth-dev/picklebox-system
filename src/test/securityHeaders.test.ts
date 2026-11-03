// @vitest-environment node
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "next-themes";
import { describe, expect, it } from "vitest";

describe("Production security header template", () => {
  it.each(["public/_headers", "vercel.json"])("permits the legitimate theme bootstrap without arbitrary inline scripts in %s", (file) => {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    const config = file === "vercel.json" ? JSON.parse(source) : null;
    const headers = config ? config.headers[0].headers.map((h: { key: string; value: string }) => `${h.key}: ${h.value}`).join("\n") : source;
    const html = renderToStaticMarkup(createElement(ThemeProvider, {
      attribute: "class", defaultTheme: "light", enableSystem: false, enableColorScheme: true,
      disableTransitionOnChange: true, storageKey: "picklebox-theme:v1",
      children: null,
    }));
    const script = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeTruthy();
    expect(headers).toContain(`'sha256-${createHash("sha256").update(script!).digest("base64")}'`);
    expect(headers.match(/script-src[^;]+/)?.[0]).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain("object-src 'none'");
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    if (config) {
      expect(config.headers[0].source).toBe("/(.*)");
      expect(config.rewrites).toContainEqual({ source: "/(.*)", destination: "/index.html" });
    }
  });
});
