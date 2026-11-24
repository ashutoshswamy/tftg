/** PostgREST embeds a to-one relation as an object, but untyped clients infer
 * an array. Accept either so callers read the related row the same way. */
export function one<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}
