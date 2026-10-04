import { describe, it, expect } from "vitest";
import type { SessionEvent } from "@kuiz/core";
import { authorizeClientEvent } from "./authorize.js";

describe("authorizeClientEvent (trust boundary)", () => {
  const player = { playerId: "p1", isHost: false, now: 1000 };
  const host = { playerId: "h1", isHost: true, now: 1000 };

  it("rejects everything from a socket with no identity", () => {
    expect(
      authorizeClientEvent({ type: "PLAYER_INPUT", playerId: "p1", input: "x" }, { isHost: false, now: 0 }),
    ).toBeNull();
  });

  it("forces PLAYER_INPUT identity and clock, discarding the client's values", () => {
    const spoofed: SessionEvent = {
      type: "PLAYER_INPUT",
      playerId: "someone-else",
      input: "Paris",
      now: 999999,
    };
    expect(authorizeClientEvent(spoofed, player)).toEqual({
      type: "PLAYER_INPUT",
      playerId: "p1",
      input: "Paris",
      now: 1000,
    });
  });

  it("lets only the host drive flow control", () => {
    for (const ev of [{ type: "START" }, { type: "REVEAL" }, { type: "END" }] as SessionEvent[]) {
      expect(authorizeClientEvent(ev, player)).toBeNull();
      expect(authorizeClientEvent(ev, host)).toEqual(ev);
    }
  });

  it("accepts host ADVANCE but forces source to host", () => {
    const ev: SessionEvent = { type: "ADVANCE", source: "auto" };
    expect(authorizeClientEvent(ev, player)).toBeNull();
    expect(authorizeClientEvent(ev, host)).toEqual({ type: "ADVANCE", source: "host" });
  });

  it("rejects server-internal and lifecycle events on the client channel", () => {
    const blocked: SessionEvent[] = [
      { type: "TICK", now: 5 },
      { type: "SERVER_RESULT", payload: { faked: true } },
      { type: "PLAYER_JOINED", playerId: "x", nickname: "x" },
      { type: "CLAIM", playerId: "x" },
    ];
    for (const ev of blocked) {
      expect(authorizeClientEvent(ev, host)).toBeNull();
    }
  });
});
