export type FixedStepState = Readonly<{
  accumulator: number;
  steps: number;
  droppedTime: number;
}>;

export function accumulateFixedSteps(
  accumulator: number,
  frameDelta: number,
  step: number,
  maxSteps: number,
): FixedStepState {
  const safeStep = Math.max(step, 1 / 1000);
  const boundedDelta = Math.max(0, Math.min(frameDelta, safeStep * maxSteps * 2));
  let next = Math.max(0, accumulator) + boundedDelta;
  const available = Math.floor(next / safeStep);
  const steps = Math.min(available, Math.max(0, maxSteps));
  next -= steps * safeStep;
  const droppedTime = available > maxSteps ? next : 0;
  if (available > maxSteps) next = 0;
  return { accumulator: next, steps, droppedTime };
}

