<!-- chaff-sample
rule: image-alt-text
genre: docs/manual
file: visitor-guide.md
-->

# Image without alt text (`image-alt-text`)

**Where it helps:** help pages, visitor guides, web articles, newsletters. Any page with images that some readers will not see.

## Original

```markdown chaff-before
# Visiting our office

The visitor entrance is on Harbour Street, to the left of the main doors.

![](entrance.jpg)

Press the buzzer marked "Reception" and someone will meet you.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual visitor-guide.md

visitor-guide.md   docs/manual · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    ![](entrance.jpg)

  ⚠  Image without alt text

     Image "![](entrance.jpg)" has no alt text
     When an image does not load, or a screen reader reads the page, the alt text is all that stands in for it. With an empty one ("![](chart.png)") the reader cannot tell what was there. An HTML <img> is reported only when it has no alt attribute; alt="" says the image is decoration and is not counted (as markdownlint's MD045).

     → Write what the image shows in a few words ("![Sales by month, April](chart.png)"). If it is decoration, write alt="" in HTML so screen readers skip it.

     Relax this rule:  npx chaffjs relax image-alt-text


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Visiting our office

The visitor entrance is on Harbour Street, to the left of the main doors.

![The visitor entrance: a glass door with a blue sign, left of the main doors](entrance.jpg)

Press the buzzer marked "Reception" and someone will meet you.
```

## How it was fixed

The photo of the entrance has no alt text.
When the image does not load, or a visitor uses a screen reader, the page skips from "to the left of the main doors" straight to the buzzer. The one thing the photo was there to show is gone.

The fix says what the photo shows, in a few words.
Alt text does not need to describe everything in the picture, only what the reader needs from it.
An HTML image with `alt=""` is marked as decoration on purpose and is not reported.

## Settings

An image with no alt text is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your images are all decoration and the text says everything, relax it:

```yaml chaff-settings
rules:
  image-alt-text: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

An image whose alt text is only a file name is reported by `image-file-name-alt`.

```text chaff-explain
$ npx chaffjs explain image-alt-text --genre docs/manual

  Image without alt text   (image-alt-text)

  When an image does not load, or a screen reader reads the page, the alt text is all that stands in for it. With an empty one ("![](chart.png)") the reader cannot tell what was there. An HTML <img> is reported only when it has no alt attribute; alt="" says the image is decoration and is not counted (as markdownlint's MD045).

  How to fix: Write what the image shows in a few words ("![Sales by month, April](chart.png)"). If it is decoration, write alt="" in HTML so screen readers skip it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax image-alt-text --why "reason"
```

[All samples](README.md)
