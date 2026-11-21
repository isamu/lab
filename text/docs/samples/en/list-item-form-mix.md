<!-- chaff-sample
rule: list-item-form-mix
genre: business/email
file: email.md
-->

# List items in mixed forms (`list-item-form-mix`)

**Where it helps:** emails, checklists, briefings. Any list the reader is meant to run their eye down.

## Original

```markdown chaff-before
Subject: Team day on Friday: what to bring

Hi all,

We meet at the car park by the lake at 9:30 and walk to the boathouse together.
Please bring:

- A packed lunch
- Walking boots or strong trainers
- A waterproof jacket
- You will also need a change of clothes, because the kayaks are wet.
- Sun cream

See you on Friday,
Laura
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email email.md

email.md   business/email · English   genre from --genre

─── line 11 ──────────────────────────────────────────────────

    You will also need a change of clothes, because the kayaks are wet.

  ·  List items in mixed forms

     "You will also need a change of clothes, because the kayaks are wet." is a sentence; the other items in this list are phrases (1 of 3)
     Items in one list are easiest to compare when they share a form. When one item is a full sentence among noun phrases, or opens with a verb (Install …) among items that open with a noun (The server …), it reads as a different kind of thing. chaff does not decide which form is right; within one list it points at the items in the less common form.

     → Rewrite the odd item in the form the others use. If it really is a different kind of thing, move it to its own list or paragraph.

     Relax this rule:  npx chaffjs relax list-item-form-mix


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Team day on Friday: what to bring

Hi all,

We meet at the car park by the lake at 9:30 and walk to the boathouse together.
Please bring:

- A packed lunch
- Walking boots or strong trainers
- A waterproof jacket
- A change of clothes, because the kayaks are wet
- Sun cream

See you on Friday,
Laura
```

## How it was fixed

Four items name a thing to pack.
The fourth is a sentence of its own, with a subject and a verb, so it reads as a remark rather than one more thing for the bag.
A reader ticking the list may skip it.

The fix writes it as a thing to pack, like the others, and keeps the reason after it.
chaff does not decide which form is right; within one list it points at the items in the less common form.
If an item really is a different kind of thing, it can move out of the list into its own sentence.

## Settings

The rarer form is reported while it is at most a third of the list's items (34% at `normal`, 49% at `strict`, 20% at `relaxed`).
Lists of fewer than three items, one-word items, "Label: value" items and items holding a link are not checked.

To stop checking:

```yaml chaff-settings
rules:
  list-item-form-mix: off
```

It is off for legal texts, literature, speech and meeting notes, where a list mixes forms by nature.

```text chaff-explain
$ npx chaffjs explain list-item-form-mix --genre business/email

  List items in mixed forms   (list-item-form-mix)

  Items in one list are easiest to compare when they share a form. When one item is a full sentence among noun phrases, or opens with a verb (Install …) among items that open with a noun (The server …), it reads as a different kind of thing. chaff does not decide which form is right; within one list it points at the items in the less common form.

  How to fix: Rewrite the odd item in the form the others use. If it really is a different kind of thing, move it to its own list or paragraph.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported when the less common form is 49% of the list's items or less
  → normal   reported when the less common form is 34% of the list's items or less
    relaxed  reported when the less common form is 20% of the list's items or less
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax list-item-form-mix --why "reason"
```

[All samples](README.md)
