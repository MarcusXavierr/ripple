import { describe, expect, it } from "vitest";
import { MESSAGE_TYPES } from "./signaling";

describe("MESSAGE_TYPES", () => {
  it("has all server message type constants", () => {
    expect(MESSAGE_TYPES.ONOPEN).toBe("onopen");
    expect(MESSAGE_TYPES.ENTER).toBe("enter");
    expect(MESSAGE_TYPES.ONCLOSE).toBe("onclose");
    expect(MESSAGE_TYPES.PEER_RECONNECTED).toBe("peer-reconnected");
    expect(MESSAGE_TYPES.PING).toBe("ping");
  });

  it("has all client/relay message type constants", () => {
    expect(MESSAGE_TYPES.OFFER).toBe("offer");
    expect(MESSAGE_TYPES.ANSWER).toBe("answer");
    expect(MESSAGE_TYPES.ICE_CANDIDATE).toBe("ice-candidate");
    expect(MESSAGE_TYPES.PONG).toBe("pong");
  });
});
