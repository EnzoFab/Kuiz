import { CORE_VERSION } from "@kuiz/core";
import { BRICKS_VERSION } from "@kuiz/bricks";

/**
 * B1 scaffold: minimal app proving the web client builds and consumes the shared
 * packages. The real shell (Tailwind + shadcn/ui, token theme, brickViews) lands in B8.
 */
export function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1>Kuiz</h1>
      <p>Scaffold online. core {CORE_VERSION} · bricks {BRICKS_VERSION}</p>
    </main>
  );
}
