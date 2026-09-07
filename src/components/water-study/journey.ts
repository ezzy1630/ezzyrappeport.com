const smooth = (start: number, end: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - start) / Math.max(1, end - start)));
  return t * t * (3 - 2 * t);
};

/** Document-space landmarks keep the descent and return stable across screen sizes. */
export function journeyState(scroll: number, heroHeight: number, contactTop: number, viewport: number) {
  const descent = smooth(heroHeight * .2, heroHeight * 1.5, scroll);
  const returnLight = Number.isFinite(contactTop) ? smooth(Math.max(heroHeight * 1.5, contactTop - viewport), contactTop - viewport * .08, scroll) : 0;
  return { depth: descent * (1 - returnLight * .96), returnLight };
}

export function projectPresence(top: number, height: number, viewport: number) {
  const distance = Math.abs(top + height * .5 - viewport * .5);
  return 1 - smooth(viewport * .1, viewport * .75 + height * .15, distance);
}
