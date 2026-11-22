<!-- chaff-sample
rule: all-caps-shouting
genre: docs/manual
file: return.md
-->

# Shouting in capitals (`all-caps-shouting`)

**Where it helps:** instructions, notices, help pages. Any place where one warning matters more than the rest.

## Original

```markdown chaff-before
# Returning a rental van

Bring the van back to the depot by the time on your booking.
Park it in a marked bay and leave the key in the box by the gate.

PLEASE DO NOT LEAVE THE KEY IN THE VAN.
A van left with its key inside is not covered by the insurance, and you pay for any damage until we collect it.

Fill the tank before you return the van.
If the tank is not full, we charge for the missing fuel.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual return.md

return.md   docs/manual · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    PLEASE DO NOT LEAVE THE KEY IN THE VAN.

  ·  Shouting in capitals

     "PLEASE DO NOT LEAVE THE KEY IN THE VAN" is written in capitals
     Three or more ordinary words in capitals ("DO NOT DELETE THIS") read as shouting, and words in capitals are slower to read. To tell them from a run of acronyms (AWS IAM SSO), a run is reported only when at least half its words also appear in lower case elsewhere in the document.

     → Write it in ordinary case; to stress it, use bold or say why it matters.

     Relax this rule:  npx chaffjs relax all-caps-shouting


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Returning a rental van

Bring the van back to the depot by the time on your booking.
Park it in a marked bay and leave the key in the box by the gate.

**Do not leave the key in the van.**
A van left with its key inside is not covered by the insurance, and you pay for any damage until we collect it.

Fill the tank before you return the van.
If the tank is not full, we charge for the missing fuel.
```

## How it was fixed

The warning about the key is the most important line on the page, and the writer set it in capitals so nobody would miss it.
Capitals do stand out, but they read as shouting, and a line in capitals is slower to read than ordinary text: the word shapes that the eye knows are gone.

The fix writes the warning in ordinary case and makes it bold, which stands out just as well.
The sentence after it already says why it matters, the insurance, and that reason does more to make a customer take the key out than any capital letter.

## Settings

The rule looks for runs of three or more words in capitals.
To tell shouting from a row of acronyms (AWS IAM SSO), a run is reported only when at least half its words also appear in lower case elsewhere in the document; here "key" and "van" do.
Code, MUST and SHALL in a specification, and a heading word in capitals at the head of a paragraph ("AGENCY:") are not counted.

At the default level the first such run is reported; `relaxed` waits for two.

```yaml chaff-settings
rules:
  all-caps-shouting: relaxed
```

The rule runs only on English. It does not run on contracts, which set disclaimers in capitals so they are conspicuous, or on literature.

```text chaff-explain
$ npx chaffjs explain all-caps-shouting --genre docs/manual

  Shouting in capitals   (all-caps-shouting)

  Three or more ordinary words in capitals ("DO NOT DELETE THIS") read as shouting, and words in capitals are slower to read. To tell them from a run of acronyms (AWS IAM SSO), a run is reported only when at least half its words also appear in lower case elsewhere in the document.

  How to fix: Write it in ordinary case; to stress it, use bold or say why it matters.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once there is 1
  → normal   reported once there is 1
    relaxed  reported once there are 2
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax all-caps-shouting --why "reason"
```

[All samples](README.md)
