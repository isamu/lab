<!-- chaff-sample
rule: unqualified-superlative
genre: business/press-release
file: bike-launch.md
-->

# Superlative with nothing to compare (`unqualified-superlative`)

**Where it helps:** press releases, product pages, proposals, sales emails. Anywhere a claim has to stand up to a sceptical reader.

## Original

```markdown chaff-before
# Northgate Cycles launches the Commuter 3

Northgate Cycles today launches the Commuter 3, an electric bike for city riders.
It is the fastest to charge and the most reliable.

The Commuter 3 goes on sale in our shops and online on 1 April, priced at £1,450.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release bike-launch.md

bike-launch.md   business/press-release · English   genre from --genre

─── line 4 ───────────────────────────────────────────────────

    It is the fastest to charge and the most reliable.

  ⚠  Superlative with nothing to compare

     "the fastest" has nothing to compare against (2 such claims)
     "The fastest" without saying than what leaves the reader nothing to check.

     → Name the comparison. "The fastest of the three options we tried."

     Relax this rule:  npx chaffjs relax unqualified-superlative


─── line 4 ───────────────────────────────────────────────────

    It is the fastest to charge and the most reliable.

  ⚠  Superlative with nothing to compare

     "the most" has nothing to compare against (2 such claims)
     "The fastest" without saying than what leaves the reader nothing to check.

     → Name the comparison. "The fastest of the three options we tried."

     Relax this rule:  npx chaffjs relax unqualified-superlative


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Northgate Cycles launches the Commuter 3

Northgate Cycles today launches the Commuter 3, an electric bike for city riders.
It charges in two and a half hours, the fastest of any bike in our range, and its battery kept 90 per cent of its capacity after 800 charges in our tests.

The Commuter 3 goes on sale in our shops and online on 1 April, priced at £1,450.
```

## How it was fixed

"The fastest to charge" and "the most reliable" claim first place without saying among what.
A journalist cannot check either, a customer has heard both before, and a competitor with a quicker charger can make the press release look careless.

The fix gives each claim its scope or its evidence: the charging time, the fastest in Northgate's own range, and the battery test that stands behind "reliable".
The claims are smaller, and now someone can believe them.

## Settings

The rule counts superlatives with no comparison or scope in their sentence.
At `normal` it reports once a document has two; `strict` reports the first, and `relaxed` waits for four.
Tech blogs have numbers of their own: there, `normal` reports the first one.

```yaml chaff-settings
rules:
  unqualified-superlative: relaxed
```

A superlative with its scope ("in our range", "than last year"), one in quotation marks, in a question, or in a set phrase ("the most recent", "make the most of") is not reported.
It does not run on speech transcripts, technical documents, manuals or contracts.

```text chaff-explain
$ npx chaffjs explain unqualified-superlative --genre business/press-release

  Superlative with nothing to compare   (unqualified-superlative)

  "The fastest" without saying than what leaves the reader nothing to check.

  How to fix: Name the comparison. "The fastest of the three options we tried."

  Levels:
    strict   reported once there is 1 such claim
  → normal   reported once there are 2 such claims
    relaxed  reported once there are 4 such claims
    off      not checked

  These numbers are the default ones, which business/press-release takes. blog/tech has numbers of its own.

  Now: normal.

  Change it:  npx chaffjs relax unqualified-superlative --why "reason"
```

[All samples](README.md)
