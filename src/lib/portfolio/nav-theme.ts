/**
 * Navigation chrome theme — owned by section geometry, not a floating depth
 * threshold. About + Contact always flip to pearl so dark basin copy never
 * paints through ink chrome. Case routes stay ink-on-light (pale case paper).
 */

export type NavTheme = "ink-on-light" | "white-on-deep";

export type NavThemeSection =
  | "hero"
  | "projects"
  | "about"
  | "contact"
  | "case"
  | string;

export function navThemeFromSection(
  section: NavThemeSection,
  depth = 0,
): NavTheme {
  if (section === "about" || section === "contact") return "white-on-deep";
  if (section === "hero" || section === "projects" || section === "case") {
    return "ink-on-light";
  }
  return depth >= 0.56 ? "white-on-deep" : "ink-on-light";
}

export function isNavTheme(value: string | undefined): value is NavTheme {
  return value === "ink-on-light" || value === "white-on-deep";
}

/** True when the URL is a case-study route (client or SSR path). */
export function isCasePathname(pathname: string): boolean {
  return pathname.startsWith("/project/");
}
