import { describe, expect, it } from "vitest";
import { escapeCsv } from "./attendanceExport";

describe("CSV export security", () => {
  it.each(["=HYPERLINK(\"https://attacker.invalid\")", "+SUM(1,2)", "-1+1", "@SUM(1,2)", "  =1+1", "\t=1+1", "\r=1+1", "+639123456789"])("neutralizes spreadsheet instructions: %j", (value) => {
    const cell = escapeCsv(value);
    expect(cell.replace(/^"/, "")).toMatch(/^'/);
  });
  it("retains ordinary text and escapes separators, quotes and line endings", () => {
    expect(escapeCsv("Player One")).toBe("Player One");
    expect(escapeCsv('Player, "One"')).toBe('"Player, ""One"""');
    expect(escapeCsv("Court\r1")).toBe('"Court\r1"');
  });
});
