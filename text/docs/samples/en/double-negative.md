<!-- chaff-sample
rule: double-negative
genre: business/report
file: survey.md
-->

# Double negative (`double-negative`)

**Where it helps:** reports, reviews, findings. Anywhere a writer wants to sound careful and ends up sounding vague.

## Original

```markdown chaff-before
# Review of the spring customer survey

We sent the survey to 4,000 customers in April and 1,150 replied.

Late deliveries were the most common complaint, and it was not uncommon for a customer to mention the same late order in two different answers.
Complaints about the new app were not unlike those we heard after the website redesign two years ago: people could not find their order history.
The price rise in March was not insignificant either; about one reply in five named it.

We propose to fix the order history page first, since it is the cheapest change and the one most customers asked for.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report survey.md

survey.md   business/report · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    Late deliveries were the most common complaint, and it was not uncommon for a customer to mention the same late order in…

  ·  Double negative

     "not uncommon" is a double negative
     Negating a negative ("not uncommon", "not unlike") makes the reader turn the sentence over twice, and blurs which way the writer leans. If the claim holds, say it positively; if it only partly holds, say how far. "not without" is not counted, since "do not enter without a badge" is a plain prohibition. The phrases are listed in each language's lexicon.

     → Say it positively ("common", "similar to"), or say how far it holds ("in about a third of cases").

     Relax this rule:  npx chaffjs relax double-negative


─── line 6 ───────────────────────────────────────────────────

    Complaints about the new app were not unlike those we heard after the website redesign two years ago: people could not f…

  ·  Double negative

     "not unlike" is a double negative
     Negating a negative ("not uncommon", "not unlike") makes the reader turn the sentence over twice, and blurs which way the writer leans. If the claim holds, say it positively; if it only partly holds, say how far. "not without" is not counted, since "do not enter without a badge" is a plain prohibition. The phrases are listed in each language's lexicon.

     → Say it positively ("common", "similar to"), or say how far it holds ("in about a third of cases").

     Relax this rule:  npx chaffjs relax double-negative


─── line 7 ───────────────────────────────────────────────────

    The price rise in March was not insignificant either; about one reply in five named it.

  ·  Double negative

     "not insignificant" is a double negative
     Negating a negative ("not uncommon", "not unlike") makes the reader turn the sentence over twice, and blurs which way the writer leans. If the claim holds, say it positively; if it only partly holds, say how far. "not without" is not counted, since "do not enter without a badge" is a plain prohibition. The phrases are listed in each language's lexicon.

     → Say it positively ("common", "similar to"), or say how far it holds ("in about a third of cases").

     Relax this rule:  npx chaffjs relax double-negative


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Review of the spring customer survey

We sent the survey to 4,000 customers in April and 1,150 replied.

Late deliveries were the most common complaint, and many customers mentioned the same late order in two different answers.
Complaints about the new app were much like those we heard after the website redesign two years ago: people could not find their order history.
The price rise in March also mattered; about one reply in five named it.

We propose to fix the order history page first, since it is the cheapest change and the one most customers asked for.
```

## How it was fixed

"Not uncommon", "not unlike" and "not insignificant" each make the reader undo two negatives to find the meaning, and even then they do not say how far the claim goes.
Is "not uncommon" one customer in ten, or half of them? The reader of a survey review wants exactly that answer.

The fix says each one positively: "many customers", "much like", "also mattered".
Where the report has a figure, as it does for the price rise, the figure does the work, so "one reply in five" now carries the sentence on its own.
If you know the number for the late orders too, put it in; that is better still.

## Settings

The phrases come from a list in chaff's English word lists. "Not without" is not on it, since "do not enter without a badge" is a plain prohibition.
At the default level the first sentence with one is reported; `relaxed` waits until two sentences have one.

```yaml chaff-settings
rules:
  double-negative: relaxed
```

The rule does not run on legal documents, where "not inconsistent with" is written on purpose, on literature, or on speeches.

```text chaff-explain
$ npx chaffjs explain double-negative --genre business/report

  Double negative   (double-negative)

  Negating a negative ("not uncommon", "not unlike") makes the reader turn the sentence over twice, and blurs which way the writer leans. If the claim holds, say it positively; if it only partly holds, say how far. "not without" is not counted, since "do not enter without a badge" is a plain prohibition. The phrases are listed in each language's lexicon.

  How to fix: Say it positively ("common", "similar to"), or say how far it holds ("in about a third of cases").

  Levels:
    strict   reported once 1 sentence holds one
  → normal   reported once 1 sentence holds one
    relaxed  reported once 2 sentences hold one
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax double-negative --why "reason"
```

[All samples](README.md)
