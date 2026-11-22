<!-- chaff-sample
rule: quote-without-source
genre: blog/tech
file: tickets-closed.md
-->

# A quotation given to someone, with no source (`quote-without-source`)

**Where it helps:** blog posts, essays and papers that quote what someone said.

## Original

```markdown chaff-before
# Why we stopped ranking teams by tickets closed

For two years we ranked support teams by how many tickets each closed in a week.
The numbers went up every quarter, and so did the complaints: teams were closing tickets before the problem was solved.

As the economist Charles Goodhart put it, "when a measure becomes a target, it ceases to be a good measure."

We now look at how many customers write back within a week about the same problem.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech tickets-closed.md

tickets-closed.md   blog/tech · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    when a measure becomes a target, it ceases to be a good measure.

  ·  A quotation given to someone, with no source

     "when a measure becomes a target, it ceases to be a good measure." is given to someone, but no source (a link, a footnote, a reference) is given
     A quotation given to someone ("X once said …", "according to X") is read as that person's words. With no source, nobody can check that the person said it, or said it that way; words change and speakers swap as a quotation is passed along, which is the commonest error in quoting. chaff cannot know who said what, but it can say there is nothing to check the quotation against. It points at a quotation in quotation marks given to someone by the words right after it or shortly before it ("said", "according to"; the words are in each language's word list), in a paragraph with no link, no footnote, no numbered citation and no year in brackets. A Markdown block quotation (`>`) with a dash line ("— Name") as its last line or right after it is given to someone too, and is pointed at when neither the quotation nor that line gives a source.

     → Name the source in the same paragraph: a link when it can be read online, or "(Author, Title, year)" or a footnote for a book or a paper. If no source can be found, do not give the words to the person until they can be checked. `chaff cite --scaffold <document>` writes these quotations as a quotes.json to fill in: put the source's file in each `source`, and `chaff cite <quotes.json>` checks that the words are really there.

     Relax this rule:  npx chaffjs relax quote-without-source


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Why we stopped ranking teams by tickets closed

For two years we ranked support teams by how many tickets each closed in a week.
The numbers went up every quarter, and so did the complaints: teams were closing tickets before the problem was solved.

The anthropologist Marilyn Strathern summed up Goodhart's law as "when a measure becomes a target, it ceases to be a good measure" ("Improving ratings", European Review, 1997).

We now look at how many customers write back within a week about the same problem.
```

## How it was fixed

The post gives a well-known line to the economist Charles Goodhart, with no source.
The line is not his: it is the anthropologist Marilyn Strathern's summary of his idea, written in 1997.
Goodhart's own 1975 wording is different. Words change and speakers swap as a quotation is passed along, and a source is the only way a reader can check either.

The fix gives the words to the person who wrote them and names where: the paper, the journal and the year.
A link, a footnote, a numbered citation or a year in brackets in the same paragraph counts as a source.
chaff does not judge whether the source is right; `chaff cite` checks that the words are really in it.

## Settings

A quotation with no source is a note at the default level and a warning at `strict`.
Blog posts, essays and papers are read; an organisation's articles, press releases, manuals, contracts, fiction and speeches are left out by default.

To make it a warning, raise it:

```yaml chaff-settings
rules:
  quote-without-source: strict
```

To stop checking it, write `off` instead of `strict`.

```text chaff-explain
$ npx chaffjs explain quote-without-source --genre blog/tech

  A quotation given to someone, with no source   (quote-without-source)

  A quotation given to someone ("X once said …", "according to X") is read as that person's words. With no source, nobody can check that the person said it, or said it that way; words change and speakers swap as a quotation is passed along, which is the commonest error in quoting. chaff cannot know who said what, but it can say there is nothing to check the quotation against. It points at a quotation in quotation marks given to someone by the words right after it or shortly before it ("said", "according to"; the words are in each language's word list), in a paragraph with no link, no footnote, no numbered citation and no year in brackets. A Markdown block quotation (`>`) with a dash line ("— Name") as its last line or right after it is given to someone too, and is pointed at when neither the quotation nor that line gives a source.

  How to fix: Name the source in the same paragraph: a link when it can be read online, or "(Author, Title, year)" or a footnote for a book or a paper. If no source can be found, do not give the words to the person until they can be checked. `chaff cite --scaffold <document>` writes these quotations as a quotes.json to fill in: put the source's file in each `source`, and `chaff cite <quotes.json>` checks that the words are really there.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax quote-without-source --why "reason"
```

[All samples](README.md)
