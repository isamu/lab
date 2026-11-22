<!-- chaff-sample
rule: url-run-on
genre: business/email
file: training-room.md
-->

# Text runs on after a URL (`url-run-on`)

**Where it helps:** emails, chat posts, README files. Anywhere a plain URL is followed straight away by a dash or a word.

## Original

```markdown chaff-before
Subject: Booking the training room

Hi all,

The training room can now be booked online at https://rooms.example.com/training—no need to email reception.
Bookings open two weeks ahead.

Thanks,
Reception
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email training-room.md

training-room.md   business/email · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    https://rooms.example.com/training

  ⚠  Text runs on after a URL

     The URL "https://rooms.example.com/training" is followed by "—" with no space; the link runs on into it
     When a URL written as plain text is followed straight away by a character outside ASCII ("https://example.com/—see", "https://example.jp/をご覧ください"), GitHub's automatic links and many mail clients read everything up to the next space as the URL, and clicking it opens a page that does not exist. Only a character outside ASCII right after the URL is reported. A URL written with link syntax ([docs](https://…) or <https://…>) and URLs in code are not counted.

     → Put a space after the URL, or write it as <https://…> or [text](https://…).

     Relax this rule:  npx chaffjs relax url-run-on


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Booking the training room

Hi all,

The training room can now be booked online at https://rooms.example.com/training, so there is no need to email reception.
Bookings open two weeks ahead.

Thanks,
Reception
```

## How it was fixed

Many mail clients and GitHub turn a plain URL into a link, and they read everything up to the next space as part of it.
Here that includes the dash, so a reader who clicks gets a page that does not exist, and goes back to emailing reception.

The fix ends the URL with a comma and a space, which every client stops at, and rewrites the rest of the sentence around it.
Writing the address as a link (`<https://…>` or `[text](https://…)`) works too.

## Settings

At `normal` a finding is a warning; `strict` makes it an error and `relaxed` a note.
None of them changes what is found, only how loudly it is marked.

Only a character outside ASCII right after the URL is reported, since that is what a link swallows.
URLs written as links, URLs in code and a URL followed by a space or an ordinary ASCII mark are not.

```yaml chaff-settings
rules:
  url-run-on: relaxed
```

The rule runs in every genre.

```text chaff-explain
$ npx chaffjs explain url-run-on --genre business/email

  Text runs on after a URL   (url-run-on)

  When a URL written as plain text is followed straight away by a character outside ASCII ("https://example.com/—see", "https://example.jp/をご覧ください"), GitHub's automatic links and many mail clients read everything up to the next space as the URL, and clicking it opens a page that does not exist. Only a character outside ASCII right after the URL is reported. A URL written with link syntax ([docs](https://…) or <https://…>) and URLs in code are not counted.

  How to fix: Put a space after the URL, or write it as <https://…> or [text](https://…).

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax url-run-on --why "reason"
```

[All samples](README.md)
