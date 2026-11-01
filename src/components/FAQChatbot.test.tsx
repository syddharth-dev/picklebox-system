import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAQChatbot } from "./FAQChatbot";
const state = vi.hoisted(() => ({ user: { id: "player-a" } as { id: string } | null, invoke: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: state.invoke } } }));
function Chat() { return <MemoryRouter><FAQChatbot /></MemoryRouter>; }
beforeEach(() => { state.user = { id: "player-a" }; state.invoke.mockReset(); HTMLElement.prototype.scrollTo = vi.fn(); });
afterEach(cleanup);
describe("PickleBot account isolation", () => {
  it("keeps a long assistant reply from breaking the next request's message limits", async () => {
    state.invoke.mockResolvedValue({ data: { reply: "x".repeat(2200) }, error: null });
    render(<Chat />); fireEvent.click(screen.getByRole("button", { name: "Open chat" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Ask PickleBot" }), { target: { value: "How do I book?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Ask PickleBot" })).toBeEnabled());
    fireEvent.change(screen.getByRole("textbox", { name: "Ask PickleBot" }), { target: { value: "And payment?" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send" })); });
    expect(state.invoke.mock.calls[1][1].body.messages.find((message: { role: string }) => message.role === "assistant").content).toHaveLength(2000);
  });
  it("clears private messages and ignores an old account's delayed response", async () => {
    let resolve!: (value: unknown) => void;
    state.invoke.mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = render(<Chat />);
    fireEvent.click(screen.getByRole("button", { name: "Open chat" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Ask PickleBot" }), { target: { value: "My private booking question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    state.user = { id: "player-b" };
    view.rerender(<Chat />);
    expect(screen.queryByText("My private booking question")).not.toBeInTheDocument();
    await act(async () => resolve({ data: { reply: "Private reply for player A" }, error: null }));
    expect(screen.queryByText("Private reply for player A")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Ask PickleBot" })).toBeEnabled();
  });
  it("keeps anonymous chat disabled and offers help", () => {
    state.user = null;
    render(<Chat />);
    fireEvent.click(screen.getByRole("button", { name: "Open chat" }));
    expect(screen.getByRole("textbox", { name: "Ask PickleBot" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "browse common questions" })).toHaveAttribute("href", "/help");
  });
});
