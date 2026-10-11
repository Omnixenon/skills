---
name: read-back
description: Read my prompt back to me — intent and direction — before any work starts.
disable-model-invocation: true
---

Give a **read-back** of my prompt, the way a pilot reads back a clearance: say what you heard so I can confirm it before anything executes. This turn's only output is the read-back; the work waits for my go.

**The prompt** is the text after `/read-back`. If there is none, it is my last message before the command.

**Pending read-backs.** Every read-back since my last **Go** is still open. A new read-back merges all of them with the new prompt into one cumulative read-back — I never have to ask for "everything". Where the new prompt conflicts with a pending ask, the new prompt wins and you flag the replaced item under **Unclear**. A **Go** closes the chain; the next read-back starts fresh.

## Building it

- Work from the prompt's own words. Earlier conversation counts only where the prompt points to it or it is a pending read-back, and every borrowing is declared.
- I may be dictating. Where a word looks misheard, read it as the likely intended word and flag the swap.
- Build from the prompt alone — no file reads, searches, or edits. A reference you can't resolve without looking goes under **Unclear**.
- **Seeds.** My examples and lists are usually seeds: off-the-cuff samples of a direction, not the full set. Judge each one by its shape — a handful of parallel items, a style, a "something like" — and read it as a seed by default; "etc" only raises your confidence. Name the direction it points in and grow it with a few items that clearly follow the pattern. Unsure whether it's a seed or the exact set? Grow it and say so under **Unclear**. A seed I've closed ("just these") stays as said.

Done when every distinct ask in the prompt and in every pending read-back maps to a **Direction** line, every **Direction** line maps back to one of them, and every seed is grown under **Extending**.

## Format

Under 15 lines, 17 with **Extending**; a cumulative read-back may exceed that, but stays compact. Compact beats complete-sounding.

```
**Intent** — <one sentence: the outcome I want, in your words>

**Direction**
1. <what you'll do, in order>

**Extending** — <per seed: the direction in a phrase → the items you'll add beyond mine>   (omit if no seeds)
**Leaving alone** — <nearby work you'd be tempted into but won't touch>
**From earlier context** — <pending read-back asks carried forward, plus anything else borrowed, or "nothing">
**Unclear** — <each gap + the reading you'd default to>   (omit if none)

Go, or correct me?
```

## After

- **Go** → execute exactly the confirmed read-back, **Extending** items included; carry each seed's direction through the work.
- **Go, without extending** → execute it with the seeds kept as I said them; skip **Extending**.
- **Correction** or another `/read-back` → issue a fresh cumulative read-back with it folded in.
