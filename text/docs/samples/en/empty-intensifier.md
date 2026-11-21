<!-- chaff-sample
rule: empty-intensifier
genre: business/proposal
file: proposal.md
-->

# Empty intensifier (`empty-intensifier`)

**Where it helps:** proposals, emails, reports, blog posts. It is one of the habits of generated text, and of writers in a hurry.

## Original

```markdown chaff-before
# Moving the weekly sales report to Thursday

Today the weekly sales report goes out on Monday at noon.
It is important to note that the regional figures arrive on Friday evening, so the report is built over the weekend.

I propose that we send it on Thursday instead, using the figures up to Wednesday.
Needless to say, getting this right is extremely important for the whole team.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal proposal.md

proposal.md   business/proposal · English   genre from --genre

─── line 4 ───────────────────────────────────────────────────

    It is important to note that the regional figures arrive on Friday evening, so the report is built over the weekend.

  ⚠  Empty intensifier

     "it is important to note that" emphasises without saying anything
     "Extremely important" does not say what matters or why. It only feels emphatic.

     → Say what matters and why. If you cannot, the sentence can go.

     Relax this rule:  npx chaffjs relax empty-intensifier


─── line 7 ───────────────────────────────────────────────────

    Needless to say, getting this right is extremely important for the whole team.

  ⚠  Empty intensifier

     "needless to say" emphasises without saying anything
     "Extremely important" does not say what matters or why. It only feels emphatic.

     → Say what matters and why. If you cannot, the sentence can go.

     Relax this rule:  npx chaffjs relax empty-intensifier


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Moving the weekly sales report to Thursday

Today the weekly sales report goes out on Monday at noon.
The regional figures arrive on Friday evening, so the report is built over the weekend.

I propose that we send it on Thursday instead, using the figures up to Wednesday.
Nobody would work on it at the weekend, and the managers would have it before their Friday planning meeting.
```

## How it was fixed

"It is important to note that", "needless to say" and "extremely important" all say that something matters, and none of them says why.
The reader is told to care, but not given a reason, and the last sentence of a proposal is where the reason belongs.

The fix drops the first phrase: the fact after it stands on its own.
The last sentence is replaced with what the change actually gives the team: no weekend work, and the report in time for Friday's meeting.
If you cannot say why something matters, the sentence can usually go.

## Settings

The rule reports a stock phrase that only adds weight.
In a team that writes for itself, relax it; to stop checking, turn it off:

```yaml chaff-settings
rules:
  empty-intensifier: relaxed
```

It is turned off for literature, where emphasis is the author's choice, and its level differs by genre (see the `explain` output below).

```text chaff-explain
$ npx chaffjs explain empty-intensifier --genre business/proposal

  Empty intensifier   (empty-intensifier)

  "Extremely important" does not say what matters or why. It only feels emphatic.

  How to fix: Say what matters and why. If you cannot, the sentence can go.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once there are 1
  → normal   reported once there are 1
    relaxed  reported once there are 3
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax empty-intensifier --why "reason"
```

[All samples](README.md)
