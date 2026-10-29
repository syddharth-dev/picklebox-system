import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

const setTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme }),
}));

describe("ThemeToggle", () => {
  beforeEach(() => setTheme.mockClear());

  it("announces and activates the opposite theme", async () => {
    render(<ThemeToggle />);

    const toggle = await screen.findByRole("button", { name: "Switch to light mode" });
    await waitFor(() => expect(toggle).toBeEnabled());

    fireEvent.click(toggle);

    expect(setTheme).toHaveBeenCalledWith("light");
  });
});
