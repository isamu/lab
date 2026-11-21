<!-- chaff-sample
rule: chat-citation-residue
genre: business/report
file: office-move.md
-->

# Chat citation residue (`chat-citation-residue`)

**Where it helps:** reports, briefings, articles. Any document where part of the text came from a chat assistant.

## Original

```markdown chaff-before
# Office move: what we checked

The new building meets the step-free access standard for its entrance, lifts and toilets ([building survey](https://example.com/survey-2025?utm_source=chatgpt.com)).

The landlord's quote covers cleaning and security but not the meeting room screens. :contentReference[oaicite:0]{index=0}

We recommend signing the lease before the end of the month, while the current rent holds.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report office-move.md

office-move.md   business/report · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    utm_source=chatgpt.com

  ⚠  Chat citation residue

     "utm_source=chatgpt.com" is left over from a chat answer
     A link ending in "?utm_source=chatgpt.com" and a ":contentReference[oaicite:0]" are marks a chat answer leaves when it is pasted. This is not a matter of style: it shows the paste was never checked, and that nobody has confirmed the link supports the sentence it sits on.

     → Open the link and check it supports the sentence. If it does, keep the link and drop the "?utm_source=…" at its end. Delete citation marks (oaicite, contentReference).

     Relax this rule:  npx chaffjs relax chat-citation-residue


─── line 5 ───────────────────────────────────────────────────

    contentReference[

  ⚠  Chat citation residue

     "contentReference[" is left over from a chat answer
     A link ending in "?utm_source=chatgpt.com" and a ":contentReference[oaicite:0]" are marks a chat answer leaves when it is pasted. This is not a matter of style: it shows the paste was never checked, and that nobody has confirmed the link supports the sentence it sits on.

     → Open the link and check it supports the sentence. If it does, keep the link and drop the "?utm_source=…" at its end. Delete citation marks (oaicite, contentReference).

     Relax this rule:  npx chaffjs relax chat-citation-residue


─── line 5 ───────────────────────────────────────────────────

    oaicite

  ⚠  Chat citation residue

     "oaicite" is left over from a chat answer
     A link ending in "?utm_source=chatgpt.com" and a ":contentReference[oaicite:0]" are marks a chat answer leaves when it is pasted. This is not a matter of style: it shows the paste was never checked, and that nobody has confirmed the link supports the sentence it sits on.

     → Open the link and check it supports the sentence. If it does, keep the link and drop the "?utm_source=…" at its end. Delete citation marks (oaicite, contentReference).

     Relax this rule:  npx chaffjs relax chat-citation-residue


────────────────────────────────────────────────────────────

  3 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Office move: what we checked

The new building meets the step-free access standard for its entrance, lifts and toilets ([building survey](https://example.com/survey-2025)).

The landlord's quote covers cleaning and security but not the meeting room screens (see the quote, page two).

We recommend signing the lease before the end of the month, while the current rent holds.
```

## How it was fixed

The link ending in "?utm_source=chatgpt.com" and the ":contentReference[oaicite:0]{index=0}" mark are what a chat answer leaves when it is pasted.
They tell a careful reader that the paragraph came from a chat and that nobody checked it afterwards.
In a report that recommends signing a lease, that is the last thing it should say.

The fix opens the survey link, checks that it really supports the sentence, and keeps it without the tracking part.
The second mark pointed at nothing a reader could open, so it was replaced with the real source: the landlord's quote, which the team has in hand.
Deleting the marks without checking is the one fix chaff's advice warns against.

## Settings

At `strict` and `normal` the first one is reported; `relaxed` waits until there are 2.

A mention inside code (an article that explains the parameter in backticks) and other utm_source values ("newsletter") are not counted.

```yaml chaff-settings
rules:
  chat-citation-residue: relaxed
```

The rule runs in every genre.

```text chaff-explain
$ npx chaffjs explain chat-citation-residue --genre business/report

  Chat citation residue   (chat-citation-residue)

  A link ending in "?utm_source=chatgpt.com" and a ":contentReference[oaicite:0]" are marks a chat answer leaves when it is pasted. This is not a matter of style: it shows the paste was never checked, and that nobody has confirmed the link supports the sentence it sits on.

  How to fix: Open the link and check it supports the sentence. If it does, keep the link and drop the "?utm_source=…" at its end. Delete citation marks (oaicite, contentReference).

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once there are 1
  → normal   reported once there are 1
    relaxed  reported once there are 2
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax chat-citation-residue --why "reason"
```

[All samples](README.md)
