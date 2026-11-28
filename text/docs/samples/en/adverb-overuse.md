<!-- chaff-sample
rule: adverb-overuse
genre: blog/owned-media
file: article.md
-->

# Too many -ly adverbs (`adverb-overuse`)

**Where it helps:** community newsletters, company blog posts, stories about people. Writing that wants the reader to see a scene.

## Original

```markdown chaff-before
# A morning at the repair café

On the first Saturday of the month, the community hall quietly fills with broken things.
People carefully carry in toasters, lamps and jackets with stuck zips, and volunteers patiently take them apart on long tables at the back of the hall.
Nobody pays, and nothing is thrown away until someone has had a proper look at it.

Last month a woman slowly walked in with a radio her father had bought in 1974.
It had stopped working completely after a move, and the shop in town had told her it was not worth fixing.
Tom, who repaired radios for forty years before he retired, gently opened the back, then quickly found a loose wire.
Twenty minutes later the radio was loudly playing the news again, and she was happily telling everyone at the table about her father and the kitchen where it used to stand.

Not every repair ends that way.
Some things need a part we do not have, and some were built so that they cannot be opened without breaking them.
When that happens, the volunteers honestly say so and explain what went wrong, so that the owner knows what to look for next time.

The café runs from ten until one, and anyone can come.
Bring the thing that is broken, and if you can, the cable or charger that goes with it.
Tea and cake are free, and the volunteers are always glad of an extra pair of hands.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/owned-media article.md

article.md   blog/owned-media · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    On the first Saturday of the month, the community hall quietly fills with broken things.

  ·  Too many -ly adverbs

     37 -ly adverbs per 1000 words (limit 15)
     An -ly adverb usually marks a weak verb. "Hurried" is shorter and sharper than "walked quickly".

     → Fold the adverb into the verb. "Said loudly" becomes "shouted".

     Relax this rule:  npx chaffjs relax adverb-overuse


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# A morning at the repair café

On the first Saturday of the month, the community hall fills with broken things.
People bring in toasters, lamps and jackets with stuck zips, and volunteers take them apart on long tables at the back of the hall.
Nobody pays, and nothing is thrown away until someone has had a proper look at it.

Last month a woman came in with a radio her father had bought in 1974.
It had gone silent after a move, and the shop in town had told her it was not worth fixing.
Tom, who repaired radios for forty years before he retired, eased off the back and within a minute found a loose wire.
Twenty minutes later the radio was blaring the news again, and she was telling everyone at the table about her father and the kitchen where it used to stand.

Not every repair ends that way.
Some things need a part we do not have, and some were built so that they cannot be opened without breaking them.
When that happens, the volunteers say so and explain what went wrong, so that the owner knows what to look for next time.

The café runs from ten until one, and anyone can come.
Bring the thing that is broken, and if you can, the cable or charger that goes with it.
Tea and cake are free, and the volunteers are always glad of an extra pair of hands.
```

## How it was fixed

Nearly every verb in the first half comes with an -ly adverb: quietly fills, carefully carry, patiently take, slowly walked, gently opened, quickly found, loudly playing, happily telling.
chaff counts 37 of them per 1000 words, more than twice the limit of 15.
Each one is harmless, but together they slow the story down and tell the reader how to feel instead of showing what happened.
Some say nothing a reader would not assume: of course volunteers who repair things are patient.

The fix drops the adverbs that add nothing, and folds the others into a stronger verb or a fact: "stopped working completely" became "gone silent", "gently opened" became "eased off", "quickly found" became "within a minute found", "loudly playing" became "blaring".
The woman's happiness no longer needs saying; the reader sees it in her telling everyone about her father.

## Settings

The rule counts -ly adverbs per 1000 words, and reports a document above 15; `strict` reports one above 10 and `relaxed` one above 25.
Documents under 200 words are not measured.
Adverbs that say how sure or frank the writer is (probably, apparently, honestly) are not counted, since there is no verb to fold them into, and neither is a capitalised -ly word such as July.

```yaml chaff-settings
rules:
  adverb-overuse: relaxed
```

The rule runs only on English. It does not run on contracts and statutes, manuals and help pages, academic papers, literature, or verbatim transcripts.

```text chaff-explain
$ npx chaffjs explain adverb-overuse --genre blog/owned-media

  Too many -ly adverbs   (adverb-overuse)

  An -ly adverb usually marks a weak verb. "Hurried" is shorter and sharper than "walked quickly".

  How to fix: Fold the adverb into the verb. "Said loudly" becomes "shouted".

  Levels:
    strict   up to 10 -ly adverbs per 1000 words
  → normal   up to 15 -ly adverbs per 1000 words
    relaxed  up to 25 -ly adverbs per 1000 words
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax adverb-overuse --why "reason"
```

[All samples](README.md)
