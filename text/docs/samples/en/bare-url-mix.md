<!-- chaff-sample
rule: bare-url-mix
genre: docs/manual
file: welcome.md
-->

# A bare URL among worded links (`bare-url-mix`)

**Where it helps:** onboarding pages, help pages, newsletters. Any page with several links that the reader is meant to follow.

## Original

```markdown chaff-before
# Your first week

Welcome to the team. These are the pages you will use most.

Book your laptop and desk through the [equipment request form](https://intranet.example.com/forms/equipment).
Read the [travel and expenses policy](https://intranet.example.com/policies/travel) before you book a trip.
Your holiday allowance and sick days are in the [leave planner](https://intranet.example.com/leave).
For anything about pay, use https://intranet.example.com/payroll/questions and the payroll team will answer within two working days.

If a link does not open, the IT help desk is on extension 400.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual welcome.md

welcome.md   docs/manual · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    https://intranet.example.com/payroll/questions

  ·  A bare URL among worded links

     The URL "https://intranet.example.com/payroll/questions" is written bare (3 worded links in this document)
     When a document's links are mostly words ("[the setup guide](https://…)"), a URL left bare in the text ("https://…") makes the reader read a string of symbols there and guess the target from it. A spot that does not match the worded links is usually one that was not rewritten. Neither style is called right; a document that writes its URLs bare (few worded links, or more bare URLs than worded ones) is not reported.

     → Make the target's name the link text ("[the setup guide](https://…)"). If the URL itself should show, wrap it in angle brackets ("<https://…>").

     Relax this rule:  npx chaffjs relax bare-url-mix


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Your first week

Welcome to the team. These are the pages you will use most.

Book your laptop and desk through the [equipment request form](https://intranet.example.com/forms/equipment).
Read the [travel and expenses policy](https://intranet.example.com/policies/travel) before you book a trip.
Your holiday allowance and sick days are in the [leave planner](https://intranet.example.com/leave).
For anything about pay, use the [payroll question form](https://intranet.example.com/payroll/questions), and the payroll team will answer within two working days.

If a link does not open, the IT help desk is on extension 400.
```

## How it was fixed

Three links on the page say where they go: "equipment request form", "leave planner".
The fourth is a raw address, so the new starter has to read a string of slashes to guess what it opens, and the sentence around it becomes hard to read.
It is usually a line added later and never tidied.

The fix gives the link a name, like the others.
If an address must show (for a reader who will type it), wrap it in angle brackets, `<https://…>`, and chaff reads it as deliberate.

## Settings

The rule only reads a document whose other links are mostly worded.
At `normal`, it needs three worded links; `strict` needs two, `relaxed` five.
A document that writes most of its addresses bare is not reported.

To stop checking:

```yaml chaff-settings
rules:
  bare-url-mix: off
```

```text chaff-explain
$ npx chaffjs explain bare-url-mix --genre docs/manual

  A bare URL among worded links   (bare-url-mix)

  When a document's links are mostly words ("[the setup guide](https://…)"), a URL left bare in the text ("https://…") makes the reader read a string of symbols there and guess the target from it. A spot that does not match the worded links is usually one that was not rewritten. Neither style is called right; a document that writes its URLs bare (few worded links, or more bare URLs than worded ones) is not reported.

  How to fix: Make the target's name the link text ("[the setup guide](https://…)"). If the URL itself should show, wrap it in angle brackets ("<https://…>").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported in a document with 2 or more worded links
  → normal   reported in a document with 3 or more worded links
    relaxed  reported in a document with 5 or more worded links
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax bare-url-mix --why "reason"
```

[All samples](README.md)
