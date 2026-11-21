<!-- chaff-sample
rule: nado-closed-list
genre: business/press-release
file: grant-notice.md
-->

# Open list that a limit closes (`nado-closed-list`)

**Where it helps:** notices, application guides, policies, terms. Anywhere a list decides whether something is covered.

## Original

```markdown chaff-before
# Small repairs grant for tenants' associations

The council is offering grants of up to £2,000 to tenants' associations for small repairs to shared spaces.
The grant covers paint, lighting, door locks, etc. only.
Applications open on 1 May and close on 30 June.

Send your application to the housing office with a quote from a builder.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release grant-notice.md

grant-notice.md   business/press-release · English   genre from --genre

─── line 4 ───────────────────────────────────────────────────

    The grant covers paint, lighting, door locks, etc. only.

  ⚠  Open list that a limit closes

     "etc." leaves the list open, but "only" closes it
     "Collection covers furniture, bedding, bicycles, etc. only" leaves the list open (etc.: there are others) and closes it (only: nothing else) in the same breath. The reader cannot tell whether something not named is covered, and in a notice or an application guide that decides whether a request is accepted. chaff reports "etc.", "and so on" and "and the like" right before "only", or at the end of a list that "only" or "limited to" governs.

     → If only the items named are covered, delete "etc.". If others are too, name them, or drop the limit ("Collection covers furniture, bedding, bicycles and similar items").

     Relax this rule:  npx chaffjs relax nado-closed-list


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Small repairs grant for tenants' associations

The council is offering grants of up to £2,000 to tenants' associations for small repairs to shared spaces.
The grant covers paint, lighting and door locks only.
Applications open on 1 May and close on 30 June.

Send your application to the housing office with a quote from a builder.
```

## How it was fixed

"Paint, lighting, door locks, etc. only" opens the list and closes it in the same breath.
"Etc." says there are more items; "only" says there are none.
An association that wants to fix a broken bench cannot tell whether to apply, and the housing office will get calls, or worse, applications it has to turn down.

The fix decides.
If only those three are covered, "etc." goes.
If other repairs count too, the notice should name them, or drop "only" and say "and similar small repairs".

## Settings

The rule reports "etc.", "and so on" and "and the like" right before "only", or at the end of a list that "only", "limited to" or "solely" governs.
It is a warning at `normal` and `strict`, and a note at `relaxed`:

```yaml chaff-settings
rules:
  nado-closed-list: relaxed
```

It does not run on literature or speech, where "and so on" is loose on purpose.
"Including but not limited to" and "not only" are not reported, nor is a list where "only" governs another word ("Only members may use the gym, the pool, etc.").

```text chaff-explain
$ npx chaffjs explain nado-closed-list --genre business/press-release

  Open list that a limit closes   (nado-closed-list)

  "Collection covers furniture, bedding, bicycles, etc. only" leaves the list open (etc.: there are others) and closes it (only: nothing else) in the same breath. The reader cannot tell whether something not named is covered, and in a notice or an application guide that decides whether a request is accepted. chaff reports "etc.", "and so on" and "and the like" right before "only", or at the end of a list that "only" or "limited to" governs.

  How to fix: If only the items named are covered, delete "etc.". If others are too, name them, or drop the limit ("Collection covers furniture, bedding, bicycles and similar items").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax nado-closed-list --why "reason"
```

[All samples](README.md)
