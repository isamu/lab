<!-- chaff-sample
rule: internal-jargon
genre: business/email
file: reply.md
-->

# Words that only work inside (`internal-jargon`)

**Where it helps:** emails to customers and suppliers, public notices, handover notes for someone new. Anywhere the team's own shorthand travels outside the team.

## Original

```markdown chaff-before
Subject: Your order of garden chairs

Dear Ms. Patel,

Thank you for your order of six garden chairs.
The chairs are on the slow boat this month, so they will reach our warehouse around 20 May.
We will send you a delivery date once they are on the dock.

If you would rather have the chairs we have in stock today, just reply to this email.

Kind regards,
Sam Ortiz
Customer Service
```

```yaml chaff-config
jargon:
  - slow boat
  - on the dock
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email reply.md

reply.md   business/email · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    The chairs are on the slow boat this month, so they will reach our warehouse around 20 May.

  ⚠  Words that only work inside

     "slow boat" may only be understood inside your team (2 such words)
     A word that works inside one team does not work outside it, or six months later. Which words those are differs by team, so list them under `jargon` in chaff.yaml. With nothing listed, this rule says nothing.

     → Use ordinary words, or explain it in brackets at first use. A verb entered in its dictionary form also finds its other forms; a stem works too.

     Relax this rule:  npx chaffjs relax internal-jargon


─── line 7 ───────────────────────────────────────────────────

    We will send you a delivery date once they are on the dock.

  ⚠  Words that only work inside

     "on the dock" may only be understood inside your team (2 such words)
     A word that works inside one team does not work outside it, or six months later. Which words those are differs by team, so list them under `jargon` in chaff.yaml. With nothing listed, this rule says nothing.

     → Use ordinary words, or explain it in brackets at first use. A verb entered in its dictionary form also finds its other forms; a stem works too.

     Relax this rule:  npx chaffjs relax internal-jargon


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Your order of garden chairs

Dear Ms. Patel,

Thank you for your order of six garden chairs.
The chairs come by sea freight this month, so they will reach our warehouse around 20 May.
We will email you a delivery date as soon as they arrive.

If you would rather have the chairs we have in stock today, just reply to this email.

Kind regards,
Sam Ortiz
Customer Service
```

## How it was fixed

"The slow boat" and "on the dock" are everyday words in the warehouse team: one means sea freight, the other means the goods have arrived and been checked in.
Sam wrote them the way they are said at work, without noticing.
Ms. Patel cannot tell from "the slow boat" whether her chairs are late, and "on the dock" does not tell her when she will hear back.

The fix says the same things in words anyone can read: the chairs come by sea freight, and she gets an email when they arrive.
Nothing about the order changed; she no longer has to write back to ask what the email meant.

## Settings

The rule reads only the words listed under `jargon` in chaff.yaml. chaff ships no list of its own:
which words do not travel outside is something only your team knows, so the team writes them down and adds to the list as it notices more.

```yaml chaff-settings
jargon:
  # warehouse shorthand customers do not know
  - slow boat
  - on the dock
  - drop ship
  # meeting phrases that say little outside the room
  - circle back
  - take it offline
```

A word is matched as written, capital letters included, and also inside a longer word.
A verb written in its dictionary form finds its other forms too (`escalate` finds "escalated").
A listed word is one the team has already decided not to use with outsiders, so one is enough at `normal`.
For a team that writes mostly for itself, `relaxed` waits for three:

```yaml chaff-settings
rules:
  internal-jargon: relaxed
```

It runs in every genre. With nothing under `jargon`, it says nothing.

```text chaff-explain
$ npx chaffjs explain internal-jargon --genre business/email

  Words that only work inside   (internal-jargon)

  A word that works inside one team does not work outside it, or six months later. Which words those are differs by team, so list them under `jargon` in chaff.yaml. With nothing listed, this rule says nothing.

  How to fix: Use ordinary words, or explain it in brackets at first use. A verb entered in its dictionary form also finds its other forms; a stem works too.

  Levels:
    strict   reported once there is 1
  → normal   reported once there is 1
    relaxed  reported once there are 3
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax internal-jargon --why "reason"
```

[All samples](README.md)
