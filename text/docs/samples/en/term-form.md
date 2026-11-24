<!-- chaff-sample
rule: term-form
genre: docs/manual
file: release-steps.md
-->

# A term not written the listed way (`term-form`)

**Where it helps:** manuals, release notes, proposals and blog posts that name products, services and partners. Anywhere an AI draft or a quick edit can get the capitals of a name wrong.

## Original

```markdown chaff-before
# Publishing a release

1. Push the tag to Github and wait for the build to finish.
2. Check that the tests pass in node.js and that the Java Script bundle builds.
3. Write the release notes in the repository and publish them.

If the build fails, open an issue and ask in the team channel.
```

```yaml chaff-config
terms:
  - GitHub
  - Node.js
  - JavaScript
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual release-steps.md

release-steps.md   docs/manual · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    Push the tag to Github and wait for the build to finish.

  ⚠  A term not written the listed way

     Write "GitHub", not "Github"
     Product, company and technology names have one right form (GitHub, JavaScript). "Github", "ＧｉｔＨｕｂ" or "Java Script" reads as another thing, or as a writer who does not know the name, and a search misses it. AI drafts get the capitals of a name wrong often, and when the right form never appears in the document, the rules that compare spellings within it cannot see the slip. List the right forms under terms in chaff.yaml, and a form that differs only in case, width (full or half), hyphens or spaces is pointed out. With nothing listed, this rule does not run.

     → Change it to "GitHub". Where it must stay (a command, a file name, a quotation), silence it with stet and the reason.

     Relax this rule:  npx chaffjs relax term-form


─── line 4 ───────────────────────────────────────────────────

    Check that the tests pass in node.js and that the Java Script bundle builds.

  ⚠  A term not written the listed way

     Write "Node.js", not "node.js"
     Product, company and technology names have one right form (GitHub, JavaScript). "Github", "ＧｉｔＨｕｂ" or "Java Script" reads as another thing, or as a writer who does not know the name, and a search misses it. AI drafts get the capitals of a name wrong often, and when the right form never appears in the document, the rules that compare spellings within it cannot see the slip. List the right forms under terms in chaff.yaml, and a form that differs only in case, width (full or half), hyphens or spaces is pointed out. With nothing listed, this rule does not run.

     → Change it to "Node.js". Where it must stay (a command, a file name, a quotation), silence it with stet and the reason.

     Relax this rule:  npx chaffjs relax term-form


─── line 4 ───────────────────────────────────────────────────

    Check that the tests pass in node.js and that the Java Script bundle builds.

  ⚠  A term not written the listed way

     Write "JavaScript", not "Java Script"
     Product, company and technology names have one right form (GitHub, JavaScript). "Github", "ＧｉｔＨｕｂ" or "Java Script" reads as another thing, or as a writer who does not know the name, and a search misses it. AI drafts get the capitals of a name wrong often, and when the right form never appears in the document, the rules that compare spellings within it cannot see the slip. List the right forms under terms in chaff.yaml, and a form that differs only in case, width (full or half), hyphens or spaces is pointed out. With nothing listed, this rule does not run.

     → Change it to "JavaScript". Where it must stay (a command, a file name, a quotation), silence it with stet and the reason.

     Relax this rule:  npx chaffjs relax term-form


────────────────────────────────────────────────────────────

  3 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Publishing a release

1. Push the tag to GitHub and wait for the build to finish.
2. Check that the tests pass in Node.js and that the JavaScript bundle builds.
3. Write the release notes in the repository and publish them.

If the build fails, open an issue and ask in the team channel.
```

## How it was fixed

Each of the three names has one right form, and the page wrote each another way: "Github" with a small h, "node.js" without its capital, and "Java Script" as two words.
A reader who knows the products takes the page for careless; one who does not may copy the wrong form into the next page.

Nothing else in the page wrote these names, so the rules that compare one spelling with another had nothing to compare.
The team had listed the right forms under `terms` in chaff.yaml, and the fix writes each one as listed.

## Settings

The rule reads only the terms under `terms` in chaff.yaml, each written the one way it must be written.
chaff ships no terms of its own. A team takes them from the names it uses: its products, its partners, the tools it writes about.

```yaml chaff-settings
terms:
  # products and services the team writes about
  - GitHub
  - JavaScript
  - Node.js
  # the team's own names
  - Claude Code
```

A form that differs only in capital letters, full or half width, hyphens or spaces is pointed out: "github", "ＧｉｔＨｕｂ", "Java-Script", "ClaudeCode".
Code, URLs, e-mail addresses and file paths are left alone, so `github.com` and `docs/github.md` are not reported.
A listed term is one the team has already fixed, so one slip is enough at `normal`; `relaxed` waits for three:

```yaml chaff-settings
rules:
  term-form: relaxed
```

Where another form must stay, such as a command or a quotation, silence that one place with stet and the reason.
It runs in every genre. With nothing under `terms`, it does not run, and the list of rules that did not run says so.

```text chaff-explain
$ npx chaffjs explain term-form --genre docs/manual

  A term not written the listed way   (term-form)

  Product, company and technology names have one right form (GitHub, JavaScript). "Github", "ＧｉｔＨｕｂ" or "Java Script" reads as another thing, or as a writer who does not know the name, and a search misses it. AI drafts get the capitals of a name wrong often, and when the right form never appears in the document, the rules that compare spellings within it cannot see the slip. List the right forms under terms in chaff.yaml, and a form that differs only in case, width (full or half), hyphens or spaces is pointed out. With nothing listed, this rule does not run.

  How to fix: Change it to the form listed under terms. Where it must stay (a command, a file name, a quotation), silence it with stet and the reason.

  Levels:
    strict   reported once there is 1
  → normal   reported once there is 1
    relaxed  reported once there are 3
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax term-form --why "reason"
```

[All samples](README.md)
