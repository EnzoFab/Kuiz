import type { SessionEvent } from "@kuiz/core";

/**
 * The online trust boundary (B14). The server is authoritative: a client's raw socket
 * message is never applied as-is. This normalizes an incoming event to what the sender is
 * actually allowed to do — forcing player identity and the server clock, and gating
 * flow-control events to the host — or rejects it (null). So a client can't answer as
 * someone else, fake its response time, or drive the flow unless it's the host.
 * See docs/spec/brick-contract.md (Execution & trust boundary).
 */

export interface ClientContext {
  /** The socket's authenticated player (set on join/claim); absent until then. */
  playerId?: string;
  isHost: boolean;
  /** Server clock, stamped onto the event (the client's own timing is discarded). */
  now: number;
}

export function authorizeClientEvent(raw: SessionEvent, ctx: ClientContext): SessionEvent | null {
  if (ctx.playerId == null) {
    return null; // must have joined/claimed before sending anything
  }
  switch (raw.type) {
    case "PLAYER_INPUT":
      // Identity and clock come from the server, never the client's payload.
      return { type: "PLAYER_INPUT", playerId: ctx.playerId, input: raw.input, now: ctx.now };
    case "START":
    case "REVEAL":
    case "END":
      return ctx.isHost ? { type: raw.type } : null;
    case "ADVANCE":
      return ctx.isHost ? { type: "ADVANCE", source: "host" } : null;
    default:
      // TICK / SERVER_RESULT are server-internal; PLAYER_JOINED / ADD_SLOT / CLAIM /
      // PLAYER_LEFT have dedicated socket handlers. None are accepted on this channel.
      return null;
  }
}
