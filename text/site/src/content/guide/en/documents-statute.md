# Internal rules and regulations

Internal rules and regulations number their articles and refer from one article to another.
chaff checks by machine that those numbers and references fit together.
The genre is `legal/statute`. Statutes and official notices are checked under the same genre.

## What usually goes wrong

Rules are amended by deleting and adding articles, and each time the numbers and references can drift apart.

| What goes wrong | Example |
| --- | --- |
| A number is skipped | Article 3 was deleted and nothing was renumbered (Article 4 follows Article 2) |
| A reference points nowhere | "the register provided for in Article 9", when there is no Article 9 |
| A term is defined twice | "equipment" is defined in Article 1 and again in Article 4, and the two disagree |

In each case the reader cannot tell which is right, and has to ask whoever wrote it.
The longer the rules, the more of these a person reading by eye will miss.

## What chaff checks, and what it does not

These rules run for this genre. Each one reads the document as a tree of numbered addresses.

| Rule | What it finds |
| --- | --- |
| `numbering-gap` | A number skipped or used twice |
| `dangling-reference` | A reference to an article that is not in the document |
| `duplicate-definition` | A term defined in two places |
| `date-weekday-mismatch` | A weekday written next to a date that does not match the calendar |
| `total-mismatch` | A total that is not the sum of its items |
| `dangling-figure-reference` | A reference to a figure, table or appendix (Figure 3, Appendix B) the document does not label |
| `date-range-reversed` | A period whose end date comes before its start date |

Some things are left out on purpose.

- chaff never rewrites the text. Fixing is the writer's job.
- It does not judge whether a rule is sensible or lawful. That takes a person reading it.
- It does not decide which of two definitions is right. It only points at the second one.
- It stays quiet on a reference whose target it cannot pin down, such as "the preceding article" in Article 1, rather than guess.
- A reference that names another document ("Article 9 of the Travel Rules") points outside, so chaff does not look for it here.
- It does not flag passives or long sentences. In rules, that is how they are written.

## Try it

If you have not set up yet, do [Getting ready](./documents#getting-ready) first.
The rules below were saved as `rules.md`, with three slips put in.

```markdown file=rules.md
# Equipment Management Rules

## Article 1 (Purpose)

These rules set out how company equipment is lent and returned.
2 In these rules, "equipment" means computers, cameras and other devices owned by the company.

## Article 2 (Lending)

An employee may borrow equipment by signing the register provided for in Article 9.

## Article 4 (Return)

Borrowed equipment must be returned within 7 days of the day it was borrowed.
2 In these rules, "equipment" means devices worth 10,000 yen or more.
```

In the folder that holds the document, type:

```bash
npx chaffjs rules.md --genre legal/statute    check rules.md as internal rules
```

The screen shows:

```
$ npx chaffjs rules.md --genre legal/statute

Guide: Statute and regulation (legal/statute)

  Before the findings below, check the draft against these.

  - Is every term from the definitions used in exactly its defined form?
  - Are sections numbered without gaps or repeats, and does every cross-reference point to one that exists?
  - Are duties (shall), prohibitions (shall not), powers (may) and best-effort duties written apart?
  - Can the scope, the exceptions (provided that) and the date of effect be found?

  Rules that matter most for this genre: dangling-figure-reference, dangling-reference, date-range-reversed, date-weekday-mismatch, defined-name-repeated, duplicate-definition, numbering-gap, total-mismatch
  Change it with guide: in chaff.yaml; leave it out with --no-guide.

════════════════════════════════════════════════════════════

rules.md   legal/statute · English   genre from --genre

─── line 10 ──────────────────────────────────────────────────

    Article 9.

  ✖  Reference to a missing provision

     "Article 9" (address 9) is not in this document
     A reference such as "as set out in Section 12" leaves the reader at a dead end when that section is not in the document. It usually happens when a provision is deleted or renumbered and the reference keeps the old number. chaff builds the document's tree of addresses (chaff tree) and checks that each reference's address is in it. A Japanese reference counted in 条 (法第2条) is not looked up in a document that numbers none of its provisions with 条, such as a guideline whose headings read "1 目的", because it points into another document.

     → Fix the number or remove the reference. If it points into another document, name that document so the reader knows where to look.

     Relax this rule:  npx chaffjs relax dangling-reference


─── line 12 ──────────────────────────────────────────────────

    ## Article 4 (Return)

  ✖  Skipped or repeated number

     "Article 4" follows "Article 2" (expected number 3)
     Article 5 right after Article 3, (c) right after (a), two paragraphs numbered 2. A reader cannot tell whether something was removed, or which one a reference means. Only numbers side by side under the same parent are compared. The numbers written on a Markdown ordered list (steps "1.", "2.", "4.") are compared too. The page renders them counted from the first, but the source and a "see step 4" use the numbers as written.

     → Renumber. If a provision was removed on purpose, keep its number with a note such as "Section 4 [Deleted]".

     Relax this rule:  npx chaffjs relax numbering-gap


─── line 15 ──────────────────────────────────────────────────

    "equipment" means devices worth 10,000 yen or more.

  ⚠  Term defined twice

     "equipment" is also defined on line 6
     A term defined in two places makes the reader check whether the two definitions agree. In long contracts a definition added later often drifts from the first. Whether they conflict is not something a machine can decide, so chaff only points at the second one. A heading that names the term is not counted as a definition.

     → Keep one definition and refer to it from the other place. If the meaning changes on purpose, use a different term.

     Relax this rule:  npx chaffjs relax duplicate-definition


────────────────────────────────────────────────────────────

  2 errors, 1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.

  {not-run}

AI-likeness: not scored (too short: 66 words; scored from 200)
```

## What each finding means

There are three findings. `✖` is an error and `⚠` a warning.
Under each line number, chaff shows the sentence from the point it is about.

| Line | Finding | What it means | How to fix the text |
| --- | --- | --- | --- |
| 10 | Reference to a missing provision | There is no Article 9 in these rules | Correct the number, or add the article about the register |
| 12 | Skipped or repeated number | Article 4 follows Article 2; there is no Article 3 | Renumber. To keep a gap on purpose, write "Article 3 (Deleted)" |
| 15 | Term defined twice | "equipment" is also defined on line 6 | Keep one definition and drop the other |

## The guide at the top

The screen above opens with the genre's guide: what good internal rules do, as questions to check the draft against, and the rules that matter most for this genre.
chaff prints it because the genre was set with `--genre`.
Most of the questions are ones no rule can answer, so read them before the findings.
An AI that rewrites the text works to the same lines ([Using the guide with an AI](./ai-sounding#give-the-ai-the-genres-guide)).

A guessed or default genre prints no guide, and `--compact` and `--no-guide` leave it out.
A team changes the lines with `guide:` in `chaff.yaml` ([Changing the genre's guide](./configuration#changing-the-genres-guide)).

## Reading the "did not run" list

At the end, the screen lists the rules it did not use this time, each with its reason.
That way "no findings" is never mistaken for "checked everything and found nothing". There are three reasons.

| Reason | What it means |
| --- | --- |
| the legal/statute genre does not check it | Rules are written that way on purpose, so this genre leaves it out |
| not a rule for en | The rule is for Japanese documents only |
| still experimental | The rule is new and not yet measured on documents people wrote. `--experimental` turns it on |

## Not typing the genre every time

Without `--genre`, chaff reads the document as a technical article (`blog/tech`).
For this sample, that means no findings at all, because the rules about article numbers do not run.

```
$ npx chaffjs rules.md

rules.md   blog/tech · English   genre from the default

─── line 10 ──────────────────────────────────────────────────

    Article 9.

  ✖  Reference to a missing provision

     "Article 9" (address 9) is not in this document
     A reference such as "as set out in Section 12" leaves the reader at a dead end when that section is not in the document. It usually happens when a provision is deleted or renumbered and the reference keeps the old number. chaff builds the document's tree of addresses (chaff tree) and checks that each reference's address is in it. A Japanese reference counted in 条 (法第2条) is not looked up in a document that numbers none of its provisions with 条, such as a guideline whose headings read "1 目的", because it points into another document.

     → Fix the number or remove the reference. If it points into another document, name that document so the reader knows where to look.

     Relax this rule:  npx chaffjs relax dangling-reference


─── line 12 ──────────────────────────────────────────────────

    ## Article 4 (Return)

  ✖  Skipped or repeated number

     "Article 4" follows "Article 2" (expected number 3)
     Article 5 right after Article 3, (c) right after (a), two paragraphs numbered 2. A reader cannot tell whether something was removed, or which one a reference means. Only numbers side by side under the same parent are compared. The numbers written on a Markdown ordered list (steps "1.", "2.", "4.") are compared too. The page renders them counted from the first, but the source and a "see step 4" use the numbers as written.

     → Renumber. If a provision was removed on purpose, keep its number with a note such as "Section 4 [Deleted]".

     Relax this rule:  npx chaffjs relax numbering-gap


─── line 15 ──────────────────────────────────────────────────

    "equipment" means devices worth 10,000 yen or more.

  ⚠  Term defined twice

     "equipment" is also defined on line 6
     A term defined in two places makes the reader check whether the two definitions agree. In long contracts a definition added later often drifts from the first. Whether they conflict is not something a machine can decide, so chaff only points at the second one. A heading that names the term is not counted as a definition.

     → Keep one definition and refer to it from the other place. If the meaning changes on purpose, use a different term.

     Relax this rule:  npx chaffjs relax duplicate-definition


────────────────────────────────────────────────────────────

  2 errors, 1 warning   All judged by machine
…
```

When a document clearly looks like another kind, chaff says so under the first line and suggests a genre.
This short sample does not, so it is safer to set the genre for the folder once:

```bash
npx chaffjs init --genre legal/statute    create chaff.yaml here, with the genre in it
```

After saying it created `chaff.yaml` (the settings file) and `.gitignore`, it shows:

```
The genre is legal/statute. If that is wrong, change genre in chaff.yaml.
  List: npx chaffjs genres

Next:
  npx chaffjs .            check every Markdown file here
```

From then on, `npx chaffjs rules.md` in this folder checks the file as internal rules.

## Silencing one spot on purpose

Sometimes a finding is right, but the spot is that way on purpose.
Say Article 3 was deleted, but other rules cite Article 4, so the numbers must not change.
Put this line just above that heading:

```markdown
<!-- stet: numbering-gap — Article 3 was deleted; other rules cite Article 4, so the numbers stay -->
## Article 4 (Return)
```

`stet` marks a spot whose finding is silenced. Write the reason after `—`.
It is a Markdown comment, so nobody opening the document sees it.
Run it again and the numbering finding is gone, and the first line counts what was silenced.
Here `--compact` prints each finding on two lines.

<!-- chaff-screen: stet -->
```
$ npx chaffjs rules.md --genre legal/statute --compact

rules.md   legal/statute · English   genre from --genre   1 stet

  10:74   error   "Article 9" (address 9) is not in this document
                  dangling-reference
  16:19   warning "equipment" is also defined on line 6
                  duplicate-definition

{counts}
```

## Changing a rule for the whole team

When it is not one spot but how your team works, change the rule instead.
If your team keeps the numbers of deleted articles, a gap in the numbering is not a mistake.
Type `relax` with a reason.

```bash
npx chaffjs relax numbering-gap --why "we keep the numbers of deleted articles"
```

It prints:

```
Set numbering-gap to relaxed (…/chaff.yaml)
This rule has no numeric limit: its findings still show, as a warning instead of an error.
```

The rules about article numbers do not count anything; a number is either skipped or it is not.
So relaxing one lowers how its findings are marked, by one step. The finding stays, so the gap is still in view.
The rule is added to `chaff.yaml`, with the reason, the date and who typed it:

```yaml
  # Skipped or repeated number
  # Article 5 right after Article 3, (c) right after (a), two paragraphs numbered 2. A reader cannot tell whether something was removed, or which one a reference means. Only numbers side by side under the same parent are compared.
  numbering-gap: relaxed # 2026-09-30 we keep the numbers of deleted articles / isamu
```

Run it again on `rules.md` without the stet, and the numbering finding is a `warning` instead of an `error`.

<!-- chaff-screen: relaxed -->
```
$ npx chaffjs rules.md --compact

rules.md   legal/statute · English   genre from chaff.yaml

  10:74   error   "Article 9" (address 9) is not in this document
                  dangling-reference
  12:1    warning "Article 4" follows "Article 2" (expected number 3)
                  numbering-gap
  15:19   warning "equipment" is also defined on line 6
                  duplicate-definition

{counts}
```

chaff fails when any error is left, and passes when there are only warnings, so a warning does not stop CI.
The error left here is the reference to Article 9, which does not exist.

If gaps in the numbering need no checking at all, turn the rule off instead.

```bash
npx chaffjs off numbering-gap --why "article numbers are kept in a separate register"
```

A rule turned off appears in the "did not run" list as "turned off in the settings".
Either way the reason stays in the file, so whoever comes later can see why the rule was changed.

## After fixing

The articles were renumbered, the article about the register was added, and the definition was kept in Article 1 only.

```markdown file=rules-fixed.md
# Equipment Management Rules

## Article 1 (Purpose)

These rules set out how company equipment is lent and returned.
2 In these rules, "equipment" means computers, cameras and other devices owned by the company and worth 10,000 yen or more.

## Article 2 (Lending)

An employee may borrow equipment by signing the register provided for in Article 4.

## Article 3 (Return)

Borrowed equipment must be returned within 7 days of the day it was borrowed.

## Article 4 (Register)

The General Affairs Department keeps a register of the equipment lent and returned.
```

<!-- chaff-screen: relaxed -->
```
$ npx chaffjs rules-fixed.md --genre legal/statute

Guide: Statute and regulation (legal/statute)

  Before the findings below, check the draft against these.

  - Is every term from the definitions used in exactly its defined form?
  - Are sections numbered without gaps or repeats, and does every cross-reference point to one that exists?
  - Are duties (shall), prohibitions (shall not), powers (may) and best-effort duties written apart?
  - Can the scope, the exceptions (provided that) and the date of effect be found?

  Rules that matter most for this genre: dangling-figure-reference, dangling-reference, date-range-reversed, date-weekday-mismatch, defined-name-repeated, duplicate-definition, numbering-gap, total-mismatch
  Change it with guide: in chaff.yaml; leave it out with --no-guide.

════════════════════════════════════════════════════════════

rules-fixed.md   legal/statute · English   genre from --genre

────────────────────────────────────────────────────────────

  No findings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.

  {not-run}
…
```

The "did not run" list below this is the same as before.

## What to read next

- To see the document as a tree of addresses, read [Structure and quotations](./structure).
- How to read the screen, and the three ways to respond to a finding, are in [Getting started](./getting-started).
- Every rule is explained in the [rule reference](../../rules/).
- For another kind of document, go back to [What chaff does for each kind of document](./documents).
