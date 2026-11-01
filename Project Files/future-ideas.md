# Orchestra: future ideas

Ideas for later. Not part of the current build plan (that's in `orchestra-notes.md`).

---

## 1. Distribution: share Orchestra with friends and other people

- Goal: send the app to other computers and other people.
- Orchestra is a **framework you plug your own compute into**: Claude Code, ChatGPT, or anything else. Whatever is plugged in follows the same rules and the same architecture: Orchestrator → Musicians → Instruments.
- **Mix and match AI models per agent.** If you have several subscriptions (e.g. ChatGPT + Claude), each Musician/Instrument can run on whichever model is best at its job. Example: a 3D modeler Musician and its Instruments run on Astra because it's much better at 3D modeling, while Claude stays the Orchestrator and hands those tasks off to Astra. The user sets up each provider once; after that the Orchestrator sends each task to the right model.
- The app **adapts to each user** as they use it. Ship a baseline big enough that anyone can sit down with plenty of resources and do (almost) anything they want.

## 2. Fully open source and customizable

Already customizable today:
- Reference sites (add your own)
- Agents develop over time to fit your needs; you can edit them, the existing ones included
- Deliverable types (add more)

**Advanced mode** (for anything the app doesn't support yet):
- Settings → turn on **Advanced mode**.
- It gives you a prompt to copy into your own Claude Code terminal, so you can keep developing Orchestra yourself.
- Show a **warning**: if you pull official updates from the GitHub repo, they may overwrite your changes. Alternatively, your fork runs as a separate application.
- Anything can change: features, systems, UI layout, styling.
- Principle: **architect the whole app so other users can change and customize it however they like.**

## 3. Onboarding flow (first launch)

**Welcome / landing screen**
- A cool landing page, something like "Welcome".
- Maybe the Orchestrator speaks to you.
- ASCII art animation, for example music, sound waves, or a rotating statue (ties in with the existing violin ASCII brand asset).

**Step 1: Name**
- "What should we call you?"

**Step 2: Compute**
- "What are you using?" Claude, ChatGPT, or something else.

**Step 3: Tools you use / MCPs**
- Ask what the user uses most, rather than asking about MCPs directly. For example Figma, Adobe Creative Cloud, Blender, and so on.
- If a picked tool has an MCP connection, recommend connecting it (e.g. Figma MCP).
- Optional now, can be done later.

**Step 4: File path setup**
- The Orchestrator creates a folder on the Desktop where everything lives.

**Step 5: Dependencies**
- Install everything needed: Obsidian, and so on.
- Idea: bundle it all as one install (a skill package or plugin that compiles everything).

---

## Open questions
- Exact compute adapters: how ChatGPT and other providers hook into the Orchestrator/Musician/Instrument model.
- Per-agent model assignment: where it's set (agent file? settings?), what happens if a provider isn't connected (fall back to the default?), and whether onboarding Step 2 lets you pick several providers.
- Update path for users who've customized: separate app vs. fork vs. merge.
- Which tools map to which MCPs (the recommendation list).
- Installer format: one bundled installer vs. guided step-by-step installs.
