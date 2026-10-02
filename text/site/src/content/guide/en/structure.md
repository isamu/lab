# Structure and quotations

chaff reads a numbered document, such as a contract or a specification, as a tree of addresses.
As a tree, breaks like a reference to a section that is not there, or a skipped number, can be checked by machine.
The same tree checks whether the passages an AI quotes are really in the source.

## Seeing a document as a tree

`tree` prints every address, with what sits at each. Plain `.txt` is read as well as Markdown, because contracts often come as text without headings.

| Command | What happens |
| --- | --- |
| `npx chaffjs tree <file>` | Prints the tree as an S-expression, for people and AIs to read |
| `npx chaffjs tree <file> --format json` | Prints the same tree as JSON, for programs |
| `npx chaffjs tree <file> --language ja` | Reads the file as that language, ahead of `chaff.yaml` and the guess from its content |

On a contract it prints:

```
$ npx chaffjs tree contract.txt
(doc :language "en" :path "contract.txt" :line 1
  (definition :term "the Client" :line 3)
  (definition :term "the Supplier" :line 3)
  (article "1" :heading "Purpose" :label "Section 1" :line 5
    (reference :label "Section 3" :numbering "section" :target "3" :line 6))
  (article "2" :heading "Definitions" :label "Section 2" :line 8
    (definition :term "Deliverables" :line 9))
  (article "3" :heading "Services" :label "Section 3" :line 11
    (obligation :marker "shall" :type "must" :line 12)
    (item "3.a" :label "(a)" :line 13)
    (item "3.b" :label "(b)" :line 14)
    (item "3.c" :label "(c)" :line 15))
  (article "4" :heading "Fees" :label "Section 4" :line 17
    (article "4.1" :heading "The Client shall pay a fee of $50,000." :label "4.1" :line 18
      (obligation :marker "shall" :type "must" :line 18)
      (quantity :unit "$" :value 50000 :line 18))
    (article "4.2" :heading "The Client shall pay within 30 days of accepting the Deliverables." :label "4.2" :line 19
      (obligation :marker "shall" :type "must" :line 19)
      (quantity :unit "days" :value 30 :line 19))
    (article "4.3" :heading "A late payment bears interest of 3% a year." :label "4.3" :line 20
      (quantity :unit "%" :value 3 :line 20)))
  (article "5" :heading "Subcontracting" :label "Section 5" :line 22
    (obligation :marker "must not" :type "must-not" :line 23))
  (article "6" :heading "Term" :label "Section 6" :line 25
    (date :value "2024-04-01" :line 26)
    (date :value "2025-03-31" :line 26)
    (article "6.2" :heading "Either party may renew it for 1 year by giving 3 months' notice." :label "6.2" :line 27
      (obligation :marker "may" :type "may" :line 27)
      (quantity :unit "year" :value 1 :line 27)
      (quantity :unit "months" :value 3 :line 27)))
  (article "7" :heading "Termination" :label "Section 7" :line 29
    (obligation :marker "may" :type "may" :line 30)
    (reference :label "Section 4.2" :numbering "section" :target "4.2" :line 30)
    (reference :label "Section 5" :numbering "section" :target "5" :line 30)))
```

`article` is a section and `item` a subsection or a lettered item. Inside them are definitions (`definition`), references (`reference`),
obligations (`obligation`), quantities (`quantity`) and dates (`date`).
`:line` is the line in the source.

## Reading an address

An address is the numbers joined by dots. The number as written stays in `:label`.

| As written | Address |
| --- | --- |
| Section 4.2(a) | `4.2.a` |
| 第3条第2項 (a Japanese article and paragraph) | `3.2` |
| A heading with no number ("Installation") | The headings counted from the top, as in `h1.2.1` |

A reference carries an address of the same shape: "Section 4.2" above is `:target "4.2"`.
So what a reference points at can be looked up in the tree.

## Finding structural breaks

These rules read the tree.

| Rule | What it finds |
| --- | --- |
| `dangling-reference` | A reference to a section that is not in the document |
| `numbering-gap` | A number skipped or repeated (Section 5 after Section 3, two subsections (2)) |
| `duplicate-definition` | The same term defined twice |

All three are experimental, so add `--experimental` or turn them on in `chaff.yaml`.
This is a short contract, `contract.txt`, after some sections were deleted.

```
SERVICES AGREEMENT

Section 1 Purpose
This Agreement covers the services described in Section 3.

Section 4 Fees
4.1 The Client shall pay a fee of $50,000.
4.2 The Client shall pay within 30 days of accepting the Deliverables.

Section 7 Termination
The Client may terminate this Agreement if the Supplier breaches Section 9.
```

```
$ npx chaffjs contract.txt --experimental --compact

contract.txt   blog/tech · English   genre from the default
   Looks like: Contract and terms. Try --genre legal/contract

  4:49    error   "Section 3" (address 3) is not in this document
                  dangling-reference
  6:1     error   "Section 4" follows "Section 1" (expected number 2)
                  numbering-gap
  10:1    error   "Section 7" follows "Section 4" (expected number 5)
                  numbering-gap
  11:66   error   "Section 9" (address 9) is not in this document
                  dangling-reference

4 findings, 22 rules not run
```

The line under the first one suggests checking it as a contract.
`legal/contract` turns these three rules on, so `npx chaffjs contract.txt --genre legal/contract` reports the same four without `--experimental`.

A reference into another document, such as "section 9 of the Companies Act 2006", is not looked up here.
Numbers are compared only among siblings under the same parent.
`duplicate-definition` does not decide whether the two definitions disagree.

A contract taken out of a PDF often has its numbered lines indented too deep, or run into the text.
Sometimes the text shows many clause numbers but the tree read almost none.
Then the three rules are listed as not run, with both counts, instead of reporting nothing.

## A worked example: tidying an amendment to an Act

You can try it on a real Act. Sections 30 to 32 of the Arbitration Act 1996 are copied here,
with two mistakes of the kind made while drafting an amendment:

- Subsection (2) of section 31 was deleted, so the subsections run (1), (3), (4), (5).
- In section 31(5), "section 32" was mistyped as "section 35".

`draft.txt` reads:

```
Section 30 Competence of tribunal to rule on its own jurisdiction.
(1) Unless otherwise agreed by the parties, the arbitral tribunal may rule on its own substantive jurisdiction, that is, as to—
(a) whether there is a valid arbitration agreement,
(b) whether the tribunal is properly constituted, and
(c) what matters have been submitted to arbitration in accordance with the arbitration agreement.
(2) Any such ruling may be challenged by any available arbitral process of appeal or review or in accordance with the provisions of this Part.

Section 31 Objection to substantive jurisdiction of tribunal.
(1) An objection that the arbitral tribunal lacks substantive jurisdiction at the outset of the proceedings must be raised by a party not later than the time he takes the first step in the proceedings to contest the merits of any matter in relation to which he challenges the tribunal’s jurisdiction.
(3) The arbitral tribunal may admit an objection later than the time specified in subsection (1) or (2) if it considers the delay justified.
(4) Where an objection is duly taken to the tribunal’s substantive jurisdiction and the tribunal has power to rule on its own jurisdiction, it may—
(a) rule on the matter in an award as to jurisdiction, or
(b) deal with the objection in its award on the merits.
(5) The tribunal may in any case, and shall if the parties so agree, stay proceedings whilst an application is made to the court under section 35 (determination of preliminary point of jurisdiction).

Section 32 Determination of preliminary point of jurisdiction.
(1) The court may, on the application of a party to arbitral proceedings (upon notice to the other parties), determine any question as to the substantive jurisdiction of the tribunal.
(1A) An application under this section must not be considered to the extent that it is in respect of a question on which the tribunal has already ruled.
(2) An application under this section shall not be considered unless—
(a) it is made with the agreement in writing of all the other parties to the proceedings, or
(b) it is made with the permission of the tribunal...
(3) ................................
(4) Unless otherwise agreed by the parties, the arbitral tribunal may continue the arbitral proceedings and make an award while an application to the court under this section is pending.
(5) Unless the court gives leave, no appeal lies from a decision of the court whether either condition specified in subsection (2) is met.
(6) The decision of the court on the question of jurisdiction shall be treated as a judgment of the court for the purposes of an appeal.
```

The structure rules are experimental, so run with `--experimental`.

```
$ npx chaffjs draft.txt --experimental --compact

draft.txt   blog/tech · English   genre from the default

  2:1     warning This sentence runs 51 words (limit 25)
                  max-sentence-length
  9:1     warning This sentence runs 51 words (limit 25)
                  max-sentence-length
  10:1    error   "(3)" follows "(1)" (expected number 2)
                  numbering-gap
  11:1    warning This sentence runs 48 words (limit 25)
                  max-sentence-length
  14:1    warning This sentence runs 33 words (limit 25)
                  max-sentence-length
  14:136  error   "section 35" (address 35) is not in this document
                  dangling-reference
  16:1    warning This paragraph runs 8 sentences (limit 5)
                  max-paragraph-length
  17:1    warning This sentence runs 30 words (limit 25)
                  max-sentence-length
  18:1    warning This sentence runs 28 words (limit 25)
                  max-sentence-length
  19:1    warning This sentence runs 39 words (limit 25)
                  max-sentence-length
  23:1    warning This sentence runs 30 words (limit 25)
                  max-sentence-length
  25:1    warning This sentence runs 26 words (limit 25)
                  max-sentence-length

12 findings, 22 rules not run
```

The two `error` lines come from the two changes.
Line 10 is the skipped subsection, and line 14 is the reference to a section that is not there.
The `warning` lines are about readability; long sentences are normal in legislation.
To check only the structure of an Act, read the `error` lines.

Run it as a statute, with `--genre legal/statute`, and the limits are a statute's: only the two `error` lines are left.
`legal/statute` turns on the same structure rules as `legal/contract`, so `--experimental` is not needed.

Undo the two changes and run `fixed.txt`: the `error` lines are gone.

```
$ npx chaffjs fixed.txt --experimental --compact

fixed.txt   blog/tech · English   genre from the default

  2:1     warning This sentence runs 51 words (limit 25)
                  max-sentence-length
  8:1     warning This paragraph runs 6 sentences (limit 5)
                  max-paragraph-length
  9:1     warning This sentence runs 51 words (limit 25)
                  max-sentence-length
  10:1    warning This sentence runs 37 words (limit 25)
                  max-sentence-length
  12:1    warning This sentence runs 48 words (limit 25)
                  max-sentence-length
  15:1    warning This sentence runs 33 words (limit 25)
                  max-sentence-length
  17:1    warning This paragraph runs 8 sentences (limit 5)
                  max-paragraph-length
  18:1    warning This sentence runs 30 words (limit 25)
                  max-sentence-length
  19:1    warning This sentence runs 28 words (limit 25)
                  max-sentence-length
  20:1    warning This sentence runs 39 words (limit 25)
                  max-sentence-length
  24:1    warning This sentence runs 30 words (limit 25)
                  max-sentence-length
  26:1    warning This sentence runs 26 words (limit 25)
                  max-sentence-length

12 findings, 22 rules not run
```

An Act in force should have no such breaks.
The chaff repository runs the structure rules over the full text of three UK Acts and four Japanese statutes.
A test checks that none of them gets a finding, and `yarn corpus` does the same measurement locally.

In English, chaff reads the other members of a list ("sections 44 and 45") and inserted subsections ("(1A)").
It does not yet read a reference to a subsection without its section ("subsection (1)").

The extract is from the Arbitration Act 1996 (legislation.gov.uk) and contains public sector information licensed under the Open Government Licence v3.0.

## Checking an answer's quotations

When an AI reads a document and answers, it quotes: "Section 4.2 says this".
`cite` checks that each quotation really is at that address in the source.

```bash
npx chaffjs cite contract.txt claims.json
```

The quotations are a JSON array of pairs: an address (`address`) and the quoted text (`quote`).

```json
[{ "address": "4.2", "quote": "within 30 days of accepting" }]
```

Spaces and line breaks are ignored, and characters are compared after NFKC normalisation.
So a quotation that differs only in spacing, or in full-width digits, still matches.

```
$ npx chaffjs cite contract.txt claims.json
✓ 4.2 "within 30 days of accepting": matches
```

A quotation with a changed number, or one taken from somewhere else, fails.
When it is somewhere else, you are told the real address.

```
$ npx chaffjs cite contract.txt claims.json
✗ 4.2 "within 60 days of accepting": the quotation is nowhere in the source
✗ 7 "shall pay a fee of $50,000": the quotation is not at 7 but at 4.1 (line 18)
```

If any quotation fails, the run ends with exit code `1`,
so an answer's quotations can be checked like a unit test.

## What chaff does, and what it does not

chaff only decides whether something is broken. It never rewrites the document.
Reading the document and answering is the AI's side; chaff checks before and after.
