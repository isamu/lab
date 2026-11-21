<!-- chaff-sample
rule: bold-label-list
genre: blog/owned-media
file: expenses.md
-->

# Too many list items led by a bold label (`bold-label-list`)

**Where it helps:** release notes, internal announcements, product pages. Anywhere a list of changes is shown to people who will use them.

## Original

```markdown chaff-before
# What changed in the new expense tool

From 1 February, all expenses go through the new expense tool instead of the spreadsheet.

- **Receipts**: you take a photo of the receipt and the tool reads the amount and the date.
- **Approval**: your manager approves from their phone, and you see when they have.
- **Mileage**: you enter the start and end of the trip, and the tool works out the distance.
- **Currency**: amounts in other currencies are converted at the rate on the day of the receipt.
- **Payment**: approved expenses are paid with the next monthly salary.

The spreadsheet stays open for claims from January until 15 February.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/owned-media expenses.md

expenses.md   blog/owned-media · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    - **Receipts**: you take a photo of the receipt and the tool reads the amount and the date.

  ·  Too many list items led by a bold label

     "Receipts" and other bold labels open 5 list items (5 needed)
     An item that opens with a bold label and a colon ("- **Speed**: ..."), or with a bold lead sentence ("- **Information gets out of date.** ..."), item after item. The labels make every item look like a heading of equal weight, and the links between the items go unwritten. Paragraphs that each open with a bold statement ("**Usage grew each week**: ...") are the same shape. A shape common in generated text.

     → Drop the labels and write the items as sentences. If only one or two items matter, give them a paragraph and cut or merge the rest. A real glossary, where each label is the term being defined, can stay.

     Relax this rule:  npx chaffjs relax bold-label-list


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# What changed in the new expense tool

From 1 February, all expenses go through the new expense tool instead of the spreadsheet.

You take a photo of each receipt, and the tool reads the amount and the date, converting other currencies at the rate on the day of the receipt.
For a trip by car, enter where it started and ended, and the tool works out the distance.
Your manager approves from their phone, and the tool shows you when they have.
Approved expenses are paid with the next monthly salary, as before.

The spreadsheet stays open for claims from January until 15 February.
```

## How it was fixed

Each item opens with a bold label and a colon: Receipts, Approval, Mileage, Currency, Payment.
The labels make five changes look equally important and leave the reader to work out how they fit together; the conversion of currencies belongs with the receipts, and approval comes before payment.

The corrected announcement says the same five things in four sentences, in the order an employee meets them: photograph the receipt, enter a car trip, wait for approval, get paid.
Nothing was dropped. A list with bold labels still makes sense for a glossary, where each label is the term being defined.

## Settings

The rule counts list items that open with a bold label and a colon, or with a bold lead sentence. It reports from five such items; `strict` reports from three and `relaxed` from eight:

```yaml chaff-settings
rules:
  bold-label-list: relaxed
```

An item whose label is only code (a list of options), and the long items of a handbook's tips, are not counted. The rule does not run on legal, documentation, academic, literature, meeting notes or transcripts.

```text chaff-explain
$ npx chaffjs explain bold-label-list --genre blog/owned-media

  Too many list items led by a bold label   (bold-label-list)

  An item that opens with a bold label and a colon ("- **Speed**: ..."), or with a bold lead sentence ("- **Information gets out of date.** ..."), item after item. The labels make every item look like a heading of equal weight, and the links between the items go unwritten. Paragraphs that each open with a bold statement ("**Usage grew each week**: ...") are the same shape. A shape common in generated text.

  How to fix: Drop the labels and write the items as sentences. If only one or two items matter, give them a paragraph and cut or merge the rest. A real glossary, where each label is the term being defined, can stay.

  Rewrite depth: structure (sections, headings and paragraphs are reorganised). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once 3 list items open with a bold label (items opening with a bold lead sentence from min_leads, paragraphs opening with a bold statement from min_clause_paragraphs)
  → normal   reported once 5 list items open with a bold label (items opening with a bold lead sentence from min_leads, paragraphs opening with a bold statement from min_clause_paragraphs)
    relaxed  reported once 8 list items open with a bold label (items opening with a bold lead sentence from min_leads, paragraphs opening with a bold statement from min_clause_paragraphs)
    off      not checked

  Options (set under options in chaff.yaml):
    min_leads: 3   (default)
      How many items opening with a bold lead sentence (- **Lock your ranges.** ...) report on their own. Human documents may give three or four steps or fields a bold label, but rarely make a list of bold lead sentences. A label that states a gain (- **More timely:** ..., opening with a word of the benefit-label lexicon) is a claim, not the name of a step or a field, and counts with them
    min_clause_paragraphs: 3   (default)
      How many paragraphs opening with a bold statement (a clause with its own subject and verb, **Usage grew each week**: ...) report on their own. A whole English instruction closed by its own stop (**Pick the quietest room you can.** ...) counts too. A human run-in head is a term (**Work schedule**:), an imperative closed by a colon (**Talk to the people:**), a gerund (**Examining the risks.**) or a question (**Who is my audience?**), none of which count. Without part-of-speech tags, paragraphs are not counted

  Set one:  write options: { bold-label-list: { <name>: <value> } } in chaff.yaml

  Now: normal.

  Change it:  npx chaffjs relax bold-label-list --why "reason"
```

[All samples](README.md)
