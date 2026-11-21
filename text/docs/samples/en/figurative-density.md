<!-- chaff-sample
rule: figurative-density
genre: blog/tech
file: release-script.md
-->

# Too many decorative figures (`figurative-density`)

**Where it helps:** engineering blog posts, internal tool announcements, product copy.

## Original

```markdown chaff-before
# Setting up the new release script

Until last month, cutting a release took about forty minutes of copying version numbers between files by hand.
The new release script does it in one step. It works like magic.

You run it from the root of the repository with the version you want, for example `./release 2.4.0`.
The script is our secret sauce: it updates the version in the three files that hold it, writes the changelog heading, and makes the tag.
If a file still has uncommitted changes, it magically stops before touching anything.

The first time you run it, the script asks for the name of the release branch and saves it in `.release.json`.
After that, the one-line incantation is all you need, and the whole release runs like clockwork.

If something goes wrong halfway, run `./release --undo`.
It removes the tag, restores the three files from the last commit, and leaves the changelog as it was.
The script never pushes anything; you still push the tag yourself when you have checked the result.
That last step is on purpose, so a release never goes out without a person looking at it first.
Ask in the build channel if the script stops with a message you do not understand.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech release-script.md

release-script.md   blog/tech · English   genre from --genre

─── line 4 ───────────────────────────────────────────────────

    It works like magic.

  ·  Too many decorative figures

     "like magic" and other decorative figures: 25 per 1000 words
     A figure such as "works like magic", "a one-line incantation" or "our secret sauce" adds colour once. Piled up, the document goes on without saying what actually happens, and a reader who wants the mechanism gets only the figure. None of them is wrong alone, so the rule counts them per length of the document. The figures are in the lexicon figurative-phrase, each with what to write instead.

     → Replace the figure with what happens ("the config sets itself up like magic" becomes "the tool reads the config file and fills in the defaults").

     Relax this rule:  npx chaffjs relax figurative-density


─── line 7 ───────────────────────────────────────────────────

    The script is our secret sauce: it updates the version in the three files that hold it, writes the changelog heading, an…

  ·  Too many decorative figures

     "secret sauce" and other decorative figures: 25 per 1000 words
     A figure such as "works like magic", "a one-line incantation" or "our secret sauce" adds colour once. Piled up, the document goes on without saying what actually happens, and a reader who wants the mechanism gets only the figure. None of them is wrong alone, so the rule counts them per length of the document. The figures are in the lexicon figurative-phrase, each with what to write instead.

     → Replace the figure with what happens ("the config sets itself up like magic" becomes "the tool reads the config file and fills in the defaults").

     Relax this rule:  npx chaffjs relax figurative-density


─── line 8 ───────────────────────────────────────────────────

    If a file still has uncommitted changes, it magically stops before touching anything.

  ·  Too many decorative figures

     "magically" and other decorative figures: 25 per 1000 words
     A figure such as "works like magic", "a one-line incantation" or "our secret sauce" adds colour once. Piled up, the document goes on without saying what actually happens, and a reader who wants the mechanism gets only the figure. None of them is wrong alone, so the rule counts them per length of the document. The figures are in the lexicon figurative-phrase, each with what to write instead.

     → Replace the figure with what happens ("the config sets itself up like magic" becomes "the tool reads the config file and fills in the defaults").

     Relax this rule:  npx chaffjs relax figurative-density


─── line 11 ──────────────────────────────────────────────────

    After that, the one-line incantation is all you need, and the whole release runs like clockwork.

  ·  Too many decorative figures

     "incantation" and other decorative figures: 25 per 1000 words
     A figure such as "works like magic", "a one-line incantation" or "our secret sauce" adds colour once. Piled up, the document goes on without saying what actually happens, and a reader who wants the mechanism gets only the figure. None of them is wrong alone, so the rule counts them per length of the document. The figures are in the lexicon figurative-phrase, each with what to write instead.

     → Replace the figure with what happens ("the config sets itself up like magic" becomes "the tool reads the config file and fills in the defaults").

     Relax this rule:  npx chaffjs relax figurative-density


─── line 11 ──────────────────────────────────────────────────

    After that, the one-line incantation is all you need, and the whole release runs like clockwork.

  ·  Too many decorative figures

     "like clockwork" and other decorative figures: 25 per 1000 words
     A figure such as "works like magic", "a one-line incantation" or "our secret sauce" adds colour once. Piled up, the document goes on without saying what actually happens, and a reader who wants the mechanism gets only the figure. None of them is wrong alone, so the rule counts them per length of the document. The figures are in the lexicon figurative-phrase, each with what to write instead.

     → Replace the figure with what happens ("the config sets itself up like magic" becomes "the tool reads the config file and fills in the defaults").

     Relax this rule:  npx chaffjs relax figurative-density


────────────────────────────────────────────────────────────

  5 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Setting up the new release script

Until last month, cutting a release took about forty minutes of copying version numbers between files by hand.
The new release script does it in one step.

You run it from the root of the repository with the version you want, for example `./release 2.4.0`.
The script updates the version in the three files that hold it, writes the changelog heading, and makes the tag.
If a file still has uncommitted changes, it stops before touching anything and names the file.

The first time you run it, the script asks for the name of the release branch and saves it in `.release.json`.
After that, the version number is all you need.

If something goes wrong halfway, run `./release --undo`.
It removes the tag, restores the three files from the last commit, and leaves the changelog as it was.
The script never pushes anything; you still push the tag yourself when you have checked the result.
That last step is on purpose, so a release never goes out without a person looking at it first.
Ask in the build channel if the script stops with a message you do not understand.
```

## How it was fixed

"Works like magic", "our secret sauce", "magically stops", "the one-line incantation", "runs like clockwork": five figures in a short post about a script.
Each adds a little colour, but the reader who wants to know what the script does gets the figure instead. "It magically stops" hides the useful part: it stops, and it says which file is the problem.

The fix replaces each figure with what happens, or deletes it when the sentence around it already says it.
The post now reads as a description of a tool a colleague can trust, not an advertisement for it.

## Settings

The rule counts figures listed in the lexicon `figurative-phrase` ("like magic", "secret sauce", "silver bullet"…), per 1000 words. It reports above two per 1000 words; `strict` above one and `relaxed` above three:

```yaml chaff-settings
rules:
  figurative-density: relaxed
```

A plain comparison or example is not counted, and short documents are not measured. It does not run on literature or speech, where figures are the writer's choice.

```text chaff-explain
$ npx chaffjs explain figurative-density --genre blog/tech

  Too many decorative figures   (figurative-density)

  A figure such as "works like magic", "a one-line incantation" or "our secret sauce" adds colour once. Piled up, the document goes on without saying what actually happens, and a reader who wants the mechanism gets only the figure. None of them is wrong alone, so the rule counts them per length of the document. The figures are in the lexicon figurative-phrase, each with what to write instead.

  How to fix: Replace the figure with what happens ("the config sets itself up like magic" becomes "the tool reads the config file and fills in the defaults").

  Rewrite depth: register (the style is converted: polite to plain endings, comparatives removed and so on). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 1 decorative figures per 1000 words
  → normal   up to 2 decorative figures per 1000 words
    relaxed  up to 3 decorative figures per 1000 words
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax figurative-density --why "reason"
```

[All samples](README.md)
