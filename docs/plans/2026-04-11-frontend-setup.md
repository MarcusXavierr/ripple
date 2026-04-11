# Frontend Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bootstrap the Ripple frontend with Vite + React + TypeScript, Biome, Vitest + RTL, Tailwind, shadcn/ui, Zustand, and React Router — with a green TDD baseline from day one.

**Architecture:** The `ripple/` repo root IS the frontend. No subdirectories. Vite scaffolds directly into the existing git repo. Tests live colocated with source files.

**Tech Stack:** Bun · Vite · React 19 · TypeScript · Biome · Vitest · React Testing Library · Tailwind CSS v4 · shadcn/ui · Zustand · React Router v7

---

## Task 1: Scaffold Vite into existing repo

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.css`, `src/index.css`, `public/vite.svg`

**Step 1: Run the Vite scaffolder**

```bash
bun create vite . --template react-ts
```

If prompted about existing files, confirm to continue.

**Step 2: Install dependencies**

```bash
bun install
```

**Step 3: Verify the scaffold works**

```bash
bun run dev
```

Expected: Vite dev server starts at `http://localhost:5173`. Open it — the default Vite + React page should render. Kill the server (`Ctrl+C`).

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite react-ts"
```

---

## Task 2: Configure Biome

**Files:**
- Create: `biome.json`
- Modify: `package.json` (add scripts)

**Step 1: Install Biome**

```bash
bun add -d @biomejs/biome
```

**Step 2: Initialize Biome config**

```bash
bunx biome init
```

This creates `biome.json`. Replace its content with:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "useExhaustiveDependencies": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "trailingCommas": "es5",
      "semicolons": "always"
    }
  },
  "files": {
    "ignore": ["node_modules", "dist", "src/components/ui"]
  }
}
```

> Note: `src/components/ui` is ignored because shadcn/ui generates its own code and we don't want Biome fighting it.

**Step 3: Add scripts to `package.json`**

In the `"scripts"` section, add:

```json
"lint": "biome lint .",
"format": "biome format --write .",
"check": "biome check --write ."
```

**Step 4: Run Biome on the scaffold**

```bash
bun run check
```

Expected: Biome formats and lints all files. May auto-fix some things. No errors should remain.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: add biome for linting and formatting"
```

---

## Task 3: Configure Vitest + React Testing Library

**Files:**
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json`
- Modify: `package.json` (add scripts)
- Create: `vitest.setup.ts`

**Step 1: Install test dependencies**

```bash
bun add -d vitest @vitest/ui jsdom
bun add -d @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

**Step 2: Update `vite.config.ts`**

Replace the entire file with:

```typescript
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
});
```

**Step 3: Create `vitest.setup.ts`**

```typescript
import "@testing-library/jest-dom";
```

**Step 4: Update `tsconfig.app.json`**

Add `"vitest/globals"` to the `compilerOptions.types` array. If the array doesn't exist, add it:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

Keep all other existing fields — just add/merge this one.

**Step 5: Add test scripts to `package.json`**

```json
"test": "vitest",
"test:run": "vitest run",
"test:ui": "vitest --ui"
```

**Step 6: Write a sanity test to verify the setup**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

it("renders without crashing", () => {
  render(<App />);
  expect(document.body).toBeInTheDocument();
});
```

**Step 7: Run the test — expect it to pass**

```bash
bun run test:run
```

Expected output:
```
✓ src/App.test.tsx > renders without crashing
Test Files  1 passed (1)
Tests       1 passed (1)
```

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: add vitest and react testing library"
```

---

## Task 4: Install runtime dependencies

**Files:**
- Modify: `package.json` (bun updates this automatically)

**Step 1: Install**

```bash
bun add react-router-dom zustand
```

**Step 2: Verify types are included**

React Router and Zustand both ship their own types — no `@types/*` needed. Confirm by checking `node_modules/react-router-dom/package.json` has a `"types"` field:

```bash
cat node_modules/react-router-dom/package.json | grep '"types"'
```

Expected: a line with `"types": "..."`.

**Step 3: Commit**

```bash
git add bun.lock package.json
git commit -m "chore: add react-router-dom and zustand"
```

---

## Task 5: Configure Tailwind CSS v4

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/index.css`

**Step 1: Install Tailwind**

```bash
bun add -d tailwindcss @tailwindcss/vite
```

**Step 2: Add the Tailwind plugin to `vite.config.ts`**

```typescript
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
});
```

**Step 3: Replace `src/index.css` entirely**

```css
@import "tailwindcss";
```

That's it. Tailwind v4 needs no config file.

**Step 4: Verify Tailwind works**

Temporarily add a Tailwind class to `src/App.tsx` — e.g. `className="text-red-500"` on any element. Run:

```bash
bun run dev
```

Open `http://localhost:5173`. The text should be red. Remove the temporary class. Kill the server.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: add tailwind css v4"
```

---

## Task 6: Build the folder structure

**Files:**
- Delete: `src/App.tsx`, `src/App.css` (Vite boilerplate, replaced by pages + router)
- Delete: `src/App.test.tsx` (temporary sanity test, now replaced by real tests)
- Modify: `src/main.tsx`
- Create: `src/router.tsx`
- Create: `src/types/signaling.ts`
- Create: `src/store/call.ts` (skeleton)
- Create: `src/hooks/useWebRTC.ts` (skeleton)
- Create: `src/pages/Home.tsx` (skeleton)
- Create: `src/pages/Room.tsx` (skeleton)

**Step 1: Delete boilerplate**

```bash
rm src/App.tsx src/App.css src/App.test.tsx
```

**Step 2: Create `src/types/signaling.ts`**

```typescript
// SYNC: keep identical to backend types.ts

// Server → Client
export type ServerMessage =
  | { type: "onopen"; role: "caller" | "callee"; reconnect: boolean }
  | { type: "enter" }
  | { type: "onclose"; message: string }
  | { type: "peer-reconnected" }
  | { type: "ping" };

// Client → Server (blind relay to other peers)
export type ClientMessage =
  | { type: "offer"; offer: RTCSessionDescriptionInit }
  | { type: "answer"; answer: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit }
  | { type: "pong" };

export type MediaErrorMessage = { type: "error"; code: "ICE_FAILED" | "MEDIA_DENIED" };

export const CLOSE_CODES = {
  ROOM_FULL: 4001,
  PEER_DISCONNECTED: 4002,
  ROOM_NOT_FOUND: 4003,
  DUPLICATE_SESSION: 4004,
  PING_TIMEOUT: 4005,
} as const;
```

**Step 3: Create `src/store/call.ts` (skeleton — will be filled in Task 7)**

```typescript
import { create } from "zustand";

export type CallStatus =
  | "idle"
  | "connecting"
  | "waiting"
  | "negotiating"
  | "connected"
  | "reconnecting"
  | "disconnected";

type CallStore = {
  peerId: string;
  ws: WebSocket | null;
  pc: RTCPeerConnection | null;
  role: "caller" | "callee" | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isScreenSharing: boolean;
  status: CallStatus;
  error: string | null;
};

export const useCallStore = create<CallStore>()(() => ({
  peerId: "",
  ws: null,
  pc: null,
  role: null,
  localStream: null,
  remoteStream: null,
  isScreenSharing: false,
  status: "idle",
  error: null,
}));
```

**Step 4: Create `src/hooks/useWebRTC.ts` (skeleton)**

```typescript
// Implementation in a later task
export function useWebRTC(_roomId: string) {
  return {
    localStream: null as MediaStream | null,
    remoteStream: null as MediaStream | null,
    status: "idle" as const,
    error: null as string | null,
    startScreenShare: async () => {},
    stopScreenShare: async () => {},
    hangup: () => {},
  };
}
```

**Step 5: Create `src/pages/Home.tsx` (skeleton)**

```tsx
export default function Home() {
  return <div data-testid="home-page">Home</div>;
}
```

**Step 6: Create `src/pages/Room.tsx` (skeleton)**

```tsx
export default function Room() {
  return <div data-testid="room-page">Room</div>;
}
```

**Step 7: Create `src/router.tsx`**

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Room from "./pages/Room";

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:id" element={<Room />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 8: Update `src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Router from "./router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router />
  </StrictMode>
);
```

**Step 9: Verify the app still runs**

```bash
bun run dev
```

Open `http://localhost:5173`. Should show "Home". Navigate to `http://localhost:5173/room/test` — should show "Room". Kill the server.

**Step 10: Commit**

```bash
git add -A
git commit -m "chore: set up folder structure and skeleton files"
```

---

## Task 7: TDD — Zustand store initial state

**Files:**
- Modify: `src/store/call.ts`
- Create: `src/store/call.test.ts`

**Step 1: Write the failing test**

Create `src/store/call.test.ts`:

```typescript
import { useCallStore } from "./call";

describe("useCallStore", () => {
  it("initializes with idle status", () => {
    const state = useCallStore.getState();
    expect(state.status).toBe("idle");
  });

  it("initializes with null connection values", () => {
    const state = useCallStore.getState();
    expect(state.ws).toBeNull();
    expect(state.pc).toBeNull();
    expect(state.role).toBeNull();
  });

  it("initializes with null media values", () => {
    const state = useCallStore.getState();
    expect(state.localStream).toBeNull();
    expect(state.remoteStream).toBeNull();
    expect(state.isScreenSharing).toBe(false);
  });

  it("initializes with no error", () => {
    const state = useCallStore.getState();
    expect(state.error).toBeNull();
  });

  it("initializes with empty peerId", () => {
    const state = useCallStore.getState();
    expect(typeof state.peerId).toBe("string");
  });
});
```

**Step 2: Run the tests — expect them to pass**

The store skeleton already has the correct default values, so these tests should pass immediately. This is intentional: we're verifying the contract of the initial state.

```bash
bunx vitest run src/store/call.test.ts
```

Expected:
```
✓ src/store/call.test.ts (5)
  ✓ useCallStore > initializes with idle status
  ✓ useCallStore > initializes with null connection values
  ✓ useCallStore > initializes with null media values
  ✓ useCallStore > initializes with no error
  ✓ useCallStore > initializes with empty peerId
Test Files  1 passed (1)
Tests  5 passed (5)
```

If any fail, fix the default values in `src/store/call.ts` to match.

**Step 3: Commit**

```bash
git add src/store/call.ts src/store/call.test.ts
git commit -m "test: add zustand store initial state tests"
```

---

## Task 8: TDD — Page smoke tests

**Files:**
- Create: `src/pages/Home.test.tsx`
- Create: `src/pages/Room.test.tsx`

**Step 1: Write the failing tests**

Create `src/pages/Home.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";

it("renders without crashing", () => {
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );
  expect(screen.getByTestId("home-page")).toBeInTheDocument();
});
```

Create `src/pages/Room.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Room from "./Room";

it("renders without crashing", () => {
  render(
    <MemoryRouter initialEntries={["/room/coral-tiger-42"]}>
      <Routes>
        <Route path="/room/:id" element={<Room />} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByTestId("room-page")).toBeInTheDocument();
});
```

**Step 2: Run tests — expect them to pass**

```bash
bunx vitest run src/pages/Home.test.tsx src/pages/Room.test.tsx
```

Expected:
```
✓ src/pages/Home.test.tsx > renders without crashing
✓ src/pages/Room.test.tsx > renders without crashing
Test Files  2 passed (2)
Tests  2 passed (2)
```

If any fail, the `data-testid` on the page skeleton (Task 6, Steps 5–6) might not match. Fix to match.

**Step 3: Run the full test suite**

```bash
bun run test:run
```

Expected: all tests pass, no failures.

**Step 4: Commit**

```bash
git add src/pages/Home.test.tsx src/pages/Room.test.tsx
git commit -m "test: add page smoke tests"
```

---

## Task 9: Initialize shadcn/ui

**Files:**
- Create: `components.json`
- Create: `src/lib/utils.ts`
- Create: `src/components/ui/` (generated, do not edit manually)
- Modify: `src/index.css` (shadcn adds CSS variables)

**Step 1: Run the shadcn initializer**

```bash
bunx shadcn@latest init
```

Answer the prompts:
- Style: **New York**
- Base color: **Zinc**
- CSS variables: **Yes**

**Step 2: Verify the setup**

Check that `components.json` was created and `src/lib/utils.ts` exists.

```bash
cat components.json
```

Expected: a JSON file with `style: "new-york"` and paths pointing to `src/components/ui`.

**Step 3: Run the full test suite — must still be green**

```bash
bun run test:run
```

Expected: all tests pass. If shadcn modified anything that breaks tests, investigate before continuing.

**Step 4: Run Biome check**

```bash
bun run check
```

Expected: no errors. Biome ignores `src/components/ui` per the config in Task 2.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: initialize shadcn/ui (new-york, zinc)"
```

---

## Task 10: Final cleanup and verification

**Step 1: Remove leftover Vite boilerplate**

Check for and delete if present:
- `public/vite.svg`
- `src/assets/react.svg`

```bash
rm -f public/vite.svg src/assets/react.svg
```

**Step 2: Run full check**

```bash
bun run check
```

Expected: clean output, no lint or format errors.

**Step 3: Run full test suite**

```bash
bun run test:run
```

Expected: all tests pass.

**Step 4: Verify the app runs**

```bash
bun run dev
```

Open `http://localhost:5173`. Should show "Home". Kill the server.

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup, setup complete"
```

---

## Done

The setup is complete. The project has:
- Vite + React + TypeScript scaffolded into the repo root
- Biome configured for linting and formatting
- Vitest + React Testing Library with a green baseline
- Tailwind CSS v4 via the Vite plugin
- shadcn/ui initialized (components added on demand per feature)
- Zustand + React Router installed
- Skeleton files for all source modules
- TDD baseline: store tests + page smoke tests all green
