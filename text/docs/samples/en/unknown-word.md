<!-- chaff-sample
rule: unknown-word
genre: business/email
file: supplier-visit.md
-->

# Word not in the dictionary (`unknown-word`)

**Where it helps:** emails, notes, reports. Typos that no list of common misspellings could know in advance.

## Original

```markdown chaff-before
Subject: Notes from the supplier visit

Hi Chris,

Thanks for joining the visit yesterday. The notes are attched, along with the photos of the loading bay.

The supplier can increse the weekly order from next month if we confirm by Friday.

Best,
Mia
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email supplier-visit.md

supplier-visit.md   business/email · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    attched, along with the photos of the loading bay.

  ·  Word not in the dictionary

     "attched" is not in the dictionary; did you mean "attached"?
     An English word that is not in the dictionary but is one letter away from a word that is ("attched" and "attached") is usually a typo. chaff looks words up in the English adapter's dictionary (a word list built from wink-lexicon and WordNet), after taking off endings (-ed, -ing) and prefixes (un-, re-). Words with a capital letter (names, acronyms), words in code and URLs, words used twice or more in the document (usually its own terms), and words with no dictionary word one letter away are not reported. A word capitalised on its first letter (Sechedule) is reported, however often it is used, when leaving out an inner letter or swapping two neighbours gives a dictionary word the document writes capitalised the same way after the same word (Release Schedule beside Release Sechedule) and also in lower case (schedule), since that is a title typed twice and once wrong. A twin the document only ever capitalises, or writes only after other words, is beside a name (Paris beside Parisa, the Great Lakes beside Hurricane Greta), and a name is not reported. Add a team's own words to names in chaff.yaml.

     → If it is a typo, correct it. If the word is right, add it to names in chaff.yaml.

     Relax this rule:  npx chaffjs relax unknown-word


─── line 7 ───────────────────────────────────────────────────

    increse the weekly order from next month if we confirm by Friday.

  ·  Word not in the dictionary

     "increse" is not in the dictionary; did you mean "increase"?
     An English word that is not in the dictionary but is one letter away from a word that is ("attched" and "attached") is usually a typo. chaff looks words up in the English adapter's dictionary (a word list built from wink-lexicon and WordNet), after taking off endings (-ed, -ing) and prefixes (un-, re-). Words with a capital letter (names, acronyms), words in code and URLs, words used twice or more in the document (usually its own terms), and words with no dictionary word one letter away are not reported. A word capitalised on its first letter (Sechedule) is reported, however often it is used, when leaving out an inner letter or swapping two neighbours gives a dictionary word the document writes capitalised the same way after the same word (Release Schedule beside Release Sechedule) and also in lower case (schedule), since that is a title typed twice and once wrong. A twin the document only ever capitalises, or writes only after other words, is beside a name (Paris beside Parisa, the Great Lakes beside Hurricane Greta), and a name is not reported. Add a team's own words to names in chaff.yaml.

     → If it is a typo, correct it. If the word is right, add it to names in chaff.yaml.

     Relax this rule:  npx chaffjs relax unknown-word


────────────────────────────────────────────────────────────

  2 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Notes from the supplier visit

Hi Chris,

Thanks for joining the visit yesterday. The notes are attached, along with the photos of the loading bay.

The supplier can increase the weekly order from next month if we confirm by Friday.

Best,
Mia
```

## How it was fixed

"Attched" and "increse" are typos, one letter away from the words that were meant.
They are not on any list of common misspellings, so chaff finds them another way: neither is in its dictionary, and a dictionary word is one letter away.

The fix corrects the two words.
A word with a capital letter, a word that appears twice or more in the document (usually a term of its own) and a word in code are not reported, so names and product terms are left alone.

## Settings

This rule sets no limit to count to; its level decides how a finding is marked.
At `normal` and `relaxed` it is a note, and `strict` makes it a warning.

If your team uses a word the dictionary does not know, in lower case and only once in a document, list it under `names`:

```yaml chaff-settings
names:
  - dropship
```

The rule does not run on fiction, poetry or plays, which may spell as their time and place did.

```text chaff-explain
$ npx chaffjs explain unknown-word --genre business/email

  Word not in the dictionary   (unknown-word)

  An English word that is not in the dictionary but is one letter away from a word that is ("attched" and "attached") is usually a typo. chaff looks words up in the English adapter's dictionary (a word list built from wink-lexicon and WordNet), after taking off endings (-ed, -ing) and prefixes (un-, re-). Words with a capital letter (names, acronyms), words in code and URLs, words used twice or more in the document (usually its own terms), and words with no dictionary word one letter away are not reported. A word capitalised on its first letter (Sechedule) is reported, however often it is used, when leaving out an inner letter or swapping two neighbours gives a dictionary word the document writes capitalised the same way after the same word (Release Schedule beside Release Sechedule) and also in lower case (schedule), since that is a title typed twice and once wrong. A twin the document only ever capitalises, or writes only after other words, is beside a name (Paris beside Parisa, the Great Lakes beside Hurricane Greta), and a name is not reported. Add a team's own words to names in chaff.yaml.

  How to fix: If it is a typo, correct it. If the word is right, add it to names in chaff.yaml.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax unknown-word --why "reason"
```

[All samples](README.md)
