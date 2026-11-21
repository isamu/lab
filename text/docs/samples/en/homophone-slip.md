<!-- chaff-sample
rule: homophone-slip
genre: business/email
file: kitchen-rota.md
-->

# Homophone typed for another (its / it's, their / there) (`homophone-slip`)

**Where it helps:** emails, notices, posts. A spell checker passes both words, so the slip survives to the reader.

## Original

```markdown chaff-before
Subject: Kitchen rota from next week

Hi all,

From Monday, each team will look after the kitchen for one week at a time.
There are five teams, so your turn comes round about once a month.
We could of started this sooner, but the new dishwasher only arrived last week.

The dishwasher runs on it's own after 6 pm, so please load it before you leave.

Thanks,
Office team
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email kitchen-rota.md

kitchen-rota.md   business/email · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    We could of started this sooner, but the new dishwasher only arrived last week.

  ⚠  Homophone typed for another (its / it's, their / there)

     "could of" has one homophone typed for another
     "Its" and "it's", "their", "there" and "they're" sound alike, and a spell checker passes either. chaff looks only at pairs where the next word settles which was meant: "it's own" can only be "its own", "their are" can only be "there are". Pairs the next word does not settle ("its time", "they're people") are not checked. The pairs are listed in the lexicon.

     → Use the word you meant ("it's own" → "its own", "their are" → "there are", "could of" → "could have").

     Relax this rule:  npx chaffjs relax homophone-slip


─── line 9 ───────────────────────────────────────────────────

    The dishwasher runs on it's own after 6 pm, so please load it before you leave.

  ⚠  Homophone typed for another (its / it's, their / there)

     "it's own" has one homophone typed for another
     "Its" and "it's", "their", "there" and "they're" sound alike, and a spell checker passes either. chaff looks only at pairs where the next word settles which was meant: "it's own" can only be "its own", "their are" can only be "there are". Pairs the next word does not settle ("its time", "they're people") are not checked. The pairs are listed in the lexicon.

     → Use the word you meant ("it's own" → "its own", "their are" → "there are", "could of" → "could have").

     Relax this rule:  npx chaffjs relax homophone-slip


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Kitchen rota from next week

Hi all,

From Monday, each team will look after the kitchen for one week at a time.
There are five teams, so your turn comes round about once a month.
We could have started this sooner, but the new dishwasher only arrived last week.

The dishwasher runs on its own after 6 pm, so please load it before you leave.

Thanks,
Office team
```

## How it was fixed

"Could of" and "it's own" are spelled correctly, word by word, so a spell checker lets them through.
They are the sound of the right words, "could've" and "its", written down.
Most readers know which was meant, and many of them think less of the email for it.

chaff reports a pair only when the next word settles which one was meant: "it's own" can only be "its own".
The fix writes "could have" and "its own", and changes nothing else.

## Settings

At `strict` and `normal` the first one is reported; `relaxed` waits until there are 2.

Only the pairs on chaff's list are checked.
Pairs that the next word does not settle ("its time", "they're people") are not.

```yaml chaff-settings
rules:
  homophone-slip: relaxed
```

The rule does not run on fiction, poetry, plays or speeches, where "would of" may be a character's voice.

```text chaff-explain
$ npx chaffjs explain homophone-slip --genre business/email

  Homophone typed for another (its / it's, their / there)   (homophone-slip)

  "Its" and "it's", "their", "there" and "they're" sound alike, and a spell checker passes either. chaff looks only at pairs where the next word settles which was meant: "it's own" can only be "its own", "their are" can only be "there are". Pairs the next word does not settle ("its time", "they're people") are not checked. The pairs are listed in the lexicon.

  How to fix: Use the word you meant ("it's own" → "its own", "their are" → "there are", "could of" → "could have").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once there are 1
  → normal   reported once there are 1
    relaxed  reported once there are 2
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax homophone-slip --why "reason"
```

[All samples](README.md)
