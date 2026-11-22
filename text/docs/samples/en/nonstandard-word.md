<!-- chaff-sample
rule: nonstandard-word
genre: business/proposal
file: mentoring-proposal.md
-->

# Nonstandard word (`nonstandard-word`)

**Where it helps:** proposals, applications, reports, letters. Anywhere a formal reader is deciding whether to trust the writer.

## Original

```markdown chaff-before
# Proposal: a mentoring scheme for new hires

New hires in the first year often say they do not know who to ask.
We propose pairing each one with a mentor from another team for their first six months.

The pilot group is comprised of twelve new hires and twelve mentors.
Irregardless of the result, we will share what we learn with every department in December.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal mentoring-proposal.md

mentoring-proposal.md   business/proposal · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    The pilot group is comprised of twelve new hires and twelve mentors.

  ·  Nonstandard word

     "is comprised of" is nonstandard in formal writing; write "comprises"
     "Irregardless", "comprised of" and "anyways" are common in speech, but a formal reader takes them as mistakes and starts to doubt the care taken over the rest. The pairs of nonstandard and standard form are in each language's lexicon, and chaff reports only the forms listed there.

     → Use the standard form ("irregardless" becomes "regardless", "is comprised of" becomes "comprises"). If the form is part of a name written that way on purpose (a title, a product), add the name to names in chaff.yaml.

     Relax this rule:  npx chaffjs relax nonstandard-word


─── line 7 ───────────────────────────────────────────────────

    Irregardless of the result, we will share what we learn with every department in December.

  ·  Nonstandard word

     "Irregardless" is nonstandard in formal writing; write "Regardless"
     "Irregardless", "comprised of" and "anyways" are common in speech, but a formal reader takes them as mistakes and starts to doubt the care taken over the rest. The pairs of nonstandard and standard form are in each language's lexicon, and chaff reports only the forms listed there.

     → Use the standard form ("irregardless" becomes "regardless", "is comprised of" becomes "comprises"). If the form is part of a name written that way on purpose (a title, a product), add the name to names in chaff.yaml.

     Relax this rule:  npx chaffjs relax nonstandard-word


────────────────────────────────────────────────────────────

  2 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Proposal: a mentoring scheme for new hires

New hires in the first year often say they do not know who to ask.
We propose pairing each one with a mentor from another team for their first six months.

The pilot group comprises twelve new hires and twelve mentors.
Regardless of the result, we will share what we learn with every department in December.
```

## How it was fixed

"Is comprised of" and "irregardless" are heard every day, and most people understand them.
But a reader deciding whether to fund a proposal takes them as mistakes, and starts to wonder how carefully the rest was written.

The fix uses the standard forms: "comprises" (or "is made up of") and "regardless".
Nothing else changed; the proposal simply no longer gives the reader a reason to doubt it.

## Settings

The rule reports only the forms listed in chaff's lexicon, each with its standard form.
It is a note at `normal` and `relaxed`, and a warning at `strict`:

```yaml chaff-settings
rules:
  nonstandard-word: strict
```

It does not run on literature or speech transcripts, where "anyways" in dialogue is the speaker's voice, or on patents, where "comprised of" is a term of art.
Misspellings are left to `known-misspelling`.

```text chaff-explain
$ npx chaffjs explain nonstandard-word --genre business/proposal

  Nonstandard word   (nonstandard-word)

  "Irregardless", "comprised of" and "anyways" are common in speech, but a formal reader takes them as mistakes and starts to doubt the care taken over the rest. The pairs of nonstandard and standard form are in each language's lexicon, and chaff reports only the forms listed there.

  How to fix: Use the standard form ("irregardless" becomes "regardless", "is comprised of" becomes "comprises"). If the form is part of a name written that way on purpose (a title, a product), add the name to names in chaff.yaml.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax nonstandard-word --why "reason"
```

[All samples](README.md)
