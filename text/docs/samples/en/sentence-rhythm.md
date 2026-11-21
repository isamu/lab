<!-- chaff-sample
rule: sentence-rhythm
genre: blog/tech
file: guide.md
-->

# Monotonous sentence rhythm (`sentence-rhythm`)

**Where it helps:** how-to guides, help articles, blog posts.

## Original

```markdown chaff-before
# Setting up two-step sign-in

This guide shows you how to turn on two-step sign-in for your account.
First you open the account page from the menu at the top.
Then you choose the security tab on the left side.

Next you press the button that says turn on two-step sign-in.
The page then shows a code that you scan with your phone.
Your phone app then shows a six-digit number for the account.

You type that number into the box on the page.
Finally you save the backup codes in a safe place.
Now your account asks for a code each time you sign in.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech guide.md

guide.md   blog/tech · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    This guide shows you how to turn on two-step sign-in for your account.

  ⚠  Monotonous sentence rhythm

     Sentence length varies by only 13% (want 30%)
     When every sentence is the same length, the reader loses the rhythm. It is also a common shape of generated text.

     → Mix in short sentences. Splitting one in two is enough.

     Relax this rule:  npx chaffjs relax sentence-rhythm


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Setting up two-step sign-in

This guide shows you how to turn on two-step sign-in for your account.
Open the account page from the menu at the top and choose the security tab.
Press "Turn on two-step sign-in".
The page shows a code; scan it with the authenticator app on your phone, and the app shows a six-digit number for the account.
Type that number into the box.

Then save the backup codes somewhere safe, away from your phone.
If you lose the phone, they are the only way back into the account.
From now on, the account asks for a code each time you sign in.
```

## How it was fixed

Every sentence in the guide is about ten words long, and most of them open with "First", "Then", "Next" or "Finally".
At the same length, sentence after sentence, the reader loses the rhythm, and the one step that matters most (saving the backup codes) reads exactly like pressing a button.

The corrected guide mixes lengths: the step that presses the button is short, the scanning step runs as one longer sentence, and the backup codes get a sentence that says why they matter.
Splitting or joining a few sentences is usually enough.

## Settings

The rule measures how much sentence lengths vary. It reports when they vary by less than 30%; `strict` asks for 35% and `relaxed` only for 20%:

```yaml chaff-settings
rules:
  sentence-rhythm: relaxed
```

List items are not counted, since a list is written alike on purpose, and prose of fewer than eight sentences is not measured. The rule does not run on legal, documentation, academic, literature or speech genres. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score guide.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain sentence-rhythm --genre blog/tech

  Monotonous sentence rhythm   (sentence-rhythm)

  When every sentence is the same length, the reader loses the rhythm. It is also a common shape of generated text.

  How to fix: Mix in short sentences. Splitting one in two is enough.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported when sentence length varies by less than 35%
  → normal   reported when sentence length varies by less than 30%
    relaxed  reported when sentence length varies by less than 20%
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax sentence-rhythm --why "reason"
```

[All samples](README.md)
