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
