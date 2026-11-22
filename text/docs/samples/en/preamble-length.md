<!-- chaff-sample
rule: preamble-length
genre: business/proposal
file: proposal.md
-->

# Too long before the point (`preamble-length`)

**Where it helps:** proposals, reports, decision papers. Any document whose reader is looking for the decision.

## Original

```markdown chaff-before
# Proposal: moving the help desk to a shared inbox

For several years the help desk has answered requests from one personal mailbox per agent.

As the team grew from three to eight people, it became harder to see who was handling which request.

Customers have started to write to two or three agents at once to get a faster answer.

When an agent is on leave, the requests in that mailbox wait until the agent returns. Nobody else can see them.

Last quarter, a dozen requests were answered twice and four were not answered at all.

## Proposal

We will move all help desk mail to one shared inbox by February 1, 2027.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal proposal.md

proposal.md   business/proposal · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    For several years the help desk has answered requests from one personal mailbox

  ·  Too long before the point

     5 paragraphs before the first heading (limit 4)
     A reader of a business document is looking for the decision. Paragraphs before the first heading only delay it. A paragraph with no closed sentence (a category label, an author line) and an address field whose value is only a name ("To" followed by a company name) are not counted.

     → Put the conclusion first, or move the preamble under a heading.

     Relax this rule:  npx chaffjs relax preamble-length


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Proposal: moving the help desk to a shared inbox

We will move all help desk mail to one shared inbox by February 1, 2027.

## Why

The help desk answers requests from one personal mailbox per agent.
Since the team grew from three to eight people, nobody can see who is handling which request, and customers write to two or three agents at once to get a faster answer.
Requests wait while an agent is on leave, and last quarter a dozen were answered twice and four not at all.
```

## How it was fixed

The proposal spends five paragraphs on history before the first heading.
A manager reading it for the decision has to get through all five before learning what is proposed, and the proposal itself is a single sentence further down.

The fix puts the proposal first and moves the background under a heading of its own.
The reasons are all still there, now joined into three sentences.

## Settings

The level is how many paragraphs may come before the first heading: four at the default level, two at `strict`, six at `relaxed`.

If your documents open with a longer introduction on purpose, relax it:

```yaml chaff-settings
rules:
  preamble-length: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

It is off for legal, documentation, academic, literature and speech genres, and for emails.

```text chaff-explain
$ npx chaffjs explain preamble-length --genre business/proposal

  Too long before the point   (preamble-length)

  A reader of a business document is looking for the decision. Paragraphs before the first heading only delay it. A paragraph with no closed sentence (a category label, an author line) and an address field whose value is only a name ("To" followed by a company name) are not counted.

  How to fix: Put the conclusion first, or move the preamble under a heading.

  Levels:
    strict   up to 2 paragraphs before the first heading
  → normal   up to 4 paragraphs before the first heading
    relaxed  up to 6 paragraphs before the first heading
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax preamble-length --why "reason"
```

[All samples](README.md)
