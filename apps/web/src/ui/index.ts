/**
 * The single UI swap seam. Feature components and Brick views import primitives from here
 * (`../ui`), never deep-import. Replacing the design system = replacing this folder; call
 * sites are unaffected. See CLAUDE.md "UI components: keep them swappable".
 */
export * from "./primitives";
export { cn } from "./cn";
