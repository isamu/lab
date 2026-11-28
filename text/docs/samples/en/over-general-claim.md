<!-- chaff-sample
rule: over-general-claim
genre: blog/essay
file: post.md
-->

# Too many sweeping claims about people (`over-general-claim`)

**Where it helps:** personal essays, opinion pieces, advice articles, blog posts.

## Original

```markdown chaff-before
# Why I print my train tickets

Most people keep their train tickets on their phone now.
I did too, until a Sunday in October when my phone died at the gate in Leeds and I had to buy a second ticket.

Nobody plans for a dead battery.
Everyone assumes the phone will last the day, and for most of us it usually does.
But a ticket on a phone depends on three things at once: the battery, the app, and a signal at the moment the app wants to check the ticket.

Since then I print every ticket the evening before, on the old printer in the hall.
It takes two minutes, and the folded paper goes in the same coat pocket as my keys and my wallet.
The phone still has a copy, so I have two ways through the gate instead of one.

Many people will find this old-fashioned, and anyone who travels with a power bank can ignore it.
For a trip where missing the train would cost me a night in a hotel, paper is the cheapest insurance I know.
The printer uses perhaps ten sheets a year for this, and I have not had to buy a second ticket since that Sunday.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/essay post.md

post.md   blog/essay · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    Most people keep their train tickets on their phone now.

  ·  Too many sweeping claims about people

     "most people" and other sweeping claims: 29.9 per 1000 words (limit 3)
     "Most people", "nobody", "everyone" and "for most of us" shorten a point when used once. Piled up, the document keeps making claims about people in general that it never checks, and the reader stops to ask "nobody at all?". A habit well known in generated text.

     → Narrow who you mean (your team, the 30 people you asked, the people who use this product). If you have a number, give it.

     Relax this rule:  npx chaffjs relax over-general-claim


─── line 6 ───────────────────────────────────────────────────

    Nobody plans for a dead battery.

  ·  Too many sweeping claims about people

     "nobody" and other sweeping claims: 29.9 per 1000 words (limit 3)
     "Most people", "nobody", "everyone" and "for most of us" shorten a point when used once. Piled up, the document keeps making claims about people in general that it never checks, and the reader stops to ask "nobody at all?". A habit well known in generated text.

     → Narrow who you mean (your team, the 30 people you asked, the people who use this product). If you have a number, give it.

     Relax this rule:  npx chaffjs relax over-general-claim


─── line 7 ───────────────────────────────────────────────────

    Everyone assumes the phone will last the day, and for most of us it usually does.

  ·  Too many sweeping claims about people

     "most of us" and other sweeping claims: 29.9 per 1000 words (limit 3)
     "Most people", "nobody", "everyone" and "for most of us" shorten a point when used once. Piled up, the document keeps making claims about people in general that it never checks, and the reader stops to ask "nobody at all?". A habit well known in generated text.

     → Narrow who you mean (your team, the 30 people you asked, the people who use this product). If you have a number, give it.

     Relax this rule:  npx chaffjs relax over-general-claim


─── line 14 ──────────────────────────────────────────────────

    Many people will find this old-fashioned, and anyone who travels with a power bank can ignore it.

  ·  Too many sweeping claims about people

     "many people" and other sweeping claims: 29.9 per 1000 words (limit 3)
     "Most people", "nobody", "everyone" and "for most of us" shorten a point when used once. Piled up, the document keeps making claims about people in general that it never checks, and the reader stops to ask "nobody at all?". A habit well known in generated text.

     → Narrow who you mean (your team, the 30 people you asked, the people who use this product). If you have a number, give it.

     Relax this rule:  npx chaffjs relax over-general-claim


────────────────────────────────────────────────────────────

  4 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Why I print my train tickets

I used to keep my train tickets on my phone.
Then, on a Sunday in October, my phone died at the gate in Leeds and I had to buy a second ticket.

I had never planned for a dead battery.
I assumed the phone would last the day, and it usually did.
But a ticket on a phone depends on three things at once: the battery, the app, and a signal at the moment the app wants to check the ticket.

Since then I print every ticket the evening before, on the old printer in the hall.
It takes two minutes, and the folded paper goes in the same coat pocket as my keys and my wallet.
The phone still has a copy, so I have two ways through the gate instead of one.

If you travel with a power bank, you may not need this.
For a trip where missing the train would cost me a night in a hotel, paper is the cheapest insurance I know.
The printer uses perhaps ten sheets a year for this, and I have not had to buy a second ticket since that Sunday.
```

## How it was fixed

"Most people", "Nobody plans", "Everyone assumes", "for most of us", "Many people", "anyone who": four sentences of a short post make claims about people in general that the post never checks.
A reader who keeps paper tickets, or who always plans for a dead battery, stops and thinks "not me", and the writer's real story (a dead phone at the gate in Leeds) loses its force.

The corrected post says what the writer knows: what they did, what they assumed, what happened.
The one sentence that was about other people now speaks to the reader directly and lets them decide ("If you travel with a power bank, you may not need this").
If you have a number (nine of the twelve people on our team), give it instead.

## Settings

The rule counts sweeping claims per 1000 words. It reports above three per 1000 words; `strict` above two and `relaxed` above five:

```yaml chaff-settings
rules:
  over-general-claim: relaxed
```

"Everyone" and "nobody" are not counted when the text says who they are (the team named in the sentence before, "everyone here"). "Most people agree" and "everyone knows" are left to `weasel-word`. Short documents are not measured, and the rule does not run on legal, documentation, academic, literature or speech genres. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score post.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain over-general-claim --genre blog/essay

  Too many sweeping claims about people   (over-general-claim)

  "Most people", "nobody", "everyone" and "for most of us" shorten a point when used once. Piled up, the document keeps making claims about people in general that it never checks, and the reader stops to ask "nobody at all?". A habit well known in generated text.

  How to fix: Narrow who you mean (your team, the 30 people you asked, the people who use this product). If you have a number, give it.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 2 sweeping claims per 1000 words
  → normal   up to 3 sweeping claims per 1000 words
    relaxed  up to 5 sweeping claims per 1000 words
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax over-general-claim --why "reason"
```

[All samples](README.md)
