---
name: chaff
description: "Check prose with chaff (npx chaffjs): pick the genre preset for the kind of document (contract, statute, manual, FAQ, paper, fiction, transcript…), run it on Markdown or text, read each finding, fix the text or record why not, and tune chaff.yaml with rules --json and relax --why. Use when asked to lint, proofread or tighten documents, or to set up a team's writing rules. Also use when asked to make text sound less AI-generated (「AIっぽさをなくして」「AI臭さを消して」「人間らしく書き直して」, 'make this sound human'): Light, Bold or Full mode, with Full (全面書き直し) when the request says 「全面的に」 or 'from scratch'."
---

# Checking writing with chaff

chaff finds what makes writing hard to read — long sentences, padding, mixed styles, broken references in a
contract — and never rewrites anything. Reading the findings and changing the text is your part. Japanese and
English documents both work; the language is detected per file.

## Pick the genre first

A genre is a preset for one kind of document: which rules run, where their limits are, and how the document is
read. A contract checked as a blog post gets wrong findings, so choose the genre before reading any finding.

1. Name the kind from the document itself. `npx chaffjs genres` lists every genre with what it is for:
   `legal/contract`, `legal/statute`, `docs/manual`, `docs/faq`, `academic/paper`, `literature/fiction`,
   `speech/transcript`, `business/report`, `technical/spec`, …
2. Unsure? Run once without `--genre`. When the file looks like another kind, the line under the header says so
   (`Looks like: Contract and terms. Try --genre legal/contract`); use that genre if it fits.
3. Run with it: `npx chaffjs --genre legal/contract contract.md`. For a folder of one kind,
   `npx chaffjs init --genre legal/contract` writes it into `chaff.yaml` (always pass `--genre`: without it,
   `init` asks at a terminal).
4. The header's first line shows the genre used and where it came from. Check it before trusting the findings.

A rule the genre turns off is listed under "did not run" with the genre as the reason. That is the preset's
choice, not a gap; turn it back on (`rules:` in `chaff.yaml`) only when the person asks.

## Run it

```sh
npx chaffjs --genre <genre> <file|dir|glob>...   # human-readable, one block per finding (a folder or glob picks up .md / .markdown / .mdx; name a .txt file directly)
npx chaffjs . --compact                          # two lines per finding: line:col severity message, then the rule id
npx chaffjs <file> --experimental                # also the experimental rules
```

A run exits 1 when a finding is an `error`. It also exits 1 when it could not check anything: no file to
check, an unknown `--genre`, no package for the language. So a clean exit means the files were checked.

After the findings comes the list of rules that did not run, and why. Only the default output shows it;
`--compact` gives just their number. Read it before saying a document is clean.

A run over several files prints only the files that have findings. To call one file clean, run chaff on that
file alone and read its list.

## For each finding, choose one of three

| | When | How |
| --- | --- | --- |
| Fix the text | The finding is right | Edit the sentence. Keep the meaning, the facts and the numbers; change only how it is said. |
| Silence that spot | Right in general, wrong here (a quotation, a term that must repeat) | `<!-- stet: rule-id — reason -->` before it; `stet-section` / `stet-file` for wider scope. Always give the reason. |
| Change the rule | Wrong for this team or genre | `npx chaffjs relax <rule-id> --why "reason"` (or `strict` / `off`). The reason and date are written into `chaff.yaml`. |

`npx chaffjs explain <rule-id>` shows why a rule exists, its levels and the current one. Read it before
relaxing a rule.

## Tune chaff.yaml

- `npx chaffjs init --genre <genre>` writes a commented `chaff.yaml` for that genre when there is none (an
  existing one is left as it is), and adds `.chaff-cache/` and `.env*` to `.gitignore`.
- `npx chaffjs rules --json [--genre <genre>]` prints every rule with its levels, the setting in effect (`now`,
  the genre's preset included) and why a rule is off. Read it instead of guessing rule names or limits.
  `npx chaffjs rules` shows the same as a table, grouped, with the level each rule runs at now.
- A level is `strict` / `normal` / `relaxed` / `off`; when even `relaxed` is too tight, a positive number is the
  limit itself (`max-sentence-length: 260`).
- `prefer:` maps spellings to the team's (`e-mail: email`); `preferred-term: normal` turns the rule on.
- Unknown rule names and unreadable values are reported on stderr — read stderr after editing `chaff.yaml`.
- `genre:` sets the kind of document; `by_path` sets one per folder; `--genre` overrides both for one run.
  `rules:` wins over the genre's preset.

## Turn a team's style note into chaff.yaml

When the person gives house rules ("polite endings, sentences of at most 80 characters"), do not guess rule
names or numbers:

1. Read `npx chaffjs rules --json`. Each rule has `summary` (what it finds), `level_meaning` (what a level's
   number means), `levels`, `example`, `not_flagged`, and `genres` (whether it runs in each genre).
2. Split the note into single requirements; map each to the rule whose `summary` and `level_meaning` fit. A
   number between levels is written as the number itself (`max-sentence-length: 80`). Spellings go under
   `prefer`, in-house words under `jargon`, required headings under `required_sections`.
3. Say plainly what no rule covers. For example, `no-mixed-desumasu` flags a register mixed into a document, but
   does not require a particular one; a document wholly in the other register is not reported.
4. Write only what differs from the default, then check before committing: `npx chaffjs explain <rule-id>`, a
   short sample that breaks each requirement (each must be reported), and `npx chaffjs rules` (the table shows the
   level each rule now runs at).

## Adding a team rule

Pick the easiest way that can say the requirement:

| Requirement | Use |
| --- | --- |
| An existing rule covers it | A level, a number, `prefer`, `jargon` or `required_sections` in `chaff.yaml` |
| A fixed phrase or pattern, with the team's own message | `custom_rules` of type `words` or `pattern` (coming in the next release) |
| Decided by part of speech or inflection | `custom_rules` of type `tokens` (coming in the next release) |
| Counting or comparing that the above cannot express | a Node function, `type: module` (a later release) |

Test a new team rule the same way: `explain`, then a sample it must report and a sample it must not, before
committing `chaff.yaml`. The guide page "Adding a rule" covers each way and how to add a rule to chaff itself.

## Making AI-sounding text sound human

Use this section when asked to make a text sound less generated: 「AIっぽさをなくして」「AI臭さを消して」「人間らしく
書き直して」, "make this sound human", "this reads like AI wrote it".

chaff marks the shapes common in generated text (group "Signs of generated text" in `npx chaffjs rules`: `ai-tell`,
`contrast-framing`, `stock-transition`, `announcing-opener`, `colon-lead-in` (Japanese only), `assistant-residue`, and the signals
`ai-generated-composite` reads). Most are experimental: run with `--experimental`. None of them says the text was
generated. chaff never rewrites; the rewriting is yours.

**Start with the plan.** Run `npx chaffjs fix-plan <file> --experimental` (with the genre's `--genre`; `--json` to
read it as data). It prints, in the document's language:

- the constraints: keep facts, numbers, conditions and names; add no fact; ask the writer instead of inventing a
  specific; two passes at most;
- the recommended mode and why, and the document-level signals with the outline's numbers;
- the structure targets: the structure score (how many structure measures lie past 90% of human articles) and, for
  each measure past that line, a target from the human baseline ("fewer headings: N now, M at most for this length");
- for each rule that fired: its rewrite direction, what to keep, what to avoid, one before/after pair, hints for the
  `ai-tell` phrases found, and the spots (line and sentence);
- the check commands to run on the rewrite.

Follow it. Rewrite in the mode it recommends; a request that says 「全面的に」 or "from scratch" means Full whatever it
says. Apply each rule's direction at its spots. Where a fix needs a specific the text does not give, leave ［ ］ and
ask. Save the result under the name the plan gives, run its check commands, and report the mode and the checks'
output. The mode steps below say the rest.

Pick one of three modes and say which.

| Mode | Changes | Pick it when |
| --- | --- | --- |
| **Light** | only the flagged spots | the content and the structure are fine and only some phrasing is off |
| **Bold** | each section's prose, keeping the outline | the outline is fixed (a report template, a manual, required sections) |
| **Full** | the whole document, from scratch | the request says 「全面的に」「一から」「全部書き直して」 / "from scratch" / "rewrite the whole thing"; or the genre is `blog/*` or an essay (`literature/essay`); or `ai-generated-composite` fires; or the plan's structure score reaches its limit |

For a blog or an essay, and whenever `ai-generated-composite` fires, recommend Full. A Light or Bold pass leaves the
skeleton of generated text: a heading every few paragraphs, bold lead-ins, symmetric sections, a closing まとめ that
repeats the body. The writer usually wants the structure changed, not only the sentences.

**Light** (only the flagged spots):

1. `npx chaffjs fix-plan <file> --experimental` (or with the genre's `--genre`).
2. Rewrite only the flagged spots, each by its rule's direction in the plan. Keep the meaning, numbers, conditions and
   technical constraints.
3. Run chaff again. At most two rewrite passes.
4. Show the rewritten text and a short list of what changed and why.

**Bold** (section by section, outline kept):

1. Run chaff with `--experimental` and note the document-level signals: the `ai-generated-composite` inputs,
   `bold-density`, `contrast-framing`, `stock-transition`, `sentence-rhythm`.
2. Rewrite each section toward a human voice: less bold; one-line paragraphs and punchlines folded back into
   paragraphs; no "X ではありません。Y です" / "It's not X. It's Y" frames; lists turned back into sentences where the
   items connect; fewer em dashes; no announcing openers. Each paragraph carries one claim, joined to the last by a
   connective, built around the writer's own experience or numbers where the original has them.
3. Run chaff again and report the same signals before and after, from chaff's output.
4. Run `npx chaffjs compare <old> <new>` (exit 1 on a dropped or added fact; `--json` to act on it). Restore every
   dropped fact; for one that is not a fact (a number inside a metaphor, the heading of a section you cut), say why it
   stays out. `--allow-dropped <kind>` excludes a kind you cut on purpose. Never leave an added fact.

**Full** (全面書き直し, from scratch):

1. **Take inventory before writing.** `npx chaffjs facts <file> --json` lists every fact `compare` will hold you to
   (numbers, dates, times, URLs, code, names, quotations, headings, references, footnotes). `npx chaffjs outline <file>`
   gives the old outline, its shape and its structure block: each structure measure against human articles, with ✗ on
   those past 90% of them. Then write down, one line each, the writer's actual claims and every concrete
   experience, example and opinion in the original. This inventory is what you write from; the old sentences are not.
2. **Throw away the structure.** Decide what the piece is for and who reads it. Choose one angle or story for the
   whole piece, and outline it the way a person would. Do these before writing:
   - reorder: put the conclusion, or the most interesting episode, first;
   - merge thin sections and split overloaded ones, so a section is a real unit, not one heading per paragraph;
   - cut sections that only restate, the closing まとめ / "Conclusion" included;
   - drop a heading that wraps a single paragraph;
   - turn a list-of-points section into a narrative with one through-line;
   - no symmetric three-point sections unless the content really has three parts;
   - move the writer's concrete experience to where it carries the argument;
   - open with the point or a concrete scene, not a generic opener.

   Size the new outline by the plan's structure targets: as many headings as the target allows for this length, no
   heading split into three unless the content has three parts, no bold-label lists, no closing that restates.
3. **Show the new outline first.** Put the old outline (headings from `chaff outline`) next to the proposed one:
   headings, and one line per section on what it says. The writer then sees the structural change at a glance. Wait
   for a yes, unless the person asked for it to be done without asking; then go straight on.
4. **Write it fresh**, in the writer's voice, from the inventory:
   - paragraphs that argue, joined by connectives; sentence lengths that vary;
   - plain verbs instead of metaphors ("静かに壊れる", "silently fails" → what actually happens);
   - the writer's own episodes and numbers kept; generic filler cut;
   - bold only where a reader truly must not miss something; lists only for real enumerations, steps or commands;
   - no hedges stacked on a claim, no announcing what you are about to say, no "it's not X, it's Y", no em dashes;
   - the register of the writer's other paragraphs (です/ます or だ/である) and of the platform (Zenn, a company
     report, an email);
   - nothing the inventory does not have: no new facts, people, numbers, causes or consequences.

   Three principles while writing:
   - **Undo personification.** A thing or an idea as the subject of a verb of will (秩序が壊れる, 文化が醸成される,
     アーキテクチャが要求する) becomes what a person or the system does. 「チームにレビューの文化が醸成された」 →
     「チームで互いにレビューをするようになった」. If the original does not say who, ask the writer.
   - **Turn noun endings and noun chains back into sentences with a verb.** 「キュー滞留によるメッセージ処理遅延の発生。」 →
     「キューにメッセージが溜まり、処理が遅れた。」 A noun ending hides who did what and when.
   - **Never invent specifics.** A vague sentence may read better with a concrete example. If the writer did not give
     one, ask for it, or mark your guess for them to confirm. Never write it as fact.
     「チームの雰囲気が良くなった」 stays as it is, with a question: 「雰囲気が良くなったと感じたのは、どんな場面でしたか」.
     `chaff compare` catches an added number or name, but not added wording such as 「朝会で冗談が出るようになり」, so
     this one is yours to keep.
5. **Check.**
   - `npx chaffjs <old> --experimental` and `npx chaffjs <new> --experimental`: the AI signals before and after.
   - `npx chaffjs outline <old> <new>`: headings, average section length, text in lists, bold, and the structure score
     and each structure measure, before and after. A restructure shows up here, not only in rule counts.
   - `npx chaffjs compare <old> <new> --distinct --allow-dropped heading --allow-added heading`: the headings are the
     structure you rebuilt on purpose; every other dropped fact is restored and no other fact is added. A cut まとめ
     restates facts the body still holds, so `--distinct` counts a fact as kept when the new text states it at least
     once.
6. **Stop** when all of these hold, or after two full passes, whichever comes first:
   - `ai-generated-composite` does not fire;
   - the density rules (`bold-density`, `contrast-framing`, `stock-transition`, `colon-lead-in`) are under their limits;
   - `chaff outline <old> <new>` shows the new structure score under the plan's limit, with no ✗ left on the measures
     the plan listed as targets;
   - `compare` is clean, or every exclusion has a stated reason.
7. **Show** the new text, a short "what changed and why" list, then a table of the signals and the shape before and
   after, taken from chaff's output.

**Read for these too.** chaff cannot detect them mechanically, so check them by reading, in every mode:

- a generic opener or closer ("本記事では〜解説します", "いかがでしたでしょうか", "In today's fast-paced world");
- explaining what every reader already knows;
- every section the same shape (chaff measures the lengths and the heading forms, not what each section does);
- a list of benefits with no cost or trade-off;
- no first-hand detail: nothing the writer saw, measured or did;
- the same enthusiasm everywhere, so nothing stands out;
- politeness piled on politeness;
- a definition nobody asked for;
- headings that are full sentences or slogans;
- a まとめ / "Conclusion" that repeats the body in other words (chaff counts only the repeated wording).

In every mode:

- Never add facts, people, numbers or causes the original does not have.
- Keep a domain term a word rule trips when it is right in context.
- Prefer a direct statement over a negated contrast. Say who does what.
- Never loop just to silence a warning; two passes at most, and list what is left with the reason.
- Per genre: in a tech article, replace metaphors ("静かに壊れる", "silently fails") with what happens and keep steps
  and commands as lists; in a business document, put the conclusion and who does what first and keep tables and
  figures; in an essay, fold punchlines back in and replace big words ("真理", "new possibilities") with the scene.

The guide page "Making AI-sounding text sound human" has worked examples of a Bold and a Full rewrite, with chaff's
output before and after.

## Structured documents

- `npx chaffjs tree <file>` shows a contract or specification as a tree of addresses (`3.2` for 第3条第2項 or
  Section 3.2). `--experimental` adds the structure rules: references to missing provisions, numbering gaps,
  terms defined twice.
- `npx chaffjs cite <source> <quotes.json>` checks that quotations (`[{ "address", "quote" }]`) are really in
  the source; exit 1 if any is not. Use it to back every quotation you put in an answer or a summary.

## When chaff is wrong

If a finding is wrong for the text (a false positive), or chaff missed something it should catch, draft a report
for the chaff project:

```sh
npx chaffjs feedback <file> --rule <rule-id> [--line N]   # a wrong finding
npx chaffjs feedback <file> --missed --line N             # something missed
```

It writes `.chaff-feedback.md`: chaff's version, Node and OS, the file name, the one finding, the two lines on
each side of it, and the reported rule's setting in `chaff.yaml` (all of `chaff.yaml` only with `--with-config`).
When a rule has several findings in the file, add `--line` to pick one. It prints how to send the draft
(`gh issue create …`, or a link that carries the title only). It sends nothing. Show the draft to the person and let
them decide; their document may be private.

## Do not

- Do not change what a document says to satisfy a rule. If a finding cannot be fixed without changing the
  meaning, leave it and say so.
- Do not turn a rule off to make a run pass; relax it with a reason the team would accept.
- Do not report "no findings" without reading the not-run list.
