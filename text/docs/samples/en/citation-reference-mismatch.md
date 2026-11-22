<!-- chaff-sample
rule: citation-reference-mismatch
genre: academic/paper
file: remote-work-paper.md
-->

# Citations and reference list do not match (`citation-reference-mismatch`)

**Where it helps:** papers, theses, literature reviews, research reports. Any text that cites by number or by author and year.

## Original

```markdown chaff-before
# Remote work and meeting load in small teams

## Introduction

Teams that moved to remote work after 2020 reported more meetings, not fewer [1].
Shorter meetings did not reduce the total time spent in them [2].
Asynchronous updates, written and read at each person's own time, have been proposed as a remedy [4].

This study follows six teams of five to nine people over one year.

## References

- [1] Hale, R. Meetings after the office. Journal of Work Studies, 2022.
- [2] Moreno, L. and Price, T. The short meeting paradox. Workplace Review, 2023.
- [3] Abbott, K. Writing instead of talking: asynchronous updates in practice. Team Research, 2024.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre academic/paper remote-work-paper.md

remote-work-paper.md   academic/paper · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    [4].

  ⚠  Citations and reference list do not match

     The citation "[4]" names 4, which is not in the reference list
     When the text cites [5] and the reference list has no entry 5, the reader cannot check the source. An entry the text never cites was either left behind or lost its citation. It happens when references are added or removed and renumbered. A paper that cites by number is compared number by number; one that cites by author and year, by surname and year. When fewer than half of the entries are cited in a form chaff reads (superscript numbers lost in a copy, say), uncited entries are not reported.

     → Check whether the numbers shifted, and correct the citation or the list. Remove an entry that is never cited, or cite it where it belongs.

     Relax this rule:  npx chaffjs relax citation-reference-mismatch


─── line 15 ──────────────────────────────────────────────────

    - [3] Abbott, K. Writing instead of talking: asynchronous updates in practice. T

  ⚠  Citations and reference list do not match

     This entry of the reference list is never cited in the text
     When the text cites [5] and the reference list has no entry 5, the reader cannot check the source. An entry the text never cites was either left behind or lost its citation. It happens when references are added or removed and renumbered. A paper that cites by number is compared number by number; one that cites by author and year, by surname and year. When fewer than half of the entries are cited in a form chaff reads (superscript numbers lost in a copy, say), uncited entries are not reported.

     → Check whether the numbers shifted, and correct the citation or the list. Remove an entry that is never cited, or cite it where it belongs.

     Relax this rule:  npx chaffjs relax citation-reference-mismatch


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Remote work and meeting load in small teams

## Introduction

Teams that moved to remote work after 2020 reported more meetings, not fewer [1].
Shorter meetings did not reduce the total time spent in them [2].
Asynchronous updates, written and read at each person's own time, have been proposed as a remedy [3].

This study follows six teams of five to nine people over one year.

## References

- [1] Hale, R. Meetings after the office. Journal of Work Studies, 2022.
- [2] Moreno, L. and Price, T. The short meeting paradox. Workplace Review, 2023.
- [3] Abbott, K. Writing instead of talking: asynchronous updates in practice. Team Research, 2024.
```

## How it was fixed

The text cited [4], and the list ends at [3]; entry 3, the one on asynchronous updates, was never cited.
An earlier draft had a fourth reference before Abbott's; it was removed and the list renumbered, but the citation in the text kept the old number.
A reviewer who wants to check the claim finds no source, and the one source that supports it looks unused.

The fix cites [3], the entry that matches the sentence.
chaff cannot tell which of the two shifted; the writer checks which work the sentence means and corrects that side.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  citation-reference-mismatch: relaxed
```

Only the academic paper genre runs this rule.
A paper that cites by number is compared number by number, and one that cites by author and year, by surname and year.
A document with no list under a heading such as "References", and a list of one entry, are left alone; when fewer than half of the entries are cited in a form chaff reads, uncited entries are not reported.

```text chaff-explain
$ npx chaffjs explain citation-reference-mismatch --genre academic/paper

  Citations and reference list do not match   (citation-reference-mismatch)

  When the text cites [5] and the reference list has no entry 5, the reader cannot check the source. An entry the text never cites was either left behind or lost its citation. It happens when references are added or removed and renumbered. A paper that cites by number is compared number by number; one that cites by author and year, by surname and year. When fewer than half of the entries are cited in a form chaff reads (superscript numbers lost in a copy, say), uncited entries are not reported.

  How to fix: Check whether the numbers shifted, and correct the citation or the list. Remove an entry that is never cited, or cite it where it belongs.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax citation-reference-mismatch --why "reason"
```

[All samples](README.md)
