<!-- chaff-sample
rule: image-file-name-alt
genre: docs/manual
file: expense-app.md
-->

# Image alt text is a file name (`image-file-name-alt`)

**Where it helps:** help pages, how-to guides, release notes. Any page built by pasting screenshots.

## Original

```markdown chaff-before
# Submitting an expense claim

Open the app and tap **New claim**. The form asks for the date, the amount and a photo of the receipt.

![Screenshot 2026-11-03 at 10.42.17.png](claim-form.png)

Tap **Submit** when every field is filled in.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual expense-app.md

expense-app.md   docs/manual · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    ![Screenshot 2026-11-03 at 10.42.17.png](claim-form.png)

  ⚠  Image alt text is a file name

     The image alt text "Screenshot 2026-11-03 at 10.42.17.png" is a file name
     An image whose alt text is its file's name ("![IMG_1234.png](IMG_1234.png)", "![Screenshot 2026-04-01](a.png)"). When the image does not load, or a screen reader reads the page, the alt text is all that stands in for it, and a file name says nothing about what it shows. It is usually the name a tool put in when the image was pasted. An empty alt text is image-alt-text's.

     → Write what the image shows in a few words ("![Sales by month, April](IMG_1234.png)").

     Relax this rule:  npx chaffjs relax image-file-name-alt


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Submitting an expense claim

Open the app and tap **New claim**. The form asks for the date, the amount and a photo of the receipt.

![The New claim form, with fields for the date, the amount and the receipt photo](claim-form.png)

Tap **Submit** when every field is filled in.
```

## How it was fixed

The alt text of the screenshot is "Screenshot 2026-11-03 at 10.42.17.png", the name the computer gave the file when the screenshot was taken.
The editor put it in when the image was pasted.
A reader who cannot see the image hears a date and a time, and learns nothing about the form.

The fix says what the screenshot shows.
chaff reports alt text that ends in an image extension, or that starts with a name a camera or screenshot tool gives.
Alt text such as "Architecture" is not reported, even when the file is called `diagram.png`.

## Settings

A file name used as alt text is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your file names are written to describe the image, relax it:

```yaml chaff-settings
rules:
  image-file-name-alt: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain image-file-name-alt --genre docs/manual

  Image alt text is a file name   (image-file-name-alt)

  An image whose alt text is its file's name ("![IMG_1234.png](IMG_1234.png)", "![Screenshot 2026-04-01](a.png)"). When the image does not load, or a screen reader reads the page, the alt text is all that stands in for it, and a file name says nothing about what it shows. It is usually the name a tool put in when the image was pasted. An empty alt text is image-alt-text's.

  How to fix: Write what the image shows in a few words ("![Sales by month, April](IMG_1234.png)").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax image-file-name-alt --why "reason"
```

[All samples](README.md)
