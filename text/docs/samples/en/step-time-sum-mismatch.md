<!-- chaff-sample
rule: step-time-sum-mismatch
genre: docs/manual
file: tomato-soup.md
-->

# A total time that is not the sum of the steps' times (`step-time-sum-mismatch`)

**Where it helps:** recipes, how-to guides, training plans, lab procedures. Any numbered list of steps with a total time at the top.

## Original

```markdown chaff-before
# Weekday tomato soup

Serves 4. Total time: 35 minutes

1. Peel and chop the onion and the garlic (5 minutes).
2. Soften them in the olive oil over a low heat (10 minutes).
3. Add the tinned tomatoes and the stock, and simmer (20 minutes).
4. Blend until smooth and season to taste (5 minutes).

Serve with crusty bread. The soup keeps in the fridge for three days.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual tomato-soup.md

tomato-soup.md   docs/manual · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    35 minutes

  ⚠  A total time that is not the sum of the steps' times

     "35 minutes" is not the sum of the times in the 4 steps (40 minutes)
     When a recipe or a guide says "Total time: 60 minutes" and the times written in its numbered steps ("(10 minutes)", "bake for 40 minutes") add up to 80, the reader plans with the wrong figure. It happens when a step is added or a time is changed and the total is not. The rule runs when the document states one total outside its steps (a length right after Total time, Total, Time required) and it has one numbered list whose every step states exactly one time of its own, and compares the two. When the total or a step time is rough ("about 1 hour", "20 minutes or so"), a difference up to a tenth of the total, and at least 5 minutes, agrees.

     → Check which is right, the total or the steps' times, and correct the other. If steps run at the same time (the sauce is made while the meat rests), say so.

     Relax this rule:  npx chaffjs relax step-time-sum-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Weekday tomato soup

Serves 4. Total time: 40 minutes

1. Peel and chop the onion and the garlic (5 minutes).
2. Soften them in the olive oil over a low heat (10 minutes).
3. Add the tinned tomatoes and the stock, and simmer (20 minutes).
4. Blend until smooth and season to taste (5 minutes).

Serve with crusty bread. The soup keeps in the fridge for three days.
```

## How it was fixed

The four steps take 5, 10, 20 and 5 minutes: 40 in all, not 35.
The blending step was added after the recipe was first written, and the total at the top was not updated.
A cook who starts at 6:25 for dinner at 7 will be blending while everyone waits.

The fix writes the total the steps add up to, 40 minutes.
If two steps run at the same time (the bread warms while the soup simmers), keep the shorter total and say so in the step; chaff cannot tell steps that overlap.

## Settings

A total that is not the sum of the steps is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  step-time-sum-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

The rule runs when the document states one total outside its steps (Total time, Time required) and has one numbered list whose every step gives exactly one time.
A step with no time, or with a range ("10 to 15 minutes"), makes it stop rather than guess.
When a time is rough ("about 1 hour"), a difference of up to a tenth of the total, and at least 5 minutes, agrees.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain step-time-sum-mismatch --genre docs/manual

  A total time that is not the sum of the steps' times   (step-time-sum-mismatch)

  When a recipe or a guide says "Total time: 60 minutes" and the times written in its numbered steps ("(10 minutes)", "bake for 40 minutes") add up to 80, the reader plans with the wrong figure. It happens when a step is added or a time is changed and the total is not. The rule runs when the document states one total outside its steps (a length right after Total time, Total, Time required) and it has one numbered list whose every step states exactly one time of its own, and compares the two. When the total or a step time is rough ("about 1 hour", "20 minutes or so"), a difference up to a tenth of the total, and at least 5 minutes, agrees.

  How to fix: Check which is right, the total or the steps' times, and correct the other. If steps run at the same time (the sauce is made while the meat rests), say so.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax step-time-sum-mismatch --why "reason"
```

[All samples](README.md)
