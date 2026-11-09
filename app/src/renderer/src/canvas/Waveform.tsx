/** Above a window while an agent works on it: the Working tag with a little 8-bit waveform
 * running the rest of the frame's width, never taller than the tag. */
export function Waveform({ w }: { w: number }): React.JSX.Element {
  // one column about every 4px across what the tag leaves; they stretch to fill it exactly
  const columns = Math.max(8, Math.floor((w - 90) / 4))
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-[22px] flex h-[22px] items-stretch gap-1.5">
      <span className="flex items-center bg-brand px-2 type-label-s text-on-brand">Working</span>
      <span aria-hidden className="flex min-w-0 flex-1 gap-px">
        {Array.from({ length: columns }, (_, i) => (
          <span
            key={i}
            className="h-full flex-1 [clip-path:inset(60%_0_0_0)] motion-safe:animate-[working-wave_1400ms_steps(5)_infinite]"
            style={{
              background:
                'repeating-linear-gradient(to top, var(--color-brand) 0 2px, transparent 2px 3px)',
              // the steady offset makes the wave travel; the second term roughens it
              animationDelay: `${-i * 70 - ((i * i) % 13) * 110}ms`
            }}
          />
        ))}
      </span>
    </div>
  )
}
