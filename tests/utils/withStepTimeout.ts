export class StepTimeoutError extends Error {
  public readonly kind = "step-timeout" as const;
  constructor(message = "step-timeout") {
    super(message);
    this.name = "StepTimeoutError";
  }
}

export function isStepTimeout(e: unknown): e is StepTimeoutError {
  return e instanceof StepTimeoutError || (typeof e === "object" && e !== null && (e as any).message === "step-timeout");
}

/**
 * Wrap an awaited step so that if it exceeds `ms` (default 10s),
 * it rejects with StepTimeoutError instead of hanging.
 *
 * Example:
 *   const res = await withStepTimeout(user.click(btn), 10_000).catch(e => e);
 *   if (isStepTimeout(res)) {
 *     // skip the step and continue the test
 *   }
 */
export async function withStepTimeout<T>(p: Promise<T>, ms = 10_000): Promise<T> {
  return await Promise.race<T>([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new StepTimeoutError()), ms)),
  ]);
}

