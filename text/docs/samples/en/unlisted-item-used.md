<!-- chaff-sample
rule: unlisted-item-used
genre: docs/manual
file: recipe.md
-->

# A step uses something the list of what you need leaves out (`unlisted-item-used`)

**Where it helps:** recipes, how-to guides with a "What you need" list, training exercises, lab instructions.

## Original

```markdown chaff-before
# Lemon drizzle traybake for the office bake sale

## Ingredients

- 225 g butter
- 225 g caster sugar
- 4 eggs
- 275 g self-raising flour
- 2 lemons

## Method

1. Beat the butter and the sugar until pale.
2. Beat in the eggs one at a time, then fold in the flour.
3. Add the grated zest of the lemons and the milk.
4. Bake at 180°C for 35 minutes.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual recipe.md

recipe.md   docs/manual · English   genre from --genre

─── line 15 ──────────────────────────────────────────────────

    the lemons and the milk. 4. Bake at 180°C f

  ⚠  A step uses something the list of what you need leaves out

     "milk" is not in Ingredients
     A reader who gathered everything on the "Ingredients" or "What you need" list stops halfway when a step calls for something the list does not have (pepper, a bucket). Either the list left it out or the step is wrong. Only a noun a numbered step uses is read: the object of a use verb ("add", "put", "stir in"), and, in a document whose list includes tools ("What you need", "Tools"), the thing after "with the" or "in a". It is not reported when the document has written it before the step (in the list, the title or an earlier step), whole or by its last word, nor when it is always at hand and never listed (water, hands, air).

     → Add it to the list, or rewrite the step with what the list has.

     Relax this rule:  npx chaffjs relax unlisted-item-used


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Lemon drizzle traybake for the office bake sale

## Ingredients

- 225 g butter
- 225 g caster sugar
- 4 eggs
- 275 g self-raising flour
- 2 lemons
- 4 tablespoons milk

## Method

1. Beat the butter and the sugar until pale.
2. Beat in the eggs one at a time, then fold in the flour.
3. Add the grated zest of the lemons and the milk.
4. Bake at 180°C for 35 minutes.
```

## How it was fixed

Step 3 says to add the milk, but milk is not on the ingredients list.
Someone baking for the sale on the morning before work gathers what the list says, starts mixing, and finds out at step 3 that they need something they do not have.

The fix adds the milk to the list, with the amount.
The other fix would be to remove it from the step, if it is not meant.
chaff reads only what a numbered step uses ("add", "put", "stir in"), and leaves out things always at hand, such as water.

## Settings

An item used but not listed is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your lists leave out common items on purpose, relax it:

```yaml chaff-settings
rules:
  unlisted-item-used: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

It is off for literature.

```text chaff-explain
$ npx chaffjs explain unlisted-item-used --genre docs/manual

  A step uses something the list of what you need leaves out   (unlisted-item-used)

  A reader who gathered everything on the "Ingredients" or "What you need" list stops halfway when a step calls for something the list does not have (pepper, a bucket). Either the list left it out or the step is wrong. Only a noun a numbered step uses is read: the object of a use verb ("add", "put", "stir in"), and, in a document whose list includes tools ("What you need", "Tools"), the thing after "with the" or "in a". It is not reported when the document has written it before the step (in the list, the title or an earlier step), whole or by its last word, nor when it is always at hand and never listed (water, hands, air).

  How to fix: Add it to the list, or rewrite the step with what the list has.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax unlisted-item-used --why "reason"
```

[All samples](README.md)
