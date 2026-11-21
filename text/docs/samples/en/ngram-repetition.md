<!-- chaff-sample
rule: ngram-repetition
genre: business/proposal
file: proposal.md
-->

# Repeated phrasing (`ngram-repetition`)

**Where it helps:** proposals, pitches, business cases. Documents that try to win an argument by repeating the selling point.

## Original

```markdown chaff-before
# Proposal: a single booking page for all clinics

Today each of our four clinics takes bookings in its own way: two by phone, one by email and one through an old web form.

We propose one booking page for all four clinics. Patients choose a clinic, a type of visit and a time, and get a confirmation by text. This will improve the patient experience. Reception staff see every booking in one calendar, which will also improve the patient experience, because fewer calls go unanswered at busy times.

Last year 14 percent of patients who called could not get through at the first try. A booking page that works at any hour would improve the patient experience for them in particular. It would also let us send a reminder the day before, which will improve the patient experience and cut missed visits.

The page costs 18,000 euros to build and 400 euros a month to run. We think the money is well spent, since it will improve the patient experience at every clinic. Staff time saved on the phone pays for the running cost within the first year, and the change will improve the patient experience from the first week.

Some older patients prefer to book by phone, so each clinic will keep one phone line open in the morning. We will also print a short guide to the new page for the waiting rooms, and ask reception staff to show it to anyone who asks. After three months we will compare missed visits and unanswered calls with the same months last year.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal proposal.md

proposal.md   business/proposal · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    This will improve the patient experience.

  ·  Repeated phrasing

     "improve the patient" appears 6 times (limit 5)
     The same phrasing again and again reads as nothing new being said. Counted on runs of whole words in English and of characters in Japanese. Bracketed tags, link text and symbols that a listing repeats on every entry are not the writer's phrasing, and are not counted.

     → Rephrase the repeats, or say it once. If what repeats is an organisation or product name, list it under names in chaff.yaml and it is not counted.

     Relax this rule:  npx chaffjs relax ngram-repetition


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Proposal: a single booking page for all clinics

Today each of our four clinics takes bookings in its own way: two by phone, one by email and one through an old web form.

We propose one booking page for all four clinics. Patients choose a clinic, a type of visit and a time, and get a confirmation by text, without waiting on the phone. Reception staff see every booking in one calendar, so fewer calls go unanswered at busy times.

Last year 14 percent of patients who called could not get through at the first try. A booking page that works at any hour would let them book in the evening, when the phones are closed. It would also let us send a reminder the day before, which cuts missed visits.

The page costs 18,000 euros to build and 400 euros a month to run. Staff time saved on the phone pays for the running cost within the first year.

Some older patients prefer to book by phone, so each clinic will keep one phone line open in the morning. We will also print a short guide to the new page for the waiting rooms, and ask reception staff to show it to anyone who asks. After three months we will compare missed visits and unanswered calls with the same months last year.
```

## How it was fixed

"Improve the patient experience" appears six times, after nearly every fact in the proposal. chaff names it by its first words, "improve the patient", and points at the first time it appears.
The writer meant it as the thread that ties the case together, but by the third time a reader skims past it, and it hides the concrete gains that actually make the case: no waiting on the phone, booking in the evening, fewer missed visits.

The fix deletes the phrase where it adds nothing ("This will improve the patient experience.", "We think the money is well spent") and, where it stood in for a real benefit, says the benefit instead.
The proposal is shorter, and each sentence now gives a reason a manager can weigh.

## Settings

chaff counts repeated runs of words (in Japanese, of characters) across the document, and reports the most repeated phrase when it appears more than five times; `strict` reports it from four and `relaxed` from ten.
Documents under 200 words are not measured. Names of organisations or products, terms the document defines, and phrases in its title and headings are not counted, nor are labels and tags that a listing repeats on every entry.
If what repeats is your organisation's or a product's name, list it under `names` and it is not counted:

```yaml chaff-settings
names:
  - Riverside Clinics
```

To allow more repetition, relax the rule:

```yaml chaff-settings
rules:
  ngram-repetition: relaxed
```

The rule does not run on contracts and statutes, which repeat their terms on purpose, on glossaries, on literature, or on verbatim transcripts.

```text chaff-explain
$ npx chaffjs explain ngram-repetition --genre business/proposal

  Repeated phrasing   (ngram-repetition)

  The same phrasing again and again reads as nothing new being said. Counted on runs of whole words in English and of characters in Japanese. Bracketed tags, link text and symbols that a listing repeats on every entry are not the writer's phrasing, and are not counted.

  How to fix: Rephrase the repeats, or say it once. If what repeats is an organisation or product name, list it under names in chaff.yaml and it is not counted.

  Levels:
    strict   up to 3 uses of the same phrase
  → normal   up to 5 uses of the same phrase
    relaxed  up to 9 uses of the same phrase
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax ngram-repetition --why "reason"
```

[All samples](README.md)
