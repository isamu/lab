<!-- chaff-sample
rule: announcing-opener
genre: blog/tech
file: post.md
-->

# Too many sentences that announce before they say (`announcing-opener`)

**Where it helps:** blog posts, team updates, advice articles. Writing that wants each point to land.

## Original

```markdown chaff-before
# Running a meeting with people in three time zones

Our team is spread over London, Toronto and Singapore, and for a year our weekly meeting was at a time that suited nobody.

The key point is that the meeting does not have to be weekly.
We now meet every other Thursday, at 13:00 in London, which is 8:00 in Toronto and 21:00 in Singapore.
The two weeks in between are covered by a written update in the team channel.
Nobody has to stay up late.

Here's the thing: the written update is where most of the work now happens.
Each person posts three lines by Tuesday evening: what they finished, what is next, and where they are stuck.
Anyone who is stuck gets a reply before Thursday.

What surprised me most was that the meeting itself got shorter.
It used to run an hour and now ends in thirty minutes, because the updates have already been read.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech post.md

post.md   blog/tech · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    The key point is that the meeting does not have to be weekly.

  ·  Too many sentences that announce before they say

     "The key point is" and other announcing openers start 3 sentences (3 needed)
     "The key point is", "Here's the thing" and "Honestly," announce a point before making it. Once, that is a signpost; piled up, every sentence claims the same weight and the announcements are all that stand out. A habit well known in generated text.

     → Delete the announcement and start with the point. If it really is the one point that matters most, keep that one.

     Relax this rule:  npx chaffjs relax announcing-opener


─── line 10 ──────────────────────────────────────────────────

    Here's the thing: the written update is where most of the work now happens.

  ·  Too many sentences that announce before they say

     "Here's the thing" and other announcing openers start 3 sentences (3 needed)
     "The key point is", "Here's the thing" and "Honestly," announce a point before making it. Once, that is a signpost; piled up, every sentence claims the same weight and the announcements are all that stand out. A habit well known in generated text.

     → Delete the announcement and start with the point. If it really is the one point that matters most, keep that one.

     Relax this rule:  npx chaffjs relax announcing-opener


─── line 14 ──────────────────────────────────────────────────

    What surprised me most was that the meeting itself got shorter.

  ·  Too many sentences that announce before they say

     "What surprised me most was" and other announcing openers start 3 sentences (3 needed)
     "The key point is", "Here's the thing" and "Honestly," announce a point before making it. Once, that is a signpost; piled up, every sentence claims the same weight and the announcements are all that stand out. A habit well known in generated text.

     → Delete the announcement and start with the point. If it really is the one point that matters most, keep that one.

     Relax this rule:  npx chaffjs relax announcing-opener


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Running a meeting with people in three time zones

Our team is spread over London, Toronto and Singapore, and for a year our weekly meeting was at a time that suited nobody.

The meeting does not have to be weekly.
We now meet every other Thursday, at 13:00 in London, which is 8:00 in Toronto and 21:00 in Singapore.
The two weeks in between are covered by a written update in the team channel.
Nobody has to stay up late.

Most of the work now happens in that written update.
Each person posts three lines by Tuesday evening: what they finished, what is next, and where they are stuck.
Anyone who is stuck gets a reply before Thursday.

The meeting itself got shorter.
It used to run an hour and now ends in thirty minutes, because the updates have already been read.
```

## How it was fixed

"The key point is", "Here's the thing" and "What surprised me most was" each tell the reader that something important is coming.
Three of them in a short post means three sentences all claim to be the most important one, so none of them is.
The reader also has to get past the announcement before reaching the point.

The fix deletes each announcement and starts the sentence with what came after it.
Nothing was lost: "The meeting does not have to be weekly" is just as strong without "The key point is that" in front of it.
If one point in a post really matters more than the rest, one announcement on that point can stay.

## Settings

The rule counts sentences that open with an announcing phrase. It reports from three; `strict` reports from two and `relaxed` from five:

```yaml chaff-settings
rules:
  announcing-opener: strict
```

An announcing phrase in the middle of a sentence is not counted. The rule does not run on legal, documentation, literature or speech genres. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score post.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain announcing-opener --genre blog/tech

  Too many sentences that announce before they say   (announcing-opener)

  "The key point is", "Here's the thing" and "Honestly," announce a point before making it. Once, that is a signpost; piled up, every sentence claims the same weight and the announcements are all that stand out. A habit well known in generated text.

  How to fix: Delete the announcement and start with the point. If it really is the one point that matters most, keep that one.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once 2 sentences open with an announcement
  → normal   reported once 3 sentences open with an announcement
    relaxed  reported once 5 sentences open with an announcement
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax announcing-opener --why "reason"
```

[All samples](README.md)
