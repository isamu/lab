<!-- chaff-sample
rule: lookalike-character
genre: business/report
file: catering-report.md
-->

# Look-alike character (`lookalike-character`)

**Where it helps:** reports and documents that take names from file names, PDFs or other systems. Accented names are where it happens most.

## Original

```markdown chaff-before
# Catering for the spring conference

We compared three caterers. The best fit is Café Lumière, which can serve 200 guests and has a full vegetarian menu.

Their quote is within budget and includes staff, plates and cleaning.
We have asked them to hold the date while finance approves the order.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report catering-report.md

catering-report.md   business/report · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    The best fit is Café Lumière, which can

  ⚠  Look-alike character

     "é" is a letter and a separate mark (U+0065 U+0301), not the single letter "é"
     A Kangxi radical (⼈ U+2F08) looks like the ordinary 人 and is another character; so is a CJK compatibility ideograph. A letter written as a base and a separate combining mark (e + U+0301, common in macOS file names and text copied from them) looks like é and is another sequence. A full-width hyphen or a minus between katakana (ニュ－ス) looks like the long-vowel mark ー and is another character. Search, sorting, dictionaries and spelling checks all miss them, and the reader cannot see what to fix. They come from PDF copies and input methods. Code is checked too.

     → Delete the character and type the ordinary one. Normalising the document to NFC also fixes it (NFKC for radicals).

     Relax this rule:  npx chaffjs relax lookalike-character


─── line 3 ───────────────────────────────────────────────────

    st fit is Café Lumière, which can serve

  ⚠  Look-alike character

     "è" is a letter and a separate mark (U+0065 U+0300), not the single letter "è"
     A Kangxi radical (⼈ U+2F08) looks like the ordinary 人 and is another character; so is a CJK compatibility ideograph. A letter written as a base and a separate combining mark (e + U+0301, common in macOS file names and text copied from them) looks like é and is another sequence. A full-width hyphen or a minus between katakana (ニュ－ス) looks like the long-vowel mark ー and is another character. Search, sorting, dictionaries and spelling checks all miss them, and the reader cannot see what to fix. They come from PDF copies and input methods. Code is checked too.

     → Delete the character and type the ordinary one. Normalising the document to NFC also fixes it (NFKC for radicals).

     Relax this rule:  npx chaffjs relax lookalike-character


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Catering for the spring conference

We compared three caterers. The best fit is Café Lumière, which can serve 200 guests and has a full vegetarian menu.

Their quote is within budget and includes staff, plates and cleaning.
We have asked them to hold the date while finance approves the order.
```

## How it was fixed

The caterer's name looks right, but its "é" and "è" are each two characters: a plain "e" and a separate accent mark after it.
This is how macOS stores accented letters in file names, and the name came in by copying from one.
On screen nothing is wrong. A search for "Café Lumière" typed on a keyboard does not find it, and a spelling check or a sort may treat it as a different word.

The fix retypes the two letters as single characters.
Normalising the document to NFC, which many editors can do, fixes all of them at once.

## Settings

At `normal` a finding is a warning; `strict` makes it an error and `relaxed` a note.
None of them changes what is found, only how loudly it is marked.

Combinations that have no single-character form, and characters Unicode keeps as their own, are not reported.
A line that is about such characters (one that mentions NFD or decomposed letters), and the lines next to it, are not reported either, since the example is there on purpose.

```yaml chaff-settings
rules:
  lookalike-character: relaxed
```

The rule runs in every genre, and in code too.

```text chaff-explain
$ npx chaffjs explain lookalike-character --genre business/report

  Look-alike character   (lookalike-character)

  A Kangxi radical (⼈ U+2F08) looks like the ordinary 人 and is another character; so is a CJK compatibility ideograph. A letter written as a base and a separate combining mark (e + U+0301, common in macOS file names and text copied from them) looks like é and is another sequence. A full-width hyphen or a minus between katakana (ニュ－ス) looks like the long-vowel mark ー and is another character. Search, sorting, dictionaries and spelling checks all miss them, and the reader cannot see what to fix. They come from PDF copies and input methods. Code is checked too.

  How to fix: Delete the character and type the ordinary one. Normalising the document to NFC also fixes it (NFKC for radicals).

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax lookalike-character --why "reason"
```

[All samples](README.md)
