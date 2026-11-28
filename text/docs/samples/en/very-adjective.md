<!-- chaff-sample
rule: very-adjective
genre: blog/tech
file: new-editor.md
-->

# Too many "very" + adjective (`very-adjective`)

**Where it helps:** blog posts, reviews, reports, product updates. Anywhere a writer wants the reader to feel how good or bad something is.

## Original

```markdown chaff-before
# A month with the new editor

We moved the whole documentation team to the new editor at the start of October.
After a month, here is what we found.

The new editor is very quick. Opening our largest guide, about four hundred pages, used to take a while, and now the first page is on screen almost at once.
Search across the whole guide is very useful too, because we can find every place a product name appears before a release.

The comment threads are very good. A reviewer can leave a note on one sentence, and the writer sees it beside the text instead of in a separate email.
Track changes works the way it did in the old editor, so nobody had to learn it again.

The one weak point is printing. The page breaks are very different from the old editor's, and two of our printed checklists now split a table across pages.
We have reported it, and for now we print those two from the old editor.

Overall, the team would not go back.
Writers spend less time waiting, and reviewers spend less time explaining where their comments belong.
We will look again at printing once the next update is out, and write a short follow-up then.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech new-editor.md

new-editor.md   blog/tech · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    The new editor is very quick.

  ·  Too many "very" + adjective

     "very quick" and other "very" + adjective: 19.5 per 1000 words (limit 3)
     "Very important" and "very good" (とても便利, 非常に危険) lean on "very" where a stronger word (critical, excellent), or saying what and how much, would do. One or two are ordinary; many for the length make every "very" weightless. The intensifiers, and set phrases not counted such as "the very first" and "very few", are listed in the lexicon.

     → Use a stronger word, or say what and how much ("very important" → "critical", "very fast" → "under a second"; とても速い → 1 秒以内に開く).

     Relax this rule:  npx chaffjs relax very-adjective


─── line 7 ───────────────────────────────────────────────────

    Search across the whole guide is very useful too, because we can find every place a product name appears before a releas…

  ·  Too many "very" + adjective

     "very useful" and other "very" + adjective: 19.5 per 1000 words (limit 3)
     "Very important" and "very good" (とても便利, 非常に危険) lean on "very" where a stronger word (critical, excellent), or saying what and how much, would do. One or two are ordinary; many for the length make every "very" weightless. The intensifiers, and set phrases not counted such as "the very first" and "very few", are listed in the lexicon.

     → Use a stronger word, or say what and how much ("very important" → "critical", "very fast" → "under a second"; とても速い → 1 秒以内に開く).

     Relax this rule:  npx chaffjs relax very-adjective


─── line 9 ───────────────────────────────────────────────────

    The comment threads are very good.

  ·  Too many "very" + adjective

     "very good" and other "very" + adjective: 19.5 per 1000 words (limit 3)
     "Very important" and "very good" (とても便利, 非常に危険) lean on "very" where a stronger word (critical, excellent), or saying what and how much, would do. One or two are ordinary; many for the length make every "very" weightless. The intensifiers, and set phrases not counted such as "the very first" and "very few", are listed in the lexicon.

     → Use a stronger word, or say what and how much ("very important" → "critical", "very fast" → "under a second"; とても速い → 1 秒以内に開く).

     Relax this rule:  npx chaffjs relax very-adjective


─── line 12 ──────────────────────────────────────────────────

    The page breaks are very different from the old editor's, and two of our printed checklists now split a table across pag…

  ·  Too many "very" + adjective

     "very different" and other "very" + adjective: 19.5 per 1000 words (limit 3)
     "Very important" and "very good" (とても便利, 非常に危険) lean on "very" where a stronger word (critical, excellent), or saying what and how much, would do. One or two are ordinary; many for the length make every "very" weightless. The intensifiers, and set phrases not counted such as "the very first" and "very few", are listed in the lexicon.

     → Use a stronger word, or say what and how much ("very important" → "critical", "very fast" → "under a second"; とても速い → 1 秒以内に開く).

     Relax this rule:  npx chaffjs relax very-adjective


────────────────────────────────────────────────────────────

  4 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# A month with the new editor

We moved the whole documentation team to the new editor at the start of October.
After a month, here is what we found.

The new editor opens our largest guide, about four hundred pages, in under two seconds; the old one took nearly a minute.
Search across the whole guide helps too, because we can find every place a product name appears before a release.

The comment threads are the change writers like most. A reviewer can leave a note on one sentence, and the writer sees it beside the text instead of in a separate email.
Track changes works the way it did in the old editor, so nobody had to learn it again.

The one weak point is printing. The page breaks fall in different places from the old editor's, and two of our printed checklists now split a table across pages.
We have reported it, and for now we print those two from the old editor.

Overall, the team would not go back.
Writers spend less time waiting, and reviewers spend less time explaining where their comments belong.
We will look again at printing once the next update is out, and write a short follow-up then.
```

## How it was fixed

"Very quick", "very useful", "very good", "very different": four in one short post.
Each "very" asks the reader to take the writer's word for it, and by the third one the word has stopped carrying any weight.

The fix replaces each with what was meant.
"Very quick" becomes the figures, under two seconds against nearly a minute.
"Very good" becomes what the team actually thinks of the comment threads, and "very different" becomes what is different: where the page breaks fall.
Where the sentence already said why ("search … helps, because …"), dropping "very" was enough.

## Settings

The rule counts "very" before an adjective, per 1000 words.
At `normal` it allows up to three per 1000 words; `strict` one and `relaxed` four:

```yaml chaff-settings
rules:
  very-adjective: relaxed
```

"Very well", "the very first", "very few" and "very much" are not counted, and short documents are not measured.
It does not run on literature or speech, where dialogue leans on "very".

```text chaff-explain
$ npx chaffjs explain very-adjective --genre blog/tech

  Too many "very" + adjective   (very-adjective)

  "Very important" and "very good" (とても便利, 非常に危険) lean on "very" where a stronger word (critical, excellent), or saying what and how much, would do. One or two are ordinary; many for the length make every "very" weightless. The intensifiers, and set phrases not counted such as "the very first" and "very few", are listed in the lexicon.

  How to fix: Use a stronger word, or say what and how much ("very important" → "critical", "very fast" → "under a second"; とても速い → 1 秒以内に開く).

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 1 "very" + adjective per 1000 words
  → normal   up to 3 "very" + adjective per 1000 words
    relaxed  up to 4 "very" + adjective per 1000 words
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax very-adjective --why "reason"
```

[All samples](README.md)
