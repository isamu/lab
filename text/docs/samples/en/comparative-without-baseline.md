<!-- chaff-sample
rule: comparative-without-baseline
genre: business/press-release
file: release.md
-->

# A comparison with nothing to compare with (`comparative-without-baseline`)

**Where it helps:** press releases, product pages, release notes, proposals. Anywhere a claim of "better" has to be believed.

## Original

```markdown chaff-before
# Harbor Notes 4 is out today

Harbor Notes, the note-taking app for small teams, releases version 4 today.

We rebuilt the sync engine from the ground up. Sync is now faster.
Search was rewritten too, and finding an old note is easier.

Version 4 is a free update for every existing customer and is available on desktop and mobile from today.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release release.md

release.md   business/press-release · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    Sync is now faster.

  ·  A comparison with nothing to compare with

     "faster" does not say what it is compared with
     "Better results" and "the new engine is faster" leave the reader unable to check anything unless they say better or faster than what. Marketing copy is full of them: they sound like a claim and promise nothing. A comparative that closes a clause after a verb ("is faster.", "is more efficient.") is reported when neither its sentence nor the one before names what it is compared with ("than", "previous", "before").

     → Name what it is compared with ("is faster" becomes "is twice as fast as version 2"), or state the fact instead of comparing ("finishes in one second").

     Relax this rule:  npx chaffjs relax comparative-without-baseline


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Harbor Notes 4 is out today

Harbor Notes, the note-taking app for small teams, releases version 4 today.

We rebuilt the sync engine from the ground up. A change now reaches other devices in under a second, where version 3 took up to ten.
Search was rewritten too, and it now finds a note by any word in its attachments, not only by its title.

Version 4 is a free update for every existing customer and is available on desktop and mobile from today.
```

## How it was fixed

"Sync is now faster" and "finding an old note is easier" sound like news, but they promise nothing a reader can check.
Faster than what, and by how much? Every release of every app says the same, so a journalist or a customer reads past it.

The fix replaces each comparison with the fact behind it.
Sync names the old figure and the new one; search says what it can now do that it could not before.
The second needed no number at all: saying what changed made the comparison unnecessary.

## Settings

The rule reports a comparative that closes its clause ("is faster.", "is easier.") when neither its sentence nor the one before says what it is compared with ("than", "previous", "before").
It is a note at `normal` and `relaxed`, and a warning at `strict`.

```yaml chaff-settings
rules:
  comparative-without-baseline: strict
```

It does not run on literature or speech, where a comparison can lean on what the listener already has in mind.
"Even faster" (which goes past something just named), a comparison under a condition ("would be easier"), and an aim ("to make releases more predictable") are not reported.

```text chaff-explain
$ npx chaffjs explain comparative-without-baseline --genre business/press-release

  A comparison with nothing to compare with   (comparative-without-baseline)

  "Better results" and "the new engine is faster" leave the reader unable to check anything unless they say better or faster than what. Marketing copy is full of them: they sound like a claim and promise nothing. A comparative that closes a clause after a verb ("is faster.", "is more efficient.") is reported when neither its sentence nor the one before names what it is compared with ("than", "previous", "before").

  How to fix: Name what it is compared with ("is faster" becomes "is twice as fast as version 2"), or state the fact instead of comparing ("finishes in one second").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax comparative-without-baseline --why "reason"
```

[All samples](README.md)
