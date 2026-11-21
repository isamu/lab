<!-- chaff-sample
rule: q-fragment-answer
genre: blog/tech
file: post.md
-->

# Questions answered with a fragment (`q-fragment-answer`)

**Where it helps:** blog posts, engineering write-ups, product updates.

## Original

```markdown chaff-before
# We moved our build to a bigger machine

Last month our test suite took 41 minutes on the shared build server.
Most of that time was spent waiting for a free slot.

So we rented one machine of our own with 32 cores.
The cost? About 300 dollars a month.
The result? A full run in 9 minutes.

Is it perfect? No.
The machine sits idle at night and at weekends, and we still have to update it ourselves.
For a team of twelve, the time saved pays for it in the first week.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech post.md

post.md   blog/tech · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    The cost? About 300 dollars a month.

  ·  Questions answered with a fragment

     "About 300 dollars a month." and other fragment answers to your own question: 3 (2 needed)
     "Is it perfect? No." and "The result? Faster builds." ask a question and answer it at once with a few words and no verb. Once, it adds pace. Repeated, plain statements turn into a staged question and answer, a habit well known in generated text.

     → Merge the question and its answer into one plain sentence ("The result? Faster builds." becomes "The change made builds faster.").

     Relax this rule:  npx chaffjs relax q-fragment-answer


─── line 8 ───────────────────────────────────────────────────

    The result? A full run in 9 minutes.

  ·  Questions answered with a fragment

     "A full run in 9 minutes." and other fragment answers to your own question: 3 (2 needed)
     "Is it perfect? No." and "The result? Faster builds." ask a question and answer it at once with a few words and no verb. Once, it adds pace. Repeated, plain statements turn into a staged question and answer, a habit well known in generated text.

     → Merge the question and its answer into one plain sentence ("The result? Faster builds." becomes "The change made builds faster.").

     Relax this rule:  npx chaffjs relax q-fragment-answer


─── line 10 ──────────────────────────────────────────────────

    Is it perfect? No.

  ·  Questions answered with a fragment

     "No." and other fragment answers to your own question: 3 (2 needed)
     "Is it perfect? No." and "The result? Faster builds." ask a question and answer it at once with a few words and no verb. Once, it adds pace. Repeated, plain statements turn into a staged question and answer, a habit well known in generated text.

     → Merge the question and its answer into one plain sentence ("The result? Faster builds." becomes "The change made builds faster.").

     Relax this rule:  npx chaffjs relax q-fragment-answer


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# We moved our build to a bigger machine

Last month our test suite took 41 minutes on the shared build server.
Most of that time was spent waiting for a free slot.

So we rented one machine of our own with 32 cores, for about 300 dollars a month.
A full run now takes 9 minutes.

The machine is not perfect.
It sits idle at night and at weekends, and we still have to update it ourselves.
For a team of twelve, the time saved pays for it in the first week.
```

## How it was fixed

"The cost? About 300 dollars a month." "The result? A full run in 9 minutes." "Is it perfect? No."
Once, a question and a short answer add pace. Three in a row turn plain facts into a staged dialogue, a habit well known in generated text, and the reader starts to notice the device instead of the numbers.

The fix merges each question into its answer.
The cost joins the sentence about renting the machine, the result becomes a sentence with a verb, and "Is it perfect? No." becomes the plain statement it was.

## Settings

The rule reports once two questions are answered with a fragment; `strict` also reports from two, `relaxed` from three:

```yaml chaff-settings
rules:
  q-fragment-answer: relaxed
```

An answer with a verb ("Feeling stuck? That's normal."), a question followed by another question, and an answer in the next paragraph are not counted. The rule does not run on legal, documentation, academic, literature or speech genres. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score post.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain q-fragment-answer --genre blog/tech

  Questions answered with a fragment   (q-fragment-answer)

  "Is it perfect? No." and "The result? Faster builds." ask a question and answer it at once with a few words and no verb. Once, it adds pace. Repeated, plain statements turn into a staged question and answer, a habit well known in generated text.

  How to fix: Merge the question and its answer into one plain sentence ("The result? Faster builds." becomes "The change made builds faster.").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once 2 questions are answered with a fragment
  → normal   reported once 2 questions are answered with a fragment
    relaxed  reported once 3 questions are answered with a fragment
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax q-fragment-answer --why "reason"
```

[All samples](README.md)
