<!-- chaff-sample
rule: doubled-nado
genre: business/email
file: offsite-email.md
-->

# "And so on" said twice (`doubled-nado`)

**Where it helps:** emails, packing lists, notices. Any list that ends with "etc."

## Original

```markdown chaff-before
Subject: Packing for the team offsite

Hi all,

The coach leaves the office at 8:30 on Wednesday.
Please bring your laptop, charger, a warm coat and etc.
The venue is a farm, and the workshop room is a converted barn.

Lunch and dinner are provided. If you have a dietary need, reply to this email by Friday.

See you there,
Sam
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email offsite-email.md

offsite-email.md   business/email · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    Please bring your laptop, charger, a warm coat and etc.

  ⚠  "And so on" said twice

     "and etc." says "and so on" twice
     "Etc." is et cetera, "and the rest", so "and etc." says "and" twice; in Japanese, など and 等 both mean "and so on", and 書類等など doubles them. Either adds nothing and reads as a slip. The pairs are listed in the lexicon.

     → Keep one of the two ("and etc." → "etc.", 書類等など → 書類など).

     Relax this rule:  npx chaffjs relax doubled-nado


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Packing for the team offsite

Hi all,

The coach leaves the office at 8:30 on Wednesday.
Please bring your laptop, charger, a warm coat, etc.
The venue is a farm, and the workshop room is a converted barn.

Lunch and dinner are provided. If you have a dietary need, reply to this email by Friday.

See you there,
Sam
```

## How it was fixed

"Etc." is short for et cetera, "and the rest", so "and etc." says "and" twice.
Readers notice it, and a friendly email about an offsite reads as dashed off.

The fix drops the extra "and" and puts a comma before "etc.", the way the rest of the list is written.
The items in the list stay exactly as they were.

## Settings

At `strict` and `normal` the first one is reported; `relaxed` waits until there are 2.

Only the pairs on chaff's list are checked.
When words come between the two ("such as pens, paper, etc."), chaff cannot read them as one phrase and does not report them.

```yaml chaff-settings
rules:
  doubled-nado: relaxed
```

The same rule catches 等 and など written together in Japanese documents.

```text chaff-explain
$ npx chaffjs explain doubled-nado --genre business/email

  "And so on" said twice   (doubled-nado)

  "Etc." is et cetera, "and the rest", so "and etc." says "and" twice; in Japanese, など and 等 both mean "and so on", and 書類等など doubles them. Either adds nothing and reads as a slip. The pairs are listed in the lexicon.

  How to fix: Keep one of the two ("and etc." → "etc.", 書類等など → 書類など).

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once there is 1
  → normal   reported once there is 1
    relaxed  reported once there are 2
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax doubled-nado --why "reason"
```

[All samples](README.md)
