<!-- chaff-sample
rule: nominalization
genre: business/report
file: canteen-report.md
-->

# Verbs hidden in nouns (`nominalization`)

**Where it helps:** reports, proposals, policies, project plans. Any text written in the voice of an organisation rather than a person.

## Original

```markdown chaff-before
# Canteen review: summary

In March the facilities team performed a review of the staff canteen.
We carried out an analysis of three months of till receipts and had a discussion with the catering company.
We also gave consideration to the forty comments left in the suggestion box.

The main finding is that the canteen is busy between twelve and one and nearly empty after half past one.
The queue at the hot counter often runs out of the door, while the salad bar is quiet for most of the day.
Many staff said they would eat later if the hot food were still on offer.

The catering company has agreed to keep two hot dishes on until two o'clock from May.
We will make a decision on a second till once we see whether the queue gets shorter.
We will also look again at the price of the lunch deal, which has not changed in three years.

The full figures are in the appendix, broken down by week and by counter.
Please send any questions about the review to the facilities team.
The next review is planned for the autumn, after the new menu has been in place for a full term.
We would like to thank everyone who left a comment or answered our short survey at the tills.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report canteen-report.md

canteen-report.md   business/report · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    In March the facilities team performed a review of the staff canteen.

  ·  Verbs hidden in nouns

     "performed a review" can be "review" (23 hidden verbs per 1000 words, limit 2)
     "Make a decision" says in three words what "decide" says in one. A verb turned into a noun and carried by another verb makes the sentence longer and the action harder to see. The Federal Plain Language Guidelines call these hidden verbs, and GOV.UK asks for the verb; the Japanese guideline for plain Japanese rewrites 調査を実施した as 調査した. One or two are ordinary, so chaff speaks only when they are dense for the document's length.

     → Use the verb: "made a decision" becomes "decided", "conduct an analysis" becomes "analyze".

     Relax this rule:  npx chaffjs relax nominalization


─── line 4 ───────────────────────────────────────────────────

    We carried out an analysis of three months of till receipts and had a discussion with the catering company.

  ·  Verbs hidden in nouns

     "carried out an analysis" can be "analyze" (23 hidden verbs per 1000 words, limit 2)
     "Make a decision" says in three words what "decide" says in one. A verb turned into a noun and carried by another verb makes the sentence longer and the action harder to see. The Federal Plain Language Guidelines call these hidden verbs, and GOV.UK asks for the verb; the Japanese guideline for plain Japanese rewrites 調査を実施した as 調査した. One or two are ordinary, so chaff speaks only when they are dense for the document's length.

     → Use the verb: "made a decision" becomes "decided", "conduct an analysis" becomes "analyze".

     Relax this rule:  npx chaffjs relax nominalization


─── line 4 ───────────────────────────────────────────────────

    We carried out an analysis of three months of till receipts and had a discussion with the catering company.

  ·  Verbs hidden in nouns

     "had a discussion" can be "discuss" (23 hidden verbs per 1000 words, limit 2)
     "Make a decision" says in three words what "decide" says in one. A verb turned into a noun and carried by another verb makes the sentence longer and the action harder to see. The Federal Plain Language Guidelines call these hidden verbs, and GOV.UK asks for the verb; the Japanese guideline for plain Japanese rewrites 調査を実施した as 調査した. One or two are ordinary, so chaff speaks only when they are dense for the document's length.

     → Use the verb: "made a decision" becomes "decided", "conduct an analysis" becomes "analyze".

     Relax this rule:  npx chaffjs relax nominalization


─── line 5 ───────────────────────────────────────────────────

    We also gave consideration to the forty comments left in the suggestion box.

  ·  Verbs hidden in nouns

     "gave consideration to" can be "consider" (23 hidden verbs per 1000 words, limit 2)
     "Make a decision" says in three words what "decide" says in one. A verb turned into a noun and carried by another verb makes the sentence longer and the action harder to see. The Federal Plain Language Guidelines call these hidden verbs, and GOV.UK asks for the verb; the Japanese guideline for plain Japanese rewrites 調査を実施した as 調査した. One or two are ordinary, so chaff speaks only when they are dense for the document's length.

     → Use the verb: "made a decision" becomes "decided", "conduct an analysis" becomes "analyze".

     Relax this rule:  npx chaffjs relax nominalization


─── line 12 ──────────────────────────────────────────────────

    We will make a decision on a second till once we see whether the queue gets shorter.

  ·  Verbs hidden in nouns

     "make a decision" can be "decide" (23 hidden verbs per 1000 words, limit 2)
     "Make a decision" says in three words what "decide" says in one. A verb turned into a noun and carried by another verb makes the sentence longer and the action harder to see. The Federal Plain Language Guidelines call these hidden verbs, and GOV.UK asks for the verb; the Japanese guideline for plain Japanese rewrites 調査を実施した as 調査した. One or two are ordinary, so chaff speaks only when they are dense for the document's length.

     → Use the verb: "made a decision" becomes "decided", "conduct an analysis" becomes "analyze".

     Relax this rule:  npx chaffjs relax nominalization


────────────────────────────────────────────────────────────

  5 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Canteen review: summary

In March the facilities team reviewed the staff canteen.
We analysed three months of till receipts and talked to the catering company.
We also considered the forty comments left in the suggestion box.

The main finding is that the canteen is busy between twelve and one and nearly empty after half past one.
The queue at the hot counter often runs out of the door, while the salad bar is quiet for most of the day.
Many staff said they would eat later if the hot food were still on offer.

The catering company has agreed to keep two hot dishes on until two o'clock from May.
We will decide on a second till once we see whether the queue gets shorter.
We will also look again at the price of the lunch deal, which has not changed in three years.

The full figures are in the appendix, broken down by week and by counter.
Please send any questions about the review to the facilities team.
The next review is planned for the autumn, after the new menu has been in place for a full term.
We would like to thank everyone who left a comment or answered our short survey at the tills.
```

## How it was fixed

"Performed a review", "carried out an analysis", "had a discussion", "gave consideration to", "make a decision": each turns a verb into a noun and then needs a second, empty verb to carry it.
One is ordinary. Five in a short report give it the sound of a form being filled in, and the reader has to dig for what the team actually did.

The fix uses the verbs themselves: reviewed, analysed, talked, considered, decide.
Every sentence got shorter, and the actions are now where the reader looks for them.

## Settings

The rule counts hidden verbs from chaff's list per 1000 words, so a document with one or two is not reported.
At `normal` it allows up to two per 1000 words; `strict` one, `relaxed` four:

```yaml chaff-settings
rules:
  nominalization: relaxed
```

Very short documents are not measured.
It does not run on legal text, where "make a payment" is the register, or on literature.

```text chaff-explain
$ npx chaffjs explain nominalization --genre business/report

  Verbs hidden in nouns   (nominalization)

  "Make a decision" says in three words what "decide" says in one. A verb turned into a noun and carried by another verb makes the sentence longer and the action harder to see. The Federal Plain Language Guidelines call these hidden verbs, and GOV.UK asks for the verb; the Japanese guideline for plain Japanese rewrites 調査を実施した as 調査した. One or two are ordinary, so chaff speaks only when they are dense for the document's length.

  How to fix: Use the verb: "made a decision" becomes "decided", "conduct an analysis" becomes "analyze".

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 1 nominalized verb ("make a decision") per 1000 words
  → normal   up to 2 nominalized verbs ("make a decision") per 1000 words
    relaxed  up to 4 nominalized verbs ("make a decision") per 1000 words
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax nominalization --why "reason"
```

[All samples](README.md)
