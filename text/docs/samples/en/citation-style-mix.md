<!-- chaff-sample
rule: citation-style-mix
genre: academic/paper
file: paper.md
-->

# Citations written in more than one style (`citation-style-mix`)

**Where it helps:** papers, theses, literature reviews. Especially a manuscript with several authors, or one that reuses a section from an earlier paper.

## Original

```markdown chaff-before
# Walking to school in three market towns

## Background

Children who walk to school arrive more alert than those driven (Hart, 2019).
The share who walk has fallen in most towns over the last twenty years (Moss and Lee, 2021).
Distance is the main reason parents give, but traffic on the last stretch matters nearly as much [3].
Towns that closed the street outside the school at drop-off time saw more children walk (Okafor, 2022).

## References

Hart, J. (2019). Arriving ready to learn. Journal of School Health Studies, 12, 40–51.

Moss, A. and Lee, K. (2021). Twenty years of the school run. Transport and Society, 8, 101–118.

Patel, R. (2020). Why parents drive. Urban Family Review, 5, 22–30.

Okafor, N. (2022). School streets in practice. Local Transport Quarterly, 3, 7–19.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre academic/paper paper.md

paper.md   academic/paper · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    [3].

  ·  Citations written in more than one style

     The citation "[3]" is written differently from the paper's other citations ("(Hart, 2019)" and others, 3 in all)
     When one paper cites as [1] in some places and as (Smith, 2020) in others, the reader cannot tell which way to look up the reference list. It happens when text is moved from another manuscript, or when a co-author adds citations in their own style. chaff tells apart numbers in square brackets ([1]), numbers in tortoise-shell brackets (〔1〕), a number with a closing parenthesis after Japanese text (…である1)。), author and year ((Smith, 2020), Smith et al. (2020)) and footnotes whose note gives a year ([^1]), and points at the few citations that differ from the most common style. Which style is right is not decided.

     → Rewrite it in the style most citations use. If that style is numbered, give the reference its number in the list too.

     Relax this rule:  npx chaffjs relax citation-style-mix


─── line 16 ──────────────────────────────────────────────────

    Patel, R. (2020). Why parents drive. Urban Family Review, 5, 22–30.

  ⚠  Citations and reference list do not match

     This entry of the reference list is never cited in the text
     When the text cites [5] and the reference list has no entry 5, the reader cannot check the source. An entry the text never cites was either left behind or lost its citation. It happens when references are added or removed and renumbered. A paper that cites by number is compared number by number; one that cites by author and year, by surname and year. When fewer than half of the entries are cited in a form chaff reads (superscript numbers lost in a copy, say), uncited entries are not reported.

     → Check whether the numbers shifted, and correct the citation or the list. Remove an entry that is never cited, or cite it where it belongs.

     Relax this rule:  npx chaffjs relax citation-reference-mismatch


────────────────────────────────────────────────────────────

  1 warning, 1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Walking to school in three market towns

## Background

Children who walk to school arrive more alert than those driven (Hart, 2019).
The share who walk has fallen in most towns over the last twenty years (Moss and Lee, 2021).
Distance is the main reason parents give, but traffic on the last stretch matters nearly as much (Patel, 2020).
Towns that closed the street outside the school at drop-off time saw more children walk (Okafor, 2022).

## References

Hart, J. (2019). Arriving ready to learn. Journal of School Health Studies, 12, 40–51.

Moss, A. and Lee, K. (2021). Twenty years of the school run. Transport and Society, 8, 101–118.

Patel, R. (2020). Why parents drive. Urban Family Review, 5, 22–30.

Okafor, N. (2022). School streets in practice. Local Transport Quarterly, 3, 7–19.
```

## How it was fixed

The background cites by author and year, except for one sentence that cites "[3]".
That sentence came from a co-author's draft written for a journal with numbered references.
The reference list here is by author, so the reader has no third entry to look up and cannot tell which paper is meant.
chaff sees the other side of the same slip too: `citation-reference-mismatch` warns that Patel's paper is in the list but never cited.

The fix cites it as "(Patel, 2020)", the style of the rest of the paper.
chaff does not decide which style is right. In a paper numbered throughout, an author-and-year citation would be the one pointed at.

## Settings

Only the academic paper genre runs this rule.
At `normal`, the rarer style is reported when it appears twice or fewer; `strict` allows three, `relaxed` one.
Above that, the paper is taken to mix styles on purpose.
Citations inside the reference list and numbers at the start of a line (a numbered list) are not counted.

To stop checking:

```yaml chaff-settings
rules:
  citation-style-mix: off
```

```text chaff-explain
$ npx chaffjs explain citation-style-mix --genre academic/paper

  Citations written in more than one style   (citation-style-mix)

  When one paper cites as [1] in some places and as (Smith, 2020) in others, the reader cannot tell which way to look up the reference list. It happens when text is moved from another manuscript, or when a co-author adds citations in their own style. chaff tells apart numbers in square brackets ([1]), numbers in tortoise-shell brackets (〔1〕), a number with a closing parenthesis after Japanese text (…である1)。), author and year ((Smith, 2020), Smith et al. (2020)) and footnotes whose note gives a year ([^1]), and points at the few citations that differ from the most common style. Which style is right is not decided.

  How to fix: Rewrite it in the style most citations use. If that style is numbered, give the reference its number in the list too.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported when the minority style appears 3 times or fewer
  → normal   reported when the minority style appears 2 times or fewer
    relaxed  reported when the minority style appears 1 times or fewer
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax citation-style-mix --why "reason"
```

[All samples](README.md)
