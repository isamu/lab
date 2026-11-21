<!-- chaff-sample
rule: colon-lead-in
genre: blog/owned-media
file: first-week.md
-->

# Too many colon lead-ins to lists (`colon-lead-in`)

**Where it helps:** onboarding pages, guides, internal wikis, blog posts. Pages that hand the reader from one list to the next.

## Original

```markdown chaff-before
# Your first week on the support team

Welcome to the team. This page covers what happens in your first five days, from the morning you collect your laptop to the Friday meeting with your lead.
Keep it open during the week; your buddy will point you back to it more than once.

## Before you start

IT sets up your accounts the week before you join, and your buddy will email you on the Friday before to say where to sit.
If anything on the list below is missing on your first morning, tell your buddy before you do anything else.

Here's what you need to have ready:

- A laptop with the company image installed
- Access to the ticket system and the help channel

## Your first two days

Most of the first two days is spent watching and reading, not answering.
The senior agents have all been through the same week, and they expect questions.
You will not be measured on speed this week, and nobody looks at your reply times until the second month.
If a ticket makes you unsure, leave it for the senior agent and note why; those notes are what the Thursday review is built from.

Here's how the first two days go:

- Shadow a senior agent on live tickets
- Read the ten most common replies
- Sit in on one phone call with a customer
- Answer your first tickets with a reviewer

## The rest of the week

From Wednesday the work becomes your own, but a reviewer still reads a sample of your replies each day.

Here's what to expect for the rest of the week:

- Take tickets on your own
- Join the Thursday review of difficult tickets
- Meet your lead on Friday to agree your goals for the first month

## Getting help

Here's who to ask when you are stuck:

- Your buddy, for anything about the tools
- The team lead, for questions about a customer or a refund
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/owned-media first-week.md

first-week.md   blog/owned-media · English   genre from --genre

─── line 11 ──────────────────────────────────────────────────

    Here's what you need to have ready:

  ·  Too many colon lead-ins to lists

     13.3 colon lead-ins to lists per 1000 words (limit 4)
     A sentence ending in a colon that hands the reader to a list ("Here's what you need to know:"). Once, it guides; section after section, the prose shrinks to list captions and the links between the items go unwritten. A shape common in generated text.

     → Turn some of the lists back into sentences and say how the items connect. Real lists (steps, parts) can stay.

     Relax this rule:  npx chaffjs relax colon-lead-in


─── line 23 ──────────────────────────────────────────────────

    Here's how the first two days go:

  ·  Too many colon lead-ins to lists

     13.3 colon lead-ins to lists per 1000 words (limit 4)
     A sentence ending in a colon that hands the reader to a list ("Here's what you need to know:"). Once, it guides; section after section, the prose shrinks to list captions and the links between the items go unwritten. A shape common in generated text.

     → Turn some of the lists back into sentences and say how the items connect. Real lists (steps, parts) can stay.

     Relax this rule:  npx chaffjs relax colon-lead-in


─── line 34 ──────────────────────────────────────────────────

    Here's what to expect for the rest of the week:

  ·  Too many colon lead-ins to lists

     13.3 colon lead-ins to lists per 1000 words (limit 4)
     A sentence ending in a colon that hands the reader to a list ("Here's what you need to know:"). Once, it guides; section after section, the prose shrinks to list captions and the links between the items go unwritten. A shape common in generated text.

     → Turn some of the lists back into sentences and say how the items connect. Real lists (steps, parts) can stay.

     Relax this rule:  npx chaffjs relax colon-lead-in


─── line 42 ──────────────────────────────────────────────────

    Here's who to ask when you are stuck:

  ·  Too many colon lead-ins to lists

     13.3 colon lead-ins to lists per 1000 words (limit 4)
     A sentence ending in a colon that hands the reader to a list ("Here's what you need to know:"). Once, it guides; section after section, the prose shrinks to list captions and the links between the items go unwritten. A shape common in generated text.

     → Turn some of the lists back into sentences and say how the items connect. Real lists (steps, parts) can stay.

     Relax this rule:  npx chaffjs relax colon-lead-in


────────────────────────────────────────────────────────────

  4 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Your first week on the support team

Welcome to the team. This page covers what happens in your first five days, from the morning you collect your laptop to the Friday meeting with your lead.
Keep it open during the week; your buddy will point you back to it more than once.

## Before you start

IT sets up your accounts the week before you join, and your buddy will email you on the Friday before to say where to sit.
By your first morning you should have a laptop with the company image installed, and access to the ticket system and the help channel.
If either is missing, tell your buddy before you do anything else.

## Your first two days

Most of the first two days is spent watching and reading, not answering.
You sit with a senior agent on live tickets, and on one phone call with a customer.
In between, read the ten most common replies, because most of your first tickets will need one of them.
On the second afternoon you answer your first tickets yourself, with a reviewer checking each reply before it goes out.
The senior agents have all been through the same week, and they expect questions.

## The rest of the week

From Wednesday you take tickets on your own, and a reviewer reads a sample of your replies each day.
On Thursday you join the review of difficult tickets, where the team goes through the week's hardest cases.
On Friday you meet your lead to agree your goals for the first month.

## Getting help

Asking early is quicker than guessing.
Ask your buddy about the tools, and the team lead about a customer or a refund.
```

## How it was fixed

Every section ends the same way: "Here's what you need", "Here's how the first two days go", "Here's what to expect", "Here's who to ask", each followed by a list.
The page reads as captions for lists, and what links the items goes unwritten: the reading of the common replies happens between the shadowing sessions, and the Friday meeting comes out of the week before it.

The corrected page turns the lists back into sentences, in the order the new person lives them, and adds what the lists could not hold (why to read the common replies first).
A list is still the right form for steps a reader follows one by one, or parts they tick off; a lead-in before a list of that kind is not counted.

## Settings

The rule counts sentences that end in a colon and hand the reader to a list, per 1000 words, and only when they appear in three sections or more. In English, writers hand off to a list often, so the English limit is higher: four per 1000 words at `normal`, three at `strict`, six at `relaxed`:

```yaml chaff-settings
rules:
  colon-lead-in: relaxed
```

A lead-in that states a duty ("The report must include:"), a bold noun label on its own line (**Pros:**), and a list of code values are not counted. Short documents are not measured, and the rule does not run on documentation, legal, specification, literature or speech genres. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score first-week.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain colon-lead-in --genre blog/owned-media

  Too many colon lead-ins to lists   (colon-lead-in)

  A sentence ending in a colon that hands the reader to a list ("Here's what you need to know:"). Once, it guides; section after section, the prose shrinks to list captions and the links between the items go unwritten. A shape common in generated text.

  How to fix: Turn some of the lists back into sentences and say how the items connect. Real lists (steps, parts) can stay.

  Rewrite depth: structure (sections, headings and paragraphs are reorganised). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   colon lead-ins to lists: up to 3 per 1000 words
  → normal   colon lead-ins to lists: up to 4 per 1000 words
    relaxed  colon lead-ins to lists: up to 6 per 1000 words
    off      not checked

  Options (set under options in chaff.yaml):
    min_sections: 3   (default)
      The fewest sections with a lead-in. In one or two sections it is a procedure's lead-in or a pair of lists, not section after section. A document without headings counts its lead-ins

  Set one:  write options: { colon-lead-in: { <name>: <value> } } in chaff.yaml

  Now: normal.

  Change it:  npx chaffjs relax colon-lead-in --why "reason"
```

[All samples](README.md)
