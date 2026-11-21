<!-- chaff-sample
rule: sentence-initial-conjunction-run
genre: blog/essay
file: essay.md
-->

# Sentences in a row opening with "And" or "But" (`sentence-initial-conjunction-run`)

**Where it helps:** personal essays, blog posts, newsletters. Writing in a conversational voice, where "And" and "But" come easily.

## Original

```markdown chaff-before
# Why I stopped batch cooking

For two years I spent every Sunday afternoon cooking for the week ahead.
I liked the idea of it more than I liked the food.
By Wednesday the rice was dry and the curry tasted of the fridge.

So last spring I stopped. And I started cooking one simple dinner each evening instead. But I worried it would take too long on work days. And it did, for the first week. But then I found five dishes I could make in twenty minutes without a recipe.

Now Sunday is free again, and I look forward to dinner.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/essay essay.md

essay.md   blog/essay · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    So last spring I stopped. And I started cooking one simple dinner each evening instead. But I worried it would take too …

  ·  Run of sentences opening with a conjunction

     5 sentences in a row open with a conjunction (limit 2)
     One sentence opening with "And" or "But" (そして, しかし) lands. A run of them makes every sentence read as an afterthought. The words are listed in the lexicon.

     → Keep one. Join the others to the previous sentence, or let them stand alone.

     Relax this rule:  npx chaffjs relax sentence-initial-conjunction-run


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Why I stopped batch cooking

For two years I spent every Sunday afternoon cooking for the week ahead.
I liked the idea of it more than I liked the food.
By Wednesday the rice was dry and the curry tasted of the fridge.

So last spring I stopped, and started cooking one simple dinner each evening instead. I worried it would take too long on work days, and for the first week it did. Then I found five dishes I could make in twenty minutes without a recipe.

Now Sunday is free again, and I look forward to dinner.
```

## How it was fixed

Starting a sentence with "And" or "But" is fine English, and one of them gives a turn some weight.
Here five sentences in a row open with "So", "And", "But", "And", "But".
Each one reads like an afterthought tacked on to the last, and the one real turn in the story, finding five quick dishes, sounds no different from the rest.

The fix keeps "So" to open the paragraph, joins the "And" sentences to the ones before them with a comma, and lets the turn begin with "Then".
The paragraph has three sentences now, and the last one lands.

## Settings

At the default level, a run of more than two sentences in a row opening with a conjunction is reported; `strict` reports two and `relaxed` waits for five.
A single sentence opening with "And" or "But" is never reported, and a phrase such as "So far" or "Yet another" is not counted.

```yaml chaff-settings
rules:
  sentence-initial-conjunction-run: relaxed
```

The rule does not run on manuals and help pages, literature, or verbatim transcripts.
Paragraphs, rather than sentences, that open with a connective one after another are a separate rule, `repeated-conjunction`.

```text chaff-explain
$ npx chaffjs explain sentence-initial-conjunction-run --genre blog/essay

  Run of sentences opening with a conjunction   (sentence-initial-conjunction-run)

  One sentence opening with "And" or "But" (そして, しかし) lands. A run of them makes every sentence read as an afterthought. The words are listed in the lexicon.

  How to fix: Keep one. Join the others to the previous sentence, or let them stand alone.

  Levels:
    strict   up to 1 sentences in a row opening with a conjunction
  → normal   up to 2 sentences in a row opening with a conjunction
    relaxed  up to 4 sentences in a row opening with a conjunction
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax sentence-initial-conjunction-run --why "reason"
```

[All samples](README.md)
