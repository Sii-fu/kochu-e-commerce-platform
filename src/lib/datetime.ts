/**
 * ISO timestamp (as stored, always UTC) -> the local-time string a
 * `<input type="datetime-local">` expects. The round trip back is just
 * `new Date(value).toISOString()` -- the browser already interprets an
 * unzoned datetime-local value as local time.
 */
export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
