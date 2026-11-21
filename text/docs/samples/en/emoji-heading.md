<!-- chaff-sample
rule: emoji-heading
genre: blog/tech
file: post.md
-->

# Headings decorated with emoji (`emoji-heading`)

**Where it helps:** blog posts, team updates, READMEs, internal newsletters.

## Original

```markdown chaff-before
# Our first month with the shared calendar

## 🚀 Two teams, one room

Each team kept its own calendar, so booking a meeting room meant asking around on chat.
Twice in September two teams turned up for the same room.

## 🛠️ One calendar per room

We made one calendar per room and gave every team the right to book.
Recurring meetings were moved over by each team's lead in the first week.

## 📈 No more double bookings

Nobody has double-booked a room since. The chat channel for room questions has gone quiet.

## ✅ The phone booths are next

In December we will add the two phone booths on the third floor.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech post.md

post.md   blog/tech · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    ## 🚀 Two teams, one room

  ·  Headings decorated with emoji

     Heading "🚀 Two teams, one room" has an emoji (4 headings with one, 3 needed)
     A heading with an emoji in it ("## 🚀 Getting started", "## ✅ Summary"), heading after heading. When every heading has one, the emoji says nothing about the section, and the table of contents and a screen reader get a row of meaningless symbols. A shape common in generated text.

     → Take the emoji out of the headings and let the words say what the section holds. If one heading really needs a marker, keep that one.

     Relax this rule:  npx chaffjs relax emoji-heading


─── line 8 ───────────────────────────────────────────────────

    ## 🛠️ One calendar per room

  ·  Headings decorated with emoji

     Heading "🛠️ One calendar per room" has an emoji (4 headings with one, 3 needed)
     A heading with an emoji in it ("## 🚀 Getting started", "## ✅ Summary"), heading after heading. When every heading has one, the emoji says nothing about the section, and the table of contents and a screen reader get a row of meaningless symbols. A shape common in generated text.

     → Take the emoji out of the headings and let the words say what the section holds. If one heading really needs a marker, keep that one.

     Relax this rule:  npx chaffjs relax emoji-heading


─── line 13 ──────────────────────────────────────────────────

    ## 📈 No more double bookings

  ·  Headings decorated with emoji

     Heading "📈 No more double bookings" has an emoji (4 headings with one, 3 needed)
     A heading with an emoji in it ("## 🚀 Getting started", "## ✅ Summary"), heading after heading. When every heading has one, the emoji says nothing about the section, and the table of contents and a screen reader get a row of meaningless symbols. A shape common in generated text.

     → Take the emoji out of the headings and let the words say what the section holds. If one heading really needs a marker, keep that one.

     Relax this rule:  npx chaffjs relax emoji-heading


─── line 17 ──────────────────────────────────────────────────

    ## ✅ The phone booths are next

  ·  Headings decorated with emoji

     Heading "✅ The phone booths are next" has an emoji (4 headings with one, 3 needed)
     A heading with an emoji in it ("## 🚀 Getting started", "## ✅ Summary"), heading after heading. When every heading has one, the emoji says nothing about the section, and the table of contents and a screen reader get a row of meaningless symbols. A shape common in generated text.

     → Take the emoji out of the headings and let the words say what the section holds. If one heading really needs a marker, keep that one.

     Relax this rule:  npx chaffjs relax emoji-heading


────────────────────────────────────────────────────────────

  4 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Our first month with the shared calendar

## Two teams, one room

Each team kept its own calendar, so booking a meeting room meant asking around on chat.
Twice in September two teams turned up for the same room.

## One calendar per room

We made one calendar per room and gave every team the right to book.
Recurring meetings were moved over by each team's lead in the first week.

## No more double bookings

Nobody has double-booked a room since. The chat channel for room questions has gone quiet.

## The phone booths are next

In December we will add the two phone booths on the third floor.
```

## How it was fixed

Every heading has an emoji: a rocket, a hammer and wrench, a chart, a tick.
With one on every heading they mark nothing in particular; the rocket does not say why the team switched.
In the table of contents and in a screen reader, they become a row of symbols to get past ("rocket, two teams, one room").

The fix takes the emoji out and leaves the words, which already said what each section holds.
If one heading really needs a marker (a warning, say), keeping that one is fine.

## Settings

The rule reports once three headings carry an emoji; `strict` reports from two and `relaxed` from five:

```yaml chaff-settings
rules:
  emoji-heading: relaxed
```

Symbols that are not drawn as emoji (→, ™) are not counted. The rule does not run on documentation, legal, academic or literature genres.

```text chaff-explain
$ npx chaffjs explain emoji-heading --genre blog/tech

  Headings decorated with emoji   (emoji-heading)

  A heading with an emoji in it ("## 🚀 Getting started", "## ✅ Summary"), heading after heading. When every heading has one, the emoji says nothing about the section, and the table of contents and a screen reader get a row of meaningless symbols. A shape common in generated text.

  How to fix: Take the emoji out of the headings and let the words say what the section holds. If one heading really needs a marker, keep that one.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once 2 headings carry an emoji
  → normal   reported once 3 headings carry an emoji
    relaxed  reported once 5 headings carry an emoji
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax emoji-heading --why "reason"
```

[All samples](README.md)
