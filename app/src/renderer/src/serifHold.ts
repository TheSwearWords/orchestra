// Labels swap to the serif on hover (serif-on). The serif runs a different width, so each such
// element is held at the wider of its two widths: hovering never moves or resizes anything.

function hold(el: HTMLElement): void {
  el.style.minWidth = ''
  el.style.minHeight = ''
  const w0 = el.offsetWidth
  const h0 = el.offsetHeight
  el.classList.add('serif-measure')
  const w1 = el.offsetWidth
  const h1 = el.offsetHeight
  el.classList.remove('serif-measure')
  if (w0 === 0) return // not laid out (hidden); measured again when it changes
  el.style.minWidth = `${Math.max(w0, w1)}px`
  el.style.minHeight = `${Math.max(h0, h1)}px`
}

/** Holds every serif-on label now and as labels appear or change. */
export function holdSerifWidths(): void {
  const pending = new Set<HTMLElement>()
  let frame = 0
  const queue = (el: HTMLElement): void => {
    pending.add(el)
    frame ||= requestAnimationFrame(() => {
      frame = 0
      for (const e of pending) if (e.isConnected) hold(e)
      pending.clear()
    })
  }
  const scan = (root: ParentNode): void => {
    if (root instanceof HTMLElement && root.classList.contains('serif-on')) queue(root)
    root.querySelectorAll?.<HTMLElement>('.serif-on').forEach(queue)
  }
  new MutationObserver((records) => {
    for (const r of records) {
      // a label's own text changed (Next → Skip), or new nodes arrived
      const owner = (r.target instanceof Element ? r.target : r.target.parentElement)?.closest?.(
        '.serif-on'
      ) as HTMLElement | null
      if (owner) queue(owner)
      r.addedNodes.forEach((n) => n instanceof Element && scan(n))
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true })
  // the serif loads after first paint; measure once fonts are in
  void document.fonts.ready.then(() => scan(document))
  scan(document)
}
