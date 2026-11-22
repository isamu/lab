<!-- chaff-sample
rule: invisible-character
genre: docs/manual
file: office-printer.md
-->

# Invisible character (`invisible-character`)

**Where it helps:** help pages, setup guides, anything with an address or command a reader will copy. The character usually comes in with text pasted from a web page or a PDF.

## Original

```markdown chaff-before
# Connecting to the office printer

1. Open Settings and choose Printers.
2. Select Add a printer and enter this address: print​-hall.example.com
3. Choose the driver called Office Laser and select Finish.

If the printer is not found, check that your laptop is on the office network and not on the guest network.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual office-printer.md

office-printer.md   docs/manual · English   genre from --genre

─── line 4 ───────────────────────────────────────────────────

    this address: print⟨U+200B⟩-hall.example.com 3.

  ⚠  Invisible character

     1 zero-width character (U+200B): search and copy break the word here
     A zero-width space, a byte order mark left mid-text, a soft hyphen, a direction mark and a control character stay in the text without showing on screen. They come in with text pasted from a web page or a PDF, and make a word that search does not find, a URL that does not open and a command that does not run. Direction marks and tag characters hidden after a letter can also make what a reader sees differ from what a machine reads, so they are a safety signal too. A no-break space after a heading or list marker stops the marker from working, and one next to Japanese text is left over from a paste. Code is checked too, since a copied command stops working. A joiner inside an emoji or in Arabic or Indic script, a direction mark or isolate next to right-to-left text, the tag characters of a regional flag and a single variation selector after a character are part of the writing and are not counted. A direction override (LRO, RLO) is always reported.

     → Delete the invisible character, and replace a no-break space with an ordinary space. An editor's "show invisibles" setting shows where they are.

     Relax this rule:  npx chaffjs relax invisible-character


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Connecting to the office printer

1. Open Settings and choose Printers.
2. Select Add a printer and enter this address: print-hall.example.com
3. Choose the driver called Office Laser and select Finish.

If the printer is not found, check that your laptop is on the office network and not on the guest network.
```

## How it was fixed

The printer address in step 2 looks right on screen, but between "print" and "-hall" sits a zero-width space, pasted in from a web page with the address.
A reader who copies it gets an address the computer cannot find, and nothing on the page shows why.
chaff names the character by its code (U+200B), since there is nothing to see.

The fix deletes it.
An editor's "show invisibles" setting shows where such characters are.

## Settings

At `normal` a finding is a warning; `strict` makes it an error and `relaxed` a note.
None of them changes what is found, only how loudly it is marked.

A joiner inside an emoji or in Arabic or Indic script, a direction mark next to right-to-left text, the tag characters of a flag and a byte order mark at the start of the file are part of the writing and are not reported.
Code is checked too, since a copied command stops working just the same.

```yaml chaff-settings
rules:
  invisible-character: relaxed
```

The rule runs in every genre.

```text chaff-explain
$ npx chaffjs explain invisible-character --genre docs/manual

  Invisible character   (invisible-character)

  A zero-width space, a byte order mark left mid-text, a soft hyphen, a direction mark and a control character stay in the text without showing on screen. They come in with text pasted from a web page or a PDF, and make a word that search does not find, a URL that does not open and a command that does not run. Direction marks and tag characters hidden after a letter can also make what a reader sees differ from what a machine reads, so they are a safety signal too. A no-break space after a heading or list marker stops the marker from working, and one next to Japanese text is left over from a paste. Code is checked too, since a copied command stops working. A joiner inside an emoji or in Arabic or Indic script, a direction mark or isolate next to right-to-left text, the tag characters of a regional flag and a single variation selector after a character are part of the writing and are not counted. A direction override (LRO, RLO) is always reported.

  How to fix: Delete the invisible character, and replace a no-break space with an ordinary space. An editor's "show invisibles" setting shows where they are.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax invisible-character --why "reason"
```

[All samples](README.md)
