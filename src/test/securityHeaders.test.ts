// @vitest-environment node
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "next-themes";
import { describe, expect, it } from "vitest";

describe("Production security header template", () => {
  it("permits the legitimate theme bootstrap without allowing arbitrary inline scripts", () => {
    const headers = readFileSync(new URL("../../public/_headers", import.meta.url), "utf8");
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
  });
});
