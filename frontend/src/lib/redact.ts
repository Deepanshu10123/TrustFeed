// Things that must never be sent to an error-tracking service: the sign-in
// token the live-progress stream carries in its web address, and the login
// tokens Supabase leaves in the page's own address for a moment after a
// Google sign-in.
//
// Matches `name=value` after a ? & or # -- so "mytoken=" is left alone --
// and stops at the end of the value (& # a space or a quote).
const SECRET_PARAM =
  /(^|[?&#])((?:access_token|refresh_token|provider_token|provider_refresh_token|token|code)=)[^&#\s"']*/g

export function redactSecrets(text: string): string {
  return text.replace(SECRET_PARAM, '$1$2[removed]')
}

/** The same, applied to every piece of text inside an error report, wherever
 * it sits -- the page address, a breadcrumb, an error message. (The backend
 * learned this the hard way: cleaning only the obvious field missed copies.) */
export function redactDeep<T>(value: T, depth = 0): T {
  if (typeof value === 'string') return redactSecrets(value) as T
  if (value === null || typeof value !== 'object' || depth > 20) return value
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, depth + 1)) as T
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactDeep(item, depth + 1)])) as T
}
