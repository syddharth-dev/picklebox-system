import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { addDays, format, parseISO } from "date-fns";
import { afterEach, describe, expect, it } from "vitest";
import { venueDate } from "@/lib/openPlay";
import { HeroSection } from "./HeroSection";

afterEach(cleanup);
function Destination() {
  const location = useLocation();
  return <p>Booking date: {new URLSearchParams(location.search).get("date")}</p>;
}

describe("Homepage booking shortcut", () => {
  it("carries the chosen date into the court-booking route", () => {
    const date = format(addDays(parseISO(venueDate()), 3), "yyyy-MM-dd");
    render(<MemoryRouter><Routes><Route path="/" element={<HeroSection />} /><Route path="/courts" element={<Destination />} /></Routes></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("When do you want to play?"), { target: { value: date } });
    fireEvent.click(screen.getByRole("button", { name: "Find a court" }));
    expect(screen.getByText("Booking date: " + date)).toBeInTheDocument();
  });
  it("uses the original venue photograph and the supported booking window", () => {
    render(<MemoryRouter><HeroSection /></MemoryRouter>);
    const image = screen.getByRole("img", { name: /blue indoor courts/ });
    expect(image).toHaveAttribute("src", expect.stringContaining("courts.jpg"));
    expect(image).toHaveAttribute("srcset", expect.stringContaining("courts-720.jpg"));
    const input = screen.getByLabelText("When do you want to play?");
    expect(input).toHaveAttribute("min", venueDate());
    expect(input).toHaveAttribute("max", format(addDays(parseISO(venueDate()), 60), "yyyy-MM-dd"));
    expect(input).toHaveAccessibleDescription(/60 days ahead/i);
  });
});
