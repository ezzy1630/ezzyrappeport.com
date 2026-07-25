/**
 * Pure click-guard for chapter hash navigation.
 * Intercept only an unmodified primary-button same-tab hash click.
 */

export type ChapterHashClickEvent = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
};

export type ChapterHashAnchor = {
  target: string;
  download: string;
};

/**
 * Command/Control, Shift, Alt, non-primary button, target, download, and
 * already-prevented clicks keep native browser behavior.
 */
export function shouldInterceptChapterHashClick(
  event: ChapterHashClickEvent,
  anchor: ChapterHashAnchor,
): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target !== "" && anchor.target !== "_self") return false;
  if (anchor.download !== "") return false;
  return true;
}
