<!-- chaff-sample
rule: contrast-framing
genre: blog/tech
file: release.md
-->

# Too many contrast frames (`contrast-framing`)

**Where it helps:** product announcements, launch posts, mission statements, opinion pieces.

## Original

```markdown chaff-before
# Introducing shared drafts

Today we are releasing shared drafts for every workspace on the Team and Business plans.

Shared drafts are not just a new button, but a new way of working together.
Until now, a quote lived in one person's account until it was sent.
If that person was out sick or on holiday, the customer waited, and the rest of the team could only ask them to log in.

It's not about features. It's about trust.
With shared drafts, anyone on the sales team can open a quote, see who changed what, and send it.
The draft keeps a history of every edit, so a price that changed on Tuesday can be traced to the person who changed it.
The person who started the draft gets an email when someone else sends it, with a copy of what went out.

This wasn't built for speed. It was built for teams.
In the six weeks of testing with forty customers, the time from a customer's request to a sent quote fell from two days to under one.

Shared drafts are on by default.
An admin can turn them off for a workspace under Settings, then Sales, and can limit them to named people.
Quotes that were already in progress stay with the person who started them until that person shares them.
If you have questions, the help page on shared drafts covers the settings in more detail.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech release.md

release.md   blog/tech · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    Shared drafts are not just a new button, but a new way of working together.

  ·  Too many contrast frames

     "not just" and other contrast frames: 18.8% of sentences (limit 6%)
     "It's not X, it's Y" and "not just X, but Y" sort out a point when used once. Piled up, the text keeps knocking down an X nobody said, a habit well known in generated text.

     → Drop the X you knocked down and say Y directly.

     Relax this rule:  npx chaffjs relax contrast-framing


─── line 9 ───────────────────────────────────────────────────

    It's not about features.

  ·  Too many contrast frames

     "it's not" and other contrast frames: 18.8% of sentences (limit 6%)
     "It's not X, it's Y" and "not just X, but Y" sort out a point when used once. Piled up, the text keeps knocking down an X nobody said, a habit well known in generated text.

     → Drop the X you knocked down and say Y directly.

     Relax this rule:  npx chaffjs relax contrast-framing


─── line 14 ──────────────────────────────────────────────────

    This wasn't built for speed.

  ·  Too many contrast frames

     "wasn't" and other contrast frames: 18.8% of sentences (limit 6%)
     "It's not X, it's Y" and "not just X, but Y" sort out a point when used once. Piled up, the text keeps knocking down an X nobody said, a habit well known in generated text.

     → Drop the X you knocked down and say Y directly.

     Relax this rule:  npx chaffjs relax contrast-framing


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Introducing shared drafts

Today we are releasing shared drafts for every workspace on the Team and Business plans.

Until now, a quote lived in one person's account until it was sent.
If that person was out sick or on holiday, the customer waited, and the rest of the team could only ask them to log in.

With shared drafts, anyone on the sales team can open a quote, see who changed what, and send it.
The draft keeps a history of every edit.
A price that changed on Tuesday can be traced to the person who changed it.
The person who started the draft gets an email when someone else sends it, with a copy of what went out.

We tested shared drafts for six weeks with forty customers.
The time from a customer's request to a sent quote fell from two days to under one.

Shared drafts are on by default.
An admin can turn them off for a workspace under Settings, then Sales, and can limit them to named people.
Quotes that were already in progress stay with the person who started them until that person shares them.
The help page on shared drafts covers the settings in more detail.
```

## How it was fixed

"Not just a new button, but a new way of working", "It's not about features. It's about trust", "This wasn't built for speed. It was built for teams": three times, the post knocks down something no reader thought and puts a large word in its place.
The large words (trust, teams, a new way of working) are not checkable, and the sentences that carry the real news, who can open a draft and what it records, are squeezed between them.

The corrected post drops the three frames and lets the features and the test result speak.
The one line it adds says plainly what the frames were reaching for: a quote no longer waits for the one person who wrote it.

## Settings

The rule measures the share of sentences written as a contrast frame. In this genre it reports above 6% of sentences; `strict` reports above 4% and `relaxed` above 9% (blog essays have a lower limit of their own):

```yaml chaff-settings
rules:
  contrast-framing: relaxed
```

A single contrast, a plain denial ("It wasn't ready.") and a frame that counts an amount ("not just one coffee") are not counted. Short documents are not measured, and the rule does not run on legal, documentation, literature or speech genres. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score release.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain contrast-framing --genre blog/tech

  Too many contrast frames   (contrast-framing)

  "It's not X, it's Y" and "not just X, but Y" sort out a point when used once. Piled up, the text keeps knocking down an X nobody said, a habit well known in generated text.

  How to fix: Drop the X you knocked down and say Y directly.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 4% of sentences in contrast frames
  → normal   up to 6% of sentences in contrast frames
    relaxed  up to 9% of sentences in contrast frames
    off      not checked

  These numbers are for blog/tech. blog/essay have numbers of their own.

  Now: normal.

  Change it:  npx chaffjs relax contrast-framing --why "reason"
```

[All samples](README.md)
