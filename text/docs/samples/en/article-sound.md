<!-- chaff-sample
rule: article-sound
genre: docs/manual
file: add-staff.md
-->

# "a" or "an" against the next sound (`article-sound`)

**Where it helps:** how-to pages, manuals, help articles. Anywhere a sentence was edited and its noun changed but its article did not.

## Original

```markdown chaff-before
# Adding a new staff member

1. Open the admin page and choose **People**.
2. Select **Add person** and enter the name and work email.
3. Give the person a role. A editor can change pages; a viewer can only read them.
4. Select **Send invite**. The new person gets an email with a one-time link and has an hour to use it.

If the link runs out, send a new invite. It takes about an minute to arrive.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual add-staff.md

add-staff.md   docs/manual · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    A editor can change pages; a viewer can only read them.

  ·  "a" or "an" against the next sound

     "A editor" takes "An" before that sound
     "A" and "an" follow the sound of the next word, not its spelling ("a user", "an hour", "an MBA"). A slip trips the reader. Words whose spelling and sound disagree, capitals read letter by letter or as a word ("an MBA", "a NASA probe"), and words said both ways ("a SQL", "an SQL") are listed in the lexicon.

     → Use "an" before a vowel sound and "a" before a consonant sound.

     Relax this rule:  npx chaffjs relax article-sound


─── line 8 ───────────────────────────────────────────────────

    It takes about an minute to arrive.

  ·  "a" or "an" against the next sound

     "an minute" takes "a" before that sound
     "A" and "an" follow the sound of the next word, not its spelling ("a user", "an hour", "an MBA"). A slip trips the reader. Words whose spelling and sound disagree, capitals read letter by letter or as a word ("an MBA", "a NASA probe"), and words said both ways ("a SQL", "an SQL") are listed in the lexicon.

     → Use "an" before a vowel sound and "a" before a consonant sound.

     Relax this rule:  npx chaffjs relax article-sound


────────────────────────────────────────────────────────────

  2 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Adding a new staff member

1. Open the admin page and choose **People**.
2. Select **Add person** and enter the name and work email.
3. Give the person a role. An editor can change pages; a viewer can only read them.
4. Select **Send invite**. The new person gets an email with a one-time link and has an hour to use it.

If the link runs out, send a new invite. It takes about a minute to arrive.
```

## How it was fixed

"A editor" and "an minute" are both left over from an edit: the role was once "a member", and the wait was once "an hour".
The noun changed and the article in front of it stayed.
Read aloud, both trip the tongue, and in a set of steps that is the moment a reader stops trusting the page.

The fix changes only the article, to match the sound of the next word: "an editor", "a minute".
"An hour" in step 4 was already right, because "hour" starts with a vowel sound; chaff goes by sound, not spelling, so it is not reported.

## Settings

At `strict` and `normal` the first one is reported; `relaxed` waits until there are 2.

Words whose spelling and sound disagree ("an hour", "a user"), capitals read letter by letter ("an MBA") and words said both ways ("a SQL" or "an SQL") are in chaff's lexicon, so they are read as they are said.
A number ("a 8-hour day") is not read.

```yaml chaff-settings
rules:
  article-sound: relaxed
```

The rule does not run on fiction, poetry, plays or speeches, where "an hospital" may be the author's choice.

```text chaff-explain
$ npx chaffjs explain article-sound --genre docs/manual

  "a" or "an" against the next sound   (article-sound)

  "A" and "an" follow the sound of the next word, not its spelling ("a user", "an hour", "an MBA"). A slip trips the reader. Words whose spelling and sound disagree, capitals read letter by letter or as a word ("an MBA", "a NASA probe"), and words said both ways ("a SQL", "an SQL") are listed in the lexicon.

  How to fix: Use "an" before a vowel sound and "a" before a consonant sound.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once there are 1
  → normal   reported once there are 1
    relaxed  reported once there are 2
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax article-sound --why "reason"
```

[All samples](README.md)
