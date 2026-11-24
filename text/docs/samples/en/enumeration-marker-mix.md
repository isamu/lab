<!-- chaff-sample
rule: enumeration-marker-mix
genre: docs/manual
file: onboarding.md
-->

# Item numbers written in mixed forms (`enumeration-marker-mix`)

**Where it helps:** procedures, application guides, policies and contracts. Especially a page where items were pasted in from an older version or another document.

## Original

```markdown chaff-before
# Your first day

Before you start work, do the following.

1. Collect your badge from reception.
2. Sign the equipment form.
3) Set up your laptop with the IT team.
4. Join the team chat.

Ask your manager if anything is unclear.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual onboarding.md

onboarding.md   docs/manual · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    3) Set up your laptop with the IT team.

  ·  Item numbers written in mixed forms

     The item number "3)" is written differently from the rest of its run ("1." and 3 in all)
     A "3)" or "(3)" in a run counted "1.", "2." leaves the reader unsure whether it continues the run or starts a level below. Markdown starts a new list where "1." changes to "1)", and does not read "(1)", "①", "一、" or "a." as a list at all. It is the shape a paste or a half-done rewrite leaves. chaff does not pick a form; in one level of one list, or one run of numbered paragraphs, it points at an item written in the minority form that still counts on with the others.

     → Write it the way most numbers of the run are written. If it is meant to be a level below, indent it and count it from 1.

     Relax this rule:  npx chaffjs relax enumeration-marker-mix


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Your first day

Before you start work, do the following.

1. Collect your badge from reception.
2. Sign the equipment form.
3. Set up your laptop with the IT team.
4. Join the team chat.

Ask your manager if anything is unclear.
```

## How it was fixed

The steps are numbered "1.", "2." and "4.", but the third is "3)".
A reader cannot tell whether a new run starts there, and Markdown starts a new list where "1." changes to "1)", with a gap.

The fix writes the third number "3.", like the others.
chaff does not pick a form; in one run it points at an item written in the minority form that still counts on with the others.

## Settings

The rule gives a note at `normal` and `relaxed`, and a warning at `strict`.
Items in another form that count from 1 again ("(1)", "(2)" under "1.") are read as a level below and not reported.
Numbered paragraphs in plain-text documents are read too.

To stop checking:

```yaml chaff-settings
rules:
  enumeration-marker-mix: off
```

```text chaff-explain
$ npx chaffjs explain enumeration-marker-mix --genre docs/manual

  Item numbers written in mixed forms   (enumeration-marker-mix)

  A "3)" or "(3)" in a run counted "1.", "2." leaves the reader unsure whether it continues the run or starts a level below. Markdown starts a new list where "1." changes to "1)", and does not read "(1)", "①", "一、" or "a." as a list at all. It is the shape a paste or a half-done rewrite leaves. chaff does not pick a form; in one level of one list, or one run of numbered paragraphs, it points at an item written in the minority form that still counts on with the others.

  How to fix: Write it the way most numbers of the run are written. If it is meant to be a level below, indent it and count it from 1.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax enumeration-marker-mix --why "reason"
```

[All samples](README.md)
