<!-- chaff-sample
rule: doubled-word
genre: business/report
file: help-desk-march.md
-->

# Word written twice (`doubled-word`)

**Where it helps:** reports, emails, documentation. Text that has been rewritten, especially where a phrase was changed in place.

## Original

```markdown chaff-before
# Help desk, March

The help desk answered 412 requests in March, up from 380 in February.
Most of the rise came from the the new expense system, which went live on 3 March.

We have added a short guide to our the intranet page, and requests about expenses fell in the last week of the month.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report help-desk-march.md

help-desk-march.md   business/report · English   genre from --genre

─── line 4 ───────────────────────────────────────────────────

    Most of the rise came from the the new expense system, which went live on 3 March.

  ⚠  Word written twice

     "the the" doubles a word; one of the two is left over
     The same word twice in a row ("the the"), or two words where English takes one ("our the platform"), is left over from an edit. The reader stumbles, and the document looks rushed. In Japanese, the same particle on both sides of a parenthetical aside (本規約は（以下、規約）は) is left over the same way. Repeats that grammar allows ("had had", "that that", "is, is") and repeats for emphasis ("very very") are not counted.

     → Delete the extra word. If a rewrite was half done ("our the platform"), keep the wording you meant.

     Relax this rule:  npx chaffjs relax doubled-word


─── line 6 ───────────────────────────────────────────────────

    We have added a short guide to our the intranet page, and requests about expenses fell in the last week of the month.

  ⚠  Word written twice

     "our the" doubles a word; one of the two is left over
     The same word twice in a row ("the the"), or two words where English takes one ("our the platform"), is left over from an edit. The reader stumbles, and the document looks rushed. In Japanese, the same particle on both sides of a parenthetical aside (本規約は（以下、規約）は) is left over the same way. Repeats that grammar allows ("had had", "that that", "is, is") and repeats for emphasis ("very very") are not counted.

     → Delete the extra word. If a rewrite was half done ("our the platform"), keep the wording you meant.

     Relax this rule:  npx chaffjs relax doubled-word


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Help desk, March

The help desk answered 412 requests in March, up from 380 in February.
Most of the rise came from the new expense system, which went live on 3 March.

We have added a short guide to our intranet page, and requests about expenses fell in the last week of the month.
```

## How it was fixed

"The the" is a word typed twice, and the eye skips over it on a reread because it expects a word there.
"Our the intranet page" is a rewrite left half done: the sentence once said "the intranet page", then someone typed "our" and did not delete "the".

The fix deletes the extra word.
For the half-done rewrite, it keeps the wording that was meant, "our intranet page".

## Settings

At `normal` a finding is a warning; `strict` makes it an error and `relaxed` a note.
None of them changes what is found, only how loudly it is marked.

Repeats that grammar allows ("had had", "that that") and repeats for emphasis ("very very") are not reported.

```yaml chaff-settings
rules:
  doubled-word: relaxed
```

The rule does not run on fiction, poetry, plays or speech transcripts, where a repeat may be the voice.

```text chaff-explain
$ npx chaffjs explain doubled-word --genre business/report

  Word written twice   (doubled-word)

  The same word twice in a row ("the the"), or two words where English takes one ("our the platform"), is left over from an edit. The reader stumbles, and the document looks rushed. In Japanese, the same particle on both sides of a parenthetical aside (本規約は（以下、規約）は) is left over the same way. Repeats that grammar allows ("had had", "that that", "is, is") and repeats for emphasis ("very very") are not counted.

  How to fix: Delete the extra word. If a rewrite was half done ("our the platform"), keep the wording you meant.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax doubled-word --why "reason"
```

[All samples](README.md)
