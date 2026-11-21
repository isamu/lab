<!-- chaff-sample
rule: padded-intro
genre: blog/tech
file: feature-flags.md
-->

# Padded opening (`padded-intro`)

**Where it helps:** blog posts, reports, proposals. The first sentence decides whether the rest is read.

## Original

```markdown chaff-before
# How we stopped breaking the checkout on Fridays

In recent years, feature flags have gained significant attention.
We started using them for the checkout in January.

Before that, a change to the checkout went to every customer at once.
Twice last year a Friday release broke the payment step, and we found out from customers.

Now every change to the checkout ships behind a flag, turned on for one in ten customers first.
If the error rate rises, we turn the flag off in a few seconds, without a new release.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech feature-flags.md

feature-flags.md   blog/tech · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    In recent years, feature flags have gained significant attention.

  ⚠  Padded opening

     "in recent years" is an opening that fits any article
     An opening that fits any article gives the reader no reason to continue.

     → Start from a concrete situation, or from the claim only this piece makes.

     Relax this rule:  npx chaffjs relax padded-intro


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# How we stopped breaking the checkout on Fridays

Twice last year a Friday release broke our payment step, and we found out from customers.
In January we started shipping every change to the checkout behind a feature flag.

Before that, a change to the checkout went to every customer at once.
Now it goes to one in ten customers first.
If the error rate rises, we turn the flag off in a few seconds, without a new release.
```

## How it was fixed

"In recent years, feature flags have gained significant attention" could open any of a thousand articles.
It tells the reader nothing about this one, and the interesting part, two broken Friday releases, is buried in the second paragraph.

The fix starts from that concrete situation and says straight away what the team did about it.
The general claim about feature flags is gone: the reader came for this team's story, not for the trend.

## Settings

The rule reads only the opening (the first four sentences), so "in recent years" later in the text is not reported.
At `normal` and `strict` one padded opening is enough; `relaxed` waits for two:

```yaml chaff-settings
rules:
  padded-intro: relaxed
```

It runs on blogs, reports and proposals.
It does not run on legal text, manuals, papers, literature or speeches, where a speech's opening greeting is its form.

```text chaff-explain
$ npx chaffjs explain padded-intro --genre blog/tech

  Padded opening   (padded-intro)

  An opening that fits any article gives the reader no reason to continue.

  How to fix: Start from a concrete situation, or from the claim only this piece makes.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once there are 1
  → normal   reported once there are 1
    relaxed  reported once there are 2
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax padded-intro --why "reason"
```

[All samples](README.md)
