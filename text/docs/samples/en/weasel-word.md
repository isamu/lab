<!-- chaff-sample
rule: weasel-word
genre: business/proposal
file: standing-desks.md
-->

# Weasel words (`weasel-word`)

**Where it helps:** proposals, business cases, blog posts, reports. Anywhere a claim is meant to persuade.

## Original

```markdown chaff-before
# Proposal: standing desks for the support team

The support team spends most of the day at their desks, on the phone or answering chat.
Several people have asked for desks they can raise and lower.

Studies show that standing for part of the day reduces back pain.
We propose buying twelve adjustable desks this quarter, at a total cost of £4,200.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal standing-desks.md

standing-desks.md   business/proposal · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    Studies show that standing for part of the day reduces back pain.

  ·  Weasel words

     "studies show" does not say who
     "Many experts say", "it is widely believed" and "studies show" (と言われています, ある研究によると) lend a claim to an unnamed crowd or to research no one names. The reader cannot check who said it, and the writer need not stand behind it. The phrases are listed in the lexicon.

     → Name who said it or which study shows it (a name, a year, a source). If you cannot, state it as your own claim, or drop it.

     Relax this rule:  npx chaffjs relax weasel-word


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Proposal: standing desks for the support team

The support team spends most of the day at their desks, on the phone or answering chat.
Several people have asked for desks they can raise and lower.

In our own trial last spring, four of the six people who used an adjustable desk for a month said their back pain had eased.
We propose buying twelve adjustable desks this quarter, at a total cost of £4,200.
```

## How it was fixed

"Studies show" lends the claim to research nobody names.
The person approving £4,200 cannot check which studies, how large they were or what they actually found, and the writer does not have to stand behind the claim.

The fix replaces it with evidence the reader can check: the team's own small trial, with the numbers.
A named study would also work ("a 2019 study of 300 office workers by…"); if neither exists, the honest fix is to state the point as the writer's own view, or drop it.

## Settings

The rule reports the phrases on chaff's list ("studies show", "many experts say", "it is widely believed").
At `normal` and `strict` one is enough; `relaxed` waits for two:

```yaml chaff-settings
rules:
  weasel-word: relaxed
```

A citation right after the phrase does not silence it, since the sentence can name the study itself.
It does not run on literature or speech transcripts, where hearsay is part of the voice.

```text chaff-explain
$ npx chaffjs explain weasel-word --genre business/proposal

  Weasel words   (weasel-word)

  "Many experts say", "it is widely believed" and "studies show" (と言われています, ある研究によると) lend a claim to an unnamed crowd or to research no one names. The reader cannot check who said it, and the writer need not stand behind it. The phrases are listed in the lexicon.

  How to fix: Name who said it or which study shows it (a name, a year, a source). If you cannot, state it as your own claim, or drop it.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once there are 1
  → normal   reported once there are 1
    relaxed  reported once there are 2
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax weasel-word --why "reason"
```

[All samples](README.md)
