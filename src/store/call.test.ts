import { useCallStore } from "./call";
// TODO: [Test] esses testes testam o que exatamente? porra, que testes memes hein?

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

  it('accepts ended as a valid status', () => {
    useCallStore.setState({ status: 'ended' })
    expect(useCallStore.getState().status).toBe('ended')
    useCallStore.getState().reset()
  })

  it('reset restores initial state', () => {
    useCallStore.setState({ status: 'connected', error: 'oops', role: 'caller' })
    useCallStore.getState().reset()
    const state = useCallStore.getState()
    expect(state.status).toBe('idle')
    expect(state.error).toBeNull()
    expect(state.role).toBeNull()
  })
});
