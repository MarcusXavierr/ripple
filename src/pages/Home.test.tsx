import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

// Mock useNavigate — the hook reads from router context so we intercept here
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock slug generator so tests are deterministic
vi.mock("@/lib/room", () => ({
  generateRoomSlug: vi.fn(() => "coral-tiger-42"),
  parseRoomInput: vi.fn(),
}));

import Home from "./Home";
import { parseRoomInput } from "@/lib/room";

function renderHome() {
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );
}

describe("Home page", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.mocked(parseRoomInput).mockReset();
  });

  it("renders a Create Room button", () => {
    renderHome();
    expect(screen.getByRole("button", { name: /create room/i })).toBeInTheDocument();
  });

  it("renders a join input and Join button", () => {
    renderHome();
    expect(screen.getByLabelText(/room id or link/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /join/i })).toBeInTheDocument();
  });

  it("navigates to /room/<slug> when Create Room is clicked", async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole("button", { name: /create room/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/room/coral-tiger-42");
  });

  it("navigates to the room when a valid ID is submitted", async () => {
    vi.mocked(parseRoomInput).mockReturnValueOnce("amber-wolf-7");
    const user = userEvent.setup();
    renderHome();
    await user.type(screen.getByLabelText(/room id or link/i), "amber-wolf-7");
    await user.click(screen.getByRole("button", { name: /join/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/room/amber-wolf-7");
  });

  it("navigates when a full URL is submitted", async () => {
    vi.mocked(parseRoomInput).mockReturnValueOnce("jade-hawk-3");
    const user = userEvent.setup();
    renderHome();
    await user.type(
      screen.getByLabelText(/room id or link/i),
      "http://localhost:5173/room/jade-hawk-3"
    );
    await user.click(screen.getByRole("button", { name: /join/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/room/jade-hawk-3");
  });

  it("shows an error message when submitted with an empty input", async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole("button", { name: /join/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/enter a valid room id or link/i);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("clears the error when the user starts typing after a failed submit", async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole("button", { name: /join/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/room id or link/i), "a");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
