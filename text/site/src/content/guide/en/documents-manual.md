# Manuals and API docs

A manual or an API doc is read by following its headings, clicking its links and copying its code.
chaff finds by machine headings that cannot be followed, links that go nowhere, and images with no description.
The genre is `docs/manual`. How-to and help pages are checked under the same genre.

## What usually goes wrong

A manual grows a section for every feature, and sections get moved. Each time, links break.

| What goes wrong | Example |
| --- | --- |
| A link that goes nowhere | A heading was renamed, but not the links to it |
| An image with no description | `![](images/settings.png)`, with the description left empty |
| A heading level skipped | `####` straight after `##` |
| An empty section | The heading was written first, and the text never came |
| The same heading twice | A section was moved, and the old one was not deleted |
| A URL run into the next character | `see https://example.com/docs/bookings。`, pasted from a Japanese page |

The last one makes the link swallow the "。", so clicking it opens a page that does not exist.

## What chaff checks, and what it does not

These are the main rules for this genre. All of them run by default.

| Rule | What it finds |
| --- | --- |
| `broken-link` | A link to a heading the page does not have |
| `image-alt-text` | An image with no description (alt text) |
| `heading-level-skip` | A heading two or more levels deeper than the one before |
| `empty-section` | A heading with nothing under it |
| `duplicate-heading` | Two headings with the same words under the same parent |
| `url-run-on` | A URL followed straight away by a character outside ASCII |

What it does not do is decided too.

- It does not check that the code works. Whether the JSON is valid, or the API really returns that value, is for the writer to try.
- It does not open links to other sites. It only checks links to headings inside the page.
- It does not check that the image file exists.
- It does not check that the steps are in the right order. The writer follows them as a reader would.

The rules for generated-text shapes and for passives do not run for manuals. The genre turns them off.
They are listed at the end of the screen under "rules not run", with the genre as the reason.

## Try it

If you have not set up yet, do [Getting ready](./documents#getting-ready) first.
The page below was saved as `manual.md`. The API and its URL are made up.

````markdown file=manual.md
# Using the booking API

This page explains how to make, check and cancel a meeting room booking with the booking API.

## Before you start

You create an API key under Settings in the admin screen. For the steps, see [Creating a key](#create-a-key).

![](images/settings.png)

## Making a booking

#### Request

Send this JSON to `POST /v1/bookings`.

```json
{ "room": "B", "start": "2026-10-14T10:00:00+09:00", "minutes": 60 }
```

#### Response

On success, the booking number comes back. For details see https://example.com/docs/bookings。

## Cancelling a booking

## Making a booking

If the room is already booked at that time, you get `409`. Book again at another time.

## Common errors

| Code | Meaning |
| --- | --- |
| 401 | The API key is missing or wrong |
| 409 | The room is already booked at that time |
````

Run without a genre, chaff sees "manual" in the file name and suggests the manual genre.

```
$ npx chaffjs manual.md --compact

manual.md   blog/tech · English   genre from the default
   Looks like: Manual and how-to. Try --genre docs/manual

  7:78    warning The link "[Creating a key](#create-a-key)" points to "#create-a-key", which is not a heading on this page
                  broken-link
  9:1     warning Image "![](images/settings.png)" has no alt text
                  image-alt-text
  13:1    info    Heading "Request" goes from level 2 to level 4 (expected 3)
                  heading-level-skip
  23:60   warning The URL "https://example.com/docs/bookings" is followed by "。" with no space; the link runs on into it
                  url-run-on
  25:1    warning Nothing under the heading "Cancelling a booking"
                  empty-section
  27:1    warning The heading "Making a booking" repeats the one on line 11 under the same parent
                  duplicate-heading

{counts}
```

Add the genre, as suggested.
`--compact` prints each finding on two lines.

```
$ npx chaffjs manual.md --genre docs/manual --compact

manual.md   docs/manual · English   genre from --genre

  7:78    warning The link "[Creating a key](#create-a-key)" points to "#create-a-key", which is not a heading on this page
                  broken-link
  9:1     warning Image "![](images/settings.png)" has no alt text
                  image-alt-text
  13:1    info    Heading "Request" goes from level 2 to level 4 (expected 3)
                  heading-level-skip
  23:60   warning The URL "https://example.com/docs/bookings" is followed by "。" with no space; the link runs on into it
                  url-run-on
  25:1    warning Nothing under the heading "Cancelling a booking"
                  empty-section
  27:1    warning The heading "Making a booking" repeats the one on line 11 under the same parent
                  duplicate-heading

{counts}
```

## The guide that comes first

With the genre set, chaff opens the report with the genre's guide: what a good manual does, as questions to check the draft against.
Under them is a line naming the rules that matter most for this genre.
Most of the questions are ones no rule can answer, so read them before the findings.
An AI that rewrites the text works to the same lines ([Using the guide with an AI](./ai-sounding#give-the-ai-the-genres-guide)).

```
$ npx chaffjs manual.md --genre docs/manual

Guide: Manual and how-to (docs/manual)

  Before the findings below, check the draft against these.

  - Does each section cover one task, with the task as its heading?
  - Are prerequisites, permissions and preparation given before the steps?
  - Are the steps numbered, one action each, in the imperative and in the order they are done?
  - Does each step say what the reader should see when it worked?
  - Are button labels, commands and setting names spelled exactly as on screen or in code?

  Rules that matter most for this genre: code-fence-language-mix, heading-command-missing, requirement-smell, shell-prompt-mix, step-statement-mix
  Change it with guide: in chaff.yaml; leave it out with --no-guide.

════════════════════════════════════════════════════════════

manual.md   docs/manual · English   genre from --genre
…
```

A genre that was guessed from the path or the content, or left at the default, prints no guide.
A guide for the wrong kind of document would mislead.
`--compact` and `--no-guide` leave it out.
A team changes the lines with `guide:` in `chaff.yaml` ([Changing the genre's guide](./configuration#changing-the-genres-guide)).

## What each finding means

| Line | Finding | What it means | How to fix it |
| --- | --- | --- | --- |
| 7 | `broken-link` | There is no heading "Create a key" on the page | Add the heading, or point the link at the heading that exists |
| 9 | `image-alt-text` | The image has no description, so a screen reader or a page without images says nothing | Describe what the image shows: `![The Settings screen, with "Create API key" at top right](images/settings.png)` |
| 13 | `heading-level-skip` | `####` comes straight after `##` | Make it `###`; the table of contents then nests correctly |
| 23 | `url-run-on` | The "。" right after the URL becomes part of the link | Use an English full stop with a space, or a link: `[the booking docs](https://example.com/docs/bookings)` |
| 25 | `empty-section` | "Cancelling a booking" has nothing under it | Write the steps, or remove the heading |
| 27 | `duplicate-heading` | "Making a booking" appears twice | Rename the second to match its content, such as "When the room is taken" |

Lines 25 and 27 look like a section that was moved and not cleaned up.
chaff does not decide which one to keep. The writer reads both and decides.

## No checks that read meaning

For this genre, `npx chaffjs test` sends nothing to an AI.
`npx chaffjs test manual.md --genre docs/manual --dry-run` says 0 passages would be sent.

## A starter chaff.yaml

Put this `chaff.yaml` in the folder that holds your manual.

```yaml
genre: docs/manual
language: en
```

With this file in place, `npx chaffjs manual.md` reads the file as a manual without `--genre`.
If the same folder also holds READMEs or specifications, give each path its own genre, as in [Configuration](./configuration) under "Changing settings per path".

## What to read next

- How to silence one spot, and how to relax a rule, are in [Business reports](./documents-report).
- Every rule is explained in the [reference](./reference).
- For another kind of document, go back to [What chaff does for each kind of document](./documents).
