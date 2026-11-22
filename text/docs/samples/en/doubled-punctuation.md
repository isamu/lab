<!-- chaff-sample
rule: doubled-punctuation
genre: business/email
file: contract-email.md
-->

# Doubled punctuation (`doubled-punctuation`)

**Where it helps:** emails, letters, anything typed quickly and edited once. The extra mark usually comes from a sentence that was split or joined.

## Original

```markdown chaff-before
Subject: Signed contract attached

Dear Ms Okafor,

Thank you for the call this morning.
The signed contract is attached,, and the deposit will be paid on Monday as agreed..

If anything in it needs to change, let me know and I will send a new copy.

Kind regards,
Tom Hale
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email contract-email.md

contract-email.md   business/email · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    contract is attached,, and the deposit wil

  ⚠  Doubled punctuation

     Punctuation is doubled: ",,"
     Two punctuation marks side by side ("..", ",,", "i.e.,,") are left over from an edit or a paste. The reader stops there, and the document looks rushed. Three or more of the same mark ("...") are drawn out on purpose and are not counted, nor is the comma or semicolon after an abbreviation's period ("e.g.,", "etc.;"), the points and comma of a company form in a Japanese sentence ("INC.、", "CO.，LTD."), a period that starts the next word (".NET"), a range or path ("1..10", "../"), the dot leader before a page number in a contents line ("Command..     7") or in a table whose columns are lined up with dot leaders, such as a play's cast list ("NORA..  Emma Vernon"), code or a URL. "!!" and "??" are a matter of style and are not checked.

     → Delete the extra mark.

     Relax this rule:  npx chaffjs relax doubled-punctuation


─── line 6 ───────────────────────────────────────────────────

    on Monday as agreed.. If anything in it

  ⚠  Doubled punctuation

     Punctuation is doubled: ".."
     Two punctuation marks side by side ("..", ",,", "i.e.,,") are left over from an edit or a paste. The reader stops there, and the document looks rushed. Three or more of the same mark ("...") are drawn out on purpose and are not counted, nor is the comma or semicolon after an abbreviation's period ("e.g.,", "etc.;"), the points and comma of a company form in a Japanese sentence ("INC.、", "CO.，LTD."), a period that starts the next word (".NET"), a range or path ("1..10", "../"), the dot leader before a page number in a contents line ("Command..     7") or in a table whose columns are lined up with dot leaders, such as a play's cast list ("NORA..  Emma Vernon"), code or a URL. "!!" and "??" are a matter of style and are not checked.

     → Delete the extra mark.

     Relax this rule:  npx chaffjs relax doubled-punctuation


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Signed contract attached

Dear Ms Okafor,

Thank you for the call this morning.
The signed contract is attached, and the deposit will be paid on Monday as agreed.

If anything in it needs to change, let me know and I will send a new copy.

Kind regards,
Tom Hale
```

## How it was fixed

",," and ".." are left over from an edit: a clause was cut, or two sentences were joined, and a mark stayed behind.
They are small, but this is an email to a client that confirms a signed contract and a payment date, and a reader who sees two of them wonders what else was not checked.

The fix deletes the extra mark in each place.

## Settings

At `normal` a finding is a warning; `strict` makes it an error and `relaxed` a note.
None of them changes what is found, only how loudly it is marked.

An ellipsis ("..." or more), the punctuation after an abbreviation ("e.g.,", "etc.;"), a range or path ("1..10", "../"), a dot leader in a table of contents, code and URLs are not reported.
"!!" and "??" are a matter of style and are not checked.

```yaml chaff-settings
rules:
  doubled-punctuation: relaxed
```

The rule runs in every genre.

```text chaff-explain
$ npx chaffjs explain doubled-punctuation --genre business/email

  Doubled punctuation   (doubled-punctuation)

  Two punctuation marks side by side ("..", ",,", "i.e.,,") are left over from an edit or a paste. The reader stops there, and the document looks rushed. Three or more of the same mark ("...") are drawn out on purpose and are not counted, nor is the comma or semicolon after an abbreviation's period ("e.g.,", "etc.;"), the points and comma of a company form in a Japanese sentence ("INC.、", "CO.，LTD."), a period that starts the next word (".NET"), a range or path ("1..10", "../"), the dot leader before a page number in a contents line ("Command..     7") or in a table whose columns are lined up with dot leaders, such as a play's cast list ("NORA..  Emma Vernon"), code or a URL. "!!" and "??" are a matter of style and are not checked.

  How to fix: Delete the extra mark.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax doubled-punctuation --why "reason"
```

[All samples](README.md)
