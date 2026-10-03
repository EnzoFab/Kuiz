import { describe, it, expect } from "vitest";
import { brickRegistry } from "@kuiz/bricks";
import { SessionStore } from "./sessions.js";
import { demoGame } from "./demo.js";

describe("SessionStore", () => {
  const store = new SessionStore(brickRegistry.resolver());

  it("creates a session with a code and looks it up", () => {
    const session = store.create(demoGame);
    expect(session.code).toMatch(/^[A-Z0-9]{4}$/);
    expect(store.getByCode(session.code)?.id).toBe(session.id);
    expect(store.getByCode(session.code.toLowerCase())?.id).toBe(session.id);
    expect(store.get(session.id)?.state.phase).toBe("lobby");
  });

  it("applies events through the engine", () => {
    const session = store.create(demoGame);
    store.apply(session.id, { type: "PLAYER_JOINED", playerId: "p1", nickname: "Al" });
    expect(store.get(session.id)?.state.players.p1).toEqual({ nickname: "Al", isConnected: true });
  });

  it("returns undefined for an unknown code or id", () => {
    expect(store.getByCode("ZZZZ")).toBeUndefined();
    expect(store.apply("nope", { type: "START" })).toBeUndefined();
  });
});
