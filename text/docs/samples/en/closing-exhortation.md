<!-- chaff-sample
rule: closing-exhortation
genre: blog/tech
file: post.md
-->

# A closing that cheers the reader on (`closing-exhortation`)

**Where it helps:** blog posts, how-to articles, newsletters. Especially the last line of a draft written to a prompt.

## Original

```markdown chaff-before
# Growing tomatoes on a balcony

This summer I grew tomatoes in two large pots on a north-facing balcony.
I expected very little, since the balcony gets sun only in the afternoon.

The cherry variety did well: about forty tomatoes from one plant between July and September.
The larger variety flowered but set only six fruit, and three of them split after a week of rain.

The thing that helped most was watering in the evening instead of the morning, so the soil stayed damp through the hot afternoons.

Start with one pot this spring. You won't regret it. You've got this!
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech post.md

post.md   blog/tech · English   genre from --genre

─── line 11 ──────────────────────────────────────────────────

    You won't regret it.

  ·  A closing that cheers the reader on

     "you won't regret it" and other cheering lines close the text: 2 (2 needed)
     "Give it a try, you'll be glad you did", "You've got this", "Happy baking!" end a post by cheering the reader on instead of saying something. One is ordinary; several in the closing read like the stock ending of generated text.

     → Drop the cheering and name the one thing from the text you want the reader to take away.

     Relax this rule:  npx chaffjs relax closing-exhortation


─── line 11 ──────────────────────────────────────────────────

    You've got this!

  ·  A closing that cheers the reader on

     "you've got this" and other cheering lines close the text: 2 (2 needed)
     "Give it a try, you'll be glad you did", "You've got this", "Happy baking!" end a post by cheering the reader on instead of saying something. One is ordinary; several in the closing read like the stock ending of generated text.

     → Drop the cheering and name the one thing from the text you want the reader to take away.

     Relax this rule:  npx chaffjs relax closing-exhortation


────────────────────────────────────────────────────────────

  2 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Growing tomatoes on a balcony

This summer I grew tomatoes in two large pots on a north-facing balcony.
I expected very little, since the balcony gets sun only in the afternoon.

The cherry variety did well: about forty tomatoes from one plant between July and September.
The larger variety flowered but set only six fruit, and three of them split after a week of rain.

The thing that helped most was watering in the evening instead of the morning, so the soil stayed damp through the hot afternoons.

If your balcony gets half a day of sun, start with a cherry variety. Next year I will grow only those.
```

## How it was fixed

The post is about one balcony and one summer: forty cherry tomatoes, six large ones, watering in the evening.
Then it ends with "You won't regret it. You've got this!", which could end any post on any subject.
One cheering line is ordinary. Two together in the closing are the stock ending of generated text, and the reader leaves with nothing from this post in particular.

The corrected closing names the one thing a reader with a similar balcony can act on: start with a cherry variety.
The writer's own plan for next year says the same thing more convincingly than the cheering did.

## Settings

The rule reports once two closing sentences cheer the reader on. `strict` reports a single one, `relaxed` waits for three:

```yaml chaff-settings
rules:
  closing-exhortation: strict
```

Cheering in the middle of a text is not counted. The rule does not run on legal, documentation, literature or speech genres. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score post.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain closing-exhortation --genre blog/tech

  A closing that cheers the reader on   (closing-exhortation)

  "Give it a try, you'll be glad you did", "You've got this", "Happy baking!" end a post by cheering the reader on instead of saying something. One is ordinary; several in the closing read like the stock ending of generated text.

  How to fix: Drop the cheering and name the one thing from the text you want the reader to take away.

  Levels:
    strict   reported once 1 closing sentence cheers the reader on
  → normal   reported once 2 closing sentences cheer the reader on
    relaxed  reported once 3 closing sentences cheer the reader on
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax closing-exhortation --why "reason"
```

[All samples](README.md)
