import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QRCodeDialog } from "./QRCodeDialog";

const state = vi.hoisted(() => ({ error: null as Error | null, fetching: false }));
vi.mock("@/hooks/useCheckIn", () => ({
  useMyQrToken: () => ({ data: "cached-token", isLoading: false, isFetching: state.fetching, error: state.error }),
  checkinErrorMessage: () => "This session has been cancelled.",
}));
beforeEach(() => { state.error = null; state.fetching = false; });
afterEach(cleanup);
const show = () => render(<QRCodeDialog open onOpenChange={() => {}} kind="open_play" id="reg" title="Friday Open Play" />);
describe("Open Play QR validity", () => {
  it("displays an authorized QR token", () => {
    show();
    expect(screen.getByText("cached-token")).toBeInTheDocument();
  });
  it("hides an old cached token after server authorization fails", () => {
    state.error = new Error("QR_NOT_AVAILABLE");
    show();
    expect(screen.getByRole("alert")).toHaveTextContent(/cancelled/);
    expect(screen.queryByText("cached-token")).not.toBeInTheDocument();
    expect(screen.queryByText(/Valid — not yet/)).not.toBeInTheDocument();
  });
  it("waits for renewed authorization before displaying a cached QR", () => {
    state.fetching = true;
    show();
    expect(screen.queryByText("cached-token")).not.toBeInTheDocument();
  });
});
