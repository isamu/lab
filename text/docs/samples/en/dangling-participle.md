<!-- chaff-sample
rule: dangling-participle
genre: business/report
file: survey.md
-->

# Dangling participle (`dangling-participle`)

**Where it helps:** reports, reviews, audit notes, findings. Anywhere a sentence should say who looked at something and what they found.

## Original

```markdown chaff-before
# Staff travel survey: results

The survey ran from 2 to 16 June, and 214 people answered it.

Having compared the answers with last year's, it is clear that fewer people drive to the office.
Looking at the comments, there is a strong wish for a covered bike shelter.

We will put both points to the facilities committee in July.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report survey.md

survey.md   business/report · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    Having compared the answers with last year's, it is clear that fewer people drive to the office.

  ·  Dangling participle

     "Having compared the answers with last year's" has no one to attach to; the subject is an empty "it"
     A sentence that opens with a participle phrase ("Having reviewed the code, …") is read as if the subject did that action. When the subject is an empty "it" or "there" ("Having reviewed the code, it is ready."), the sentence never says who reviewed the code, and the reader has to supply it. Only an opening "-ing" phrase followed by "it" or "there" and a form of "be" is reported.

     → Make whoever did the action the subject ("Having reviewed the code, we consider it ready."), or turn the phrase into a clause ("After we reviewed the code, it was ready.").

     Relax this rule:  npx chaffjs relax dangling-participle


─── line 6 ───────────────────────────────────────────────────

    Looking at the comments, there is a strong wish for a covered bike shelter.

  ·  Dangling participle

     "Looking at the comments" has no one to attach to; the subject is an empty "there"
     A sentence that opens with a participle phrase ("Having reviewed the code, …") is read as if the subject did that action. When the subject is an empty "it" or "there" ("Having reviewed the code, it is ready."), the sentence never says who reviewed the code, and the reader has to supply it. Only an opening "-ing" phrase followed by "it" or "there" and a form of "be" is reported.

     → Make whoever did the action the subject ("Having reviewed the code, we consider it ready."), or turn the phrase into a clause ("After we reviewed the code, it was ready.").

     Relax this rule:  npx chaffjs relax dangling-participle


────────────────────────────────────────────────────────────

  2 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Staff travel survey: results

The survey ran from 2 to 16 June, and 214 people answered it.

Having compared the answers with last year's, we found that fewer people drive to the office.
Reading the comments, we saw that many people want a covered bike shelter.

We will put both points to the facilities committee in July.
```

## How it was fixed

"Having compared the answers, it is clear…" opens with an action and then hands the sentence to an empty "it".
Grammatically, nobody did the comparing; the reader has to work out that the writers mean themselves.
The same happens with "Looking at the comments, there is…".

The fix gives each opening phrase a subject that did the action: "we found", "we saw".
The sentences now say who looked and what they concluded, which is what a results section is for.

## Settings

The rule reports an opening "-ing" phrase followed by an empty "it" or "there" and a form of "be".
It is a note at `normal` and `relaxed`, and a warning at `strict`:

```yaml chaff-settings
rules:
  dangling-participle: strict
```

It reads English only, and does not run on literature or speech transcripts.
A sentence whose subject is a person or a thing ("Having reviewed the code, the team approved it") and fixed openings such as "Given", "Based on" and "Having said that" are not reported.

```text chaff-explain
$ npx chaffjs explain dangling-participle --genre business/report

  Dangling participle   (dangling-participle)

  A sentence that opens with a participle phrase ("Having reviewed the code, …") is read as if the subject did that action. When the subject is an empty "it" or "there" ("Having reviewed the code, it is ready."), the sentence never says who reviewed the code, and the reader has to supply it. Only an opening "-ing" phrase followed by "it" or "there" and a form of "be" is reported.

  How to fix: Make whoever did the action the subject ("Having reviewed the code, we consider it ready."), or turn the phrase into a clause ("After we reviewed the code, it was ready.").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax dangling-participle --why "reason"
```

[All samples](README.md)
