import { useEffect, useState } from 'react'

type CountdownProps = {
  target: string | Date
  /** Called once when the countdown reaches zero -- e.g. to refetch and flip
   * "upcoming" to "live" without a manual reload. */
  onComplete?: () => void
  className?: string
}

function partsUntil(target: number) {
  const ms = Math.max(0, target - Date.now())
  const totalSeconds = Math.floor(ms / 1000)
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: ms === 0,
  }
}

/**
 * Real countdown to a real timestamp -- the old app's version was
 * `new Date(Date.now() + 7 days)`, recomputed fresh on every render, so it
 * was permanently "7 days out" no matter when you looked.
 */
export function Countdown({ target, onComplete, className }: CountdownProps) {
  const targetMs = new Date(target).getTime()
  const [parts, setParts] = useState(() => partsUntil(targetMs))

  useEffect(() => {
    if (partsUntil(targetMs).done) return
    const id = setInterval(() => {
      setParts((prev) => {
        const next = partsUntil(targetMs)
        if (next.done && !prev.done) onComplete?.()
        return next
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onComplete intentionally not tracked, it would restart the interval every render
  }, [targetMs])

  if (parts.done) {
    return <span className={className}>Live now</span>
  }

  const cell = (value: number, label: string) => (
    <div className="flex flex-col items-center">
      <span className="font-display text-xl font-semibold tabular-nums sm:text-2xl">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-muted-foreground text-[10px] tracking-wide uppercase">{label}</span>
    </div>
  )

  return (
    <div className={className} role="timer" aria-live="polite">
      <div className="flex items-start gap-3 sm:gap-5">
        {parts.days > 0 && cell(parts.days, 'days')}
        {cell(parts.hours, 'hrs')}
        {cell(parts.minutes, 'min')}
        {cell(parts.seconds, 'sec')}
      </div>
    </div>
  )
}
