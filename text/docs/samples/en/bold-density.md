<!-- chaff-sample
rule: bold-density
genre: blog/owned-media
file: guide.md
-->

# Too much bold (`bold-density`)

**Where it helps:** guides, how-to articles, onboarding pages. Text where the writer wants every tip to stand out.

## Original

```markdown chaff-before
# Getting ready for your first half marathon

Six weeks before the race, most of the hard work is already done.
What matters now is arriving at the start line **rested** and **healthy**.

## The last six weeks

Keep your **long run** once a week, but stop adding distance after week three.
Run **slowly** on most days; only one session a week should feel **hard**.
Sleep counts as training too.
If a knee or an ankle starts to **hurt**, take **two days off** rather than running through it.
**Eat normally** in the week before; a large pasta dinner the night before only makes you **heavy**.

## On the day

Get there an hour early, pin your number on the front of your shirt, and use the toilets before the queue builds.
Start slower than feels right.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/owned-media guide.md

guide.md   blog/owned-media · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    Keep your long run once a week, but stop adding distance after week three.

  ⚠  Too much bold

     7 bold spans in 286 characters (limit 20 per 1000)
     Bold marks what matters. Used everywhere, it marks nothing.

     → Keep one or two, unbold the rest.

     Relax this rule:  npx chaffjs relax bold-density


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Getting ready for your first half marathon

Six weeks before the race, most of the hard work is already done.
What matters now is arriving at the start line rested and healthy.

## The last six weeks

Keep your long run once a week, but stop adding distance after week three.
Run slowly on most days; only one session a week should feel hard.
Sleep counts as training too.
If a knee or an ankle starts to hurt, **take two days off** rather than running through it.
Eat normally in the week before; a large pasta dinner the night before only makes you heavy.

## On the day

Get there an hour early, pin your number on the front of your shirt, and use the toilets before the queue builds.
Start slower than feels right.
```

## How it was fixed

The section on the last six weeks has seven words or phrases in bold in under 300 characters.
A reader skimming the page sees "long run", "slowly", "hard", "hurt", "two days off", "Eat normally", "heavy" and cannot tell which of them is the advice that matters.

The fix keeps one: the instruction to rest when something hurts, the one a keen first-time runner is most likely to ignore.
The rest goes back to plain text, where it reads as ordinary advice. The bold in the opening paragraph went too.

## Settings

The rule counts bold spans per 1000 characters in each section, and reports a section above 20; `strict` reports one above 10 and `relaxed` one above 40.
A section under 200 characters is not measured, since one bold word would swing the rate.
A short label opening a line (**Date:**) names the value after it and is not counted.

```yaml chaff-settings
rules:
  bold-density: relaxed
```

```text chaff-explain
$ npx chaffjs explain bold-density --genre blog/owned-media

  Too much bold   (bold-density)

  Bold marks what matters. Used everywhere, it marks nothing.

  How to fix: Keep one or two, unbold the rest.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 10 bold spans per 1000 characters
  → normal   up to 20 bold spans per 1000 characters
    relaxed  up to 40 bold spans per 1000 characters
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax bold-density --why "reason"
```

[All samples](README.md)
