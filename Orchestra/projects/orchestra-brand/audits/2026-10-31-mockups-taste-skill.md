# Mockups: taste-skill pass (Oct 31)

Figma page: Mockups (node 2024:146). Frames: Landing / Hero · 1440, Landing / Hero · 390, App / Research · 1440.
Inspector/lint scripts not run: they measure HTML in a browser, and these are Figma frames. Checks below are by eye against the skill's rules.

## Landing hero: direction `one-motif`, seed 716161109
- Idea: the ∫ (violin f-hole + sum sign) becomes the one giant cropped shape (blue disc, white ∫, entering from the right).
- Brand overrides: pill "motif button" → design-system Button (sharp radius decision). Headline set at 104/100, above the Display/XL style (72).
- Fixed: stray default stroke on the ∫ vector.
- Open: no live thing yet (needs the sections below the hero); real-picture floor (4+) applies to the full page; the ASCII violin is the obvious first picture.

## Cover art variants (blue hero, live-text ASCII in IBM Plex Mono, characters drawn from an agent-log stream)
- Converter: scratchpad `ascii.ps1` (System.Drawing; ink-only + 4×4 Bayer dither; `-sat` mode for photos on grey). Text in `_Orchestration/assets/ascii/`.
- A Violin: "Violin", Nicolò Amati, 1669, The Met, CC0 (saturation mode).
- B Hand: "Self-portrait, Study of a Hand and a Pillow", Albrecht Dürer, 1493, The Met, CC0.
- C Apollo: "Apollo Belvedere", Asher Brown Durand, The Met, CC0.
- D Integral disc: original, the mark knocked out of a disc of log text.
- Tried and dropped: "Mechanisch concert" (Rijksmuseum, CC0); too uniformly dark, read as noise.
- Credits: `_Orchestration/assets/credits.json`; none required, credit in the footer anyway.

## Research screen: app style `framed-sheet`, seed 401128173
- Question: what does the ensemble need from me before it can generate? Finding: type agent blocked on a Söhne licence.
- Signature element: "The score": one lane per agent; done = blue, running = Mist, waiting = Signal, queued = dashed.
- Brand overrides: sheet radius 0 instead of 16.
- Fixed: left column and agents panel overflowed the sheet; score axis clipped; log lines wrapped; blank violin thumbnail (now the ASCII violin vector); 6th deliverable overflowed (dropped "Icons", which wasn't in the notes).
- Sample data to replace: projects "Hermes study", "Kiln & Co. rebrand"; references rows 3–4 thumbnails are flat tiles; log times; Söhne decision.
