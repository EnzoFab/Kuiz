import type { BrickDefinition, BrickLogic, BrickResolver } from "@kuiz/core";

/**
 * The shared Brick registry: maps a Brick `type` to its definition. Both the server and
 * the clients import this so a Game's `brick.type` resolves the same logic everywhere.
 * See docs/spec/brick-contract.md. (Views are registered separately, per frontend.)
 */
export class BrickRegistry {
  private readonly defs = new Map<string, BrickDefinition>();

  register(def: BrickDefinition): this {
    if (this.defs.has(def.type)) {throw new Error(`Brick type already registered: ${def.type}`);}
    this.defs.set(def.type, def);
    return this;
  }

  get(type: string): BrickDefinition {
    const def = this.defs.get(type);
    if (!def) {throw new Error(`Unknown brick type: ${type}`);}
    return def;
  }

  has(type: string): boolean {
    return this.defs.has(type);
  }

  logic(type: string): BrickLogic {
    return this.get(type).logic;
  }

  types(): string[] {
    return [...this.defs.keys()];
  }

  /** A resolver for the flow engine's `EngineDeps.resolve`. */
  resolver(): BrickResolver {
    return (type) => this.logic(type);
  }
}

/** The default shared registry; Brick modules register into this (B6+). */
export const brickRegistry = new BrickRegistry();
