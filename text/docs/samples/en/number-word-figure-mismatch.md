<!-- chaff-sample
rule: number-word-figure-mismatch
genre: legal/contract
file: agreement.md
-->

# Number in words differs from its figure (`number-word-figure-mismatch`)

**Where it helps:** contracts, leases, loan agreements, formal letters. Anywhere a number is written twice, in words and in figures.

## Original

```markdown chaff-before
# Consulting Agreement

## 3. Fees

3.1 The Client shall pay the Consultant a fixed fee of Twelve Thousand Dollars ($12,000) for the Services.

3.2 The Consultant shall invoice the fee in two equal parts, one on signing and one on delivery of the final report.

3.3 The Client shall pay each invoice within thirty (30) days of receiving it.

## 4. Term

4.1 Either party may end this Agreement by giving the other party fourteen (40) days' written notice.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract agreement.md

agreement.md   legal/contract · English   genre from --genre

─── line 13 ──────────────────────────────────────────────────

    ing the other party fourteen (40) days' written notic

  ⚠  Number in words differs from its figure

     "fourteen (40)" says 14 in words and 40 in figures
     Contracts and formal documents write a number twice, in words and in figures ("thirty (30) days", "Fifty Thousand Dollars ($50,000)"), so that it cannot be misread or altered. When the two disagree ("thirty (13) days", "Fifty Thousand Dollars ($5,000)"), the document does not say which one holds, and the difference becomes a dispute. It happens when one of the two is edited, or when a template's figures are replaced and its words are not. The number words (forty-five, one hundred and five, Fifty Thousand; Japanese numerals, formal ones such as 壱 弐 参 拾 萬 included) are read as a number and compared with the figure in the brackets right after them.

     → Check which number is meant, and make the words and the figure say the same number.

     Relax this rule:  npx chaffjs relax number-word-figure-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Consulting Agreement

## 3. Fees

3.1 The Client shall pay the Consultant a fixed fee of Twelve Thousand Dollars ($12,000) for the Services.

3.2 The Consultant shall invoice the fee in two equal parts, one on signing and one on delivery of the final report.

3.3 The Client shall pay each invoice within thirty (30) days of receiving it.

## 4. Term

4.1 Either party may end this Agreement by giving the other party fourteen (14) days' written notice.
```

## How it was fixed

The notice period is written "fourteen (40) days": two weeks in words, nearly six in figures.
A contract writes a number twice so that it cannot be misread, and when the two disagree it no longer says which one holds.
If the client gives notice and expects the work to stop in two weeks, while the consultant reads forty days, the difference becomes a dispute.

Both parties agreed on two weeks' notice, so the fix makes the figure match the words: "fourteen (14) days".
A clause like this is usually copied from a template whose figures were changed and whose words were not, or the other way round; checking every pair is a job for a machine.

## Settings

The rule is a warning at `normal` and `relaxed`, and an error at `strict`:

```yaml chaff-settings
rules:
  number-word-figure-mismatch: strict
```

Number words (forty-five, one hundred and five, Fifty Thousand) are read as a number and compared with the figure in the brackets right after them.
A bracket holding anything but a figure ("(Section 6)"), a number word inside another word, words that are not one well-formed number, a year in brackets ("two (2026)"), cheque-style amounts and fractions are not read.
The rule runs in every genre.

```text chaff-explain
$ npx chaffjs explain number-word-figure-mismatch --genre legal/contract

  Number in words differs from its figure   (number-word-figure-mismatch)

  Contracts and formal documents write a number twice, in words and in figures ("thirty (30) days", "Fifty Thousand Dollars ($50,000)"), so that it cannot be misread or altered. When the two disagree ("thirty (13) days", "Fifty Thousand Dollars ($5,000)"), the document does not say which one holds, and the difference becomes a dispute. It happens when one of the two is edited, or when a template's figures are replaced and its words are not. The number words (forty-five, one hundred and five, Fifty Thousand; Japanese numerals, formal ones such as 壱 弐 参 拾 萬 included) are read as a number and compared with the figure in the brackets right after them.

  How to fix: Check which number is meant, and make the words and the figure say the same number.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax number-word-figure-mismatch --why "reason"
```

[All samples](README.md)
