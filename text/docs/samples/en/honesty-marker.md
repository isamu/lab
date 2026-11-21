<!-- chaff-sample
rule: honesty-marker
genre: blog/essay
file: post.md
-->

# An honesty marker (`honesty-marker`)

**Where it helps:** personal blog posts, opinion pieces, reviews, business updates.

## Original

```markdown chaff-before
# Why I went back to a paper notebook

For two years I kept my to-do list in an app on my phone.
It synced everywhere, it reminded me of everything, and I stopped reading it.

Last spring I bought a cheap notebook and started writing the day's list by hand each morning.
Honestly, the first week felt slow.
By the third week I was finishing more of the list, because I only wrote down what I could really do that day.

I still use the app for dates and birthdays.
The rest lives on paper now.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/essay post.md

post.md   blog/essay · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    Honestly, the first week felt slow.

  ·  An honesty marker

     "honestly" flags this sentence as candid
     "Honestly,", "if I'm being honest" and "my honest take" flag one sentence as candid, which leaves the reader wondering about the rest. Human blog posts and business documents rarely use them; generated text asked to sound natural often adds one to sound human. One is reported, and that alone does not say the text was generated.

     → Drop the marker and say it plainly ("Honestly, it was hard" → "It was hard").

     Relax this rule:  npx chaffjs relax honesty-marker


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Why I went back to a paper notebook

For two years I kept my to-do list in an app on my phone.
It synced everywhere, it reminded me of everything, and I stopped reading it.

Last spring I bought a cheap notebook and started writing the day's list by hand each morning.
The first week felt slow: copying the list took me ten minutes.
By the third week I was finishing more of the list, because I only wrote down what I could really do that day.

I still use the app for dates and birthdays.
The rest lives on paper now.
```

## How it was fixed

"Honestly, the first week felt slow" marks one sentence as the candid one, and leaves the reader wondering about the others.
It is also what generated text adds when it is asked to sound natural, and in human blog posts it is rare.

The fix drops the marker and adds what made the week slow: copying the list took ten minutes.
A detail like that is what makes a sentence sound honest, without saying so.

## Settings

The rule reports a single honesty marker ("Honestly,", "if I'm being honest", "my honest take"); `relaxed` waits for two:

```yaml chaff-settings
rules:
  honesty-marker: relaxed
```

Only blog posts and business documents are checked. "Honestly" as a manner ("live honestly") is not a marker and is not counted. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score post.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain honesty-marker --genre blog/essay

  An honesty marker   (honesty-marker)

  "Honestly,", "if I'm being honest" and "my honest take" flag one sentence as candid, which leaves the reader wondering about the rest. Human blog posts and business documents rarely use them; generated text asked to sound natural often adds one to sound human. One is reported, and that alone does not say the text was generated.

  How to fix: Drop the marker and say it plainly ("Honestly, it was hard" → "It was hard").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once there are 1
  → normal   reported once there are 1
    relaxed  reported once there are 2
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax honesty-marker --why "reason"
```

[All samples](README.md)
