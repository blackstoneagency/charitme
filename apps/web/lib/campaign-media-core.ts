/**
 * Narrow a Supabase Storage `list()` result to an array of entries.
 *
 * ⚠️ **`data ?? []` and `data?.some(...)` are NOT enough.** Optional chaining
 * guards `null` and `undefined`, but not a value of the wrong TYPE — and when
 * `list()` returned a non-array here, `data?.some` threw
 * `TypeError: c?.some is not a function` and `/campaigns/[slug]/gallery`
 * answered **HTTP 500** on a public route.
 *
 * That directly violated this module's own contract, which promises to return
 * `null` on ANY failure rather than throwing. A type check keeps that promise.
 */
export function asFileList(data: unknown): { name: string; id: string | null; metadata: unknown }[] {
  if (!Array.isArray(data)) return [];
  return data as { name: string; id: string | null; metadata: unknown }[];
}
