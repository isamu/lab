# Making AI-sounding text sound human

Generated text has shapes that recur. It uses a lot of bold and "It's not X. It's Y" contrasts.
Its sentences open with "The key point is", and its sections hand off to a list after a colon.
chaff finds these shapes by machine, and it never rewrites the text.
This page shows how to use what it finds to bring a document back to a human voice.

## Start with a fix plan

Before rewriting, have `chaff fix-plan` print a plan.

```bash
npx chaffjs fix-plan article.md           # the plan, as Markdown
npx chaffjs fix-plan article.md --json    # the same plan as JSON, to hand to an AI
```

The plan turns what chaff found into instructions, rule by rule: how to rewrite each kind of spot.
Whoever reads it does the rewriting, a person or an AI. chaff does not rewrite, and sends nothing anywhere.

The plan has these parts.

| Part | What it says |
| --- | --- |
| Genre's guide | When the genre is set: what a good document of that kind does, the lines the rewrite is held to. See "Give the AI the genre's guide" below |
| Constraints | Keep facts, numbers, conditions and names. Add no fact. Ask the writer instead of inventing a specific. At most two passes |
| Recommended way | Light, Bold or Full, and why, decided the same way as in "Three ways to fix it" below |
| Document-level signals | What `ai-generated-composite` and the density rules said, and the outline's numbers from `chaff outline` |
| Structure targets | The structure score (how many structure measures lie past 90% of human articles) and a target for each measure past that line. The targets come from articles written before generated text was common ("at most this many headings for this length") |
| How to rewrite, rule by rule | The direction, what to keep, what to avoid, a before-and-after example, and each spot found (line and sentence) |
| Check after rewriting | The `chaff`, `chaff compare` and `chaff outline` commands to run on the rewrite |

The directions and examples come from the rule files (`rewrite:`), so the same finding always gets the same direction.
The steps are the same whether a person rewrites or an AI does.

1. Run `npx chaffjs fix-plan article.md`.
2. Rewrite following the plan, and save the result under the name its last part gives. To have an AI do it, hand it the plan as it is.
3. Run the checks. They show whether findings remain, whether a fact was dropped or added, and how the outline moved.

[From a fix plan to a clean check](./ai-sounding-examples#from-a-fix-plan-to-a-clean-check) goes from the plan to the checks.

## Give the AI the genre's guide

A fix plan says what to change at each spot chaff found. What the whole document should do is in the genre's guide.
When the genre is set (`--genre`, `genre` or `by_path` in `chaff.yaml`, or front matter), the plan opens with the guide, before the constraints.

An AI that rewrites to the plan reads it first, and checks the rewrite against each line when it is done.
Most of the lines are what no rule can check, so they are the part of the instruction only reading can follow.

```text
$ npx chaffjs fix-plan draft.md --genre blog/tech

# Fix plan: draft.md

language en, genre blog/tech

What chaff found by machine, and how to rewrite each kind of spot. chaff does not rewrite; whoever reads this plan does, a person or an AI. When done, run the checks at the end.

## Guide: Tech blog (blog/tech)

What a good document of this genre does. Rewrite toward it, and check the result against each line when done.

- Does the opening make one claim, plainly (what the reader will learn or be able to do)?
- Do the steps and code run as written and give the same result?
- Are the versions used (language, libraries, OS) and the date they were tried stated?
- Does it say what was tried and failed, the limits, and the assumptions?
- Does the ending point to what to read or try next, rather than restate the body?

Rules that matter most for this genre: `closing-cliche`, `empty-conclusion`, `padded-intro`, `paragraph-length-variance`, `quote-without-source`, `rule-of-three`, `section-length-uniformity`, `sentence-rhythm`

…
```

The guide comes as data too, for an AI that reads JSON.

| Output | Where the guide is |
| --- | --- |
| `fix-plan --json` | A top-level `guide`: `genre`, `name`, `lines`, `rules` (the rules that matter most) and `from` (where it was written). `null` when the genre was not set |
| `rules --json` | A top-level `guide` of the same shape, for the genre of `--genre` or `chaff.yaml` |
| `--sarif <path>` | `runs[0].properties.guides`: one per genre and language in the run, each with its `language` |

```text
$ npx chaffjs rules --json --genre blog/tech

…
  "guide": {
    "genre": "blog/tech",
    "name": "Tech blog",
    "lines": [
      "Does the opening make one claim, plainly (what the reader will learn or be able to do)?",
      "Do the steps and code run as written and give the same result?",
      "Are the versions used (language, libraries, OS) and the date they were tried stated?",
      "Does it say what was tried and failed, the limits, and the assumptions?",
      "Does the ending point to what to read or try next, rather than restate the body?"
    ],
    "rules": [
      "closing-cliche",
      "empty-conclusion",
      "padded-intro",
      "paragraph-length-variance",
      "quote-without-source",
      "rule-of-three",
      "section-length-uniformity",
      "sentence-rhythm"
    ],
    "from": [
      "genres.yaml"
    ]
  },
…
```

The Claude Code skill (`npx chaffjs skill`) tells Claude to read the guide before any finding.
A guessed or default genre gives no guide, so set the genre before handing a plan to an AI.
`--no-guide` leaves the guide out of all of these.
A team changes the lines with `guide:` in `chaff.yaml` ([Changing the genre's guide](./configuration#changing-the-genres-guide)).

## What chaff looks for

These rules run by default in tech articles, blogs and business documents.
Legal documents, manuals, literature and transcripts are written differently, so most of them are off there; `npx chaffjs explain <rule>` names the genres.

| Rule | What it finds |
| --- | --- |
| `ai-tell` | Phrases common in generated text piling up ("plays a crucial role", "delve into") |
| `contrast-framing` | Contrast frames piling up ("not just X, but Y", "It's not X. It's Y") |
| `stock-transition` | Too many sentences opening with "Moreover" or "Additionally" |
| `announcing-opener` | Several sentences opening with an announcement ("The key point is", "Here's the thing", "Honestly,") |
| `colon-lead-in` | Too many sentences ending in a colon that hand off to a list (Japanese documents only) |
| `emoji-heading` | Headings with an emoji in them, one after another ("## 🚀 Getting started") |
| `bold-label-list` | Many list items that open with a bold label and a colon ("- **Speed**: ...") (Japanese documents only) |
| `assistant-residue` | What is left of a chat reply ("I hope this helps", "As of my last knowledge update") |
| `chat-citation-residue` | Marks a pasted chat answer leaves: links ending in "?utm_source=chatgpt.com", "oaicite" |
| `closing-cliche` | A stock closing ("In conclusion", "I hope this helps") |
| `bold-density` | Too much bold |
| `no-em-dash` | Too many em dashes |
| `sentence-rhythm` | Sentences that are all about the same length |
| `rule-of-three` | Lists that almost all have three items |
| `section-length-uniformity` | Every section filled to the same size, which is what a template does |
| `paragraph-length-variance` | Paragraphs all of about the same length, as if poured into a mould |
| `ai-structure` | An outline past 90% of human articles on several structure measures at once (heading density, headings split into three, bold labels, uniform sections, a closing that restates). Blog and essay genres only |
| `ai-generated-composite` | Three or more of these in one document: `ai-tell`, `contrast-framing`, `stock-transition`, `announcing-opener`, `colon-lead-in`, `assistant-residue`, `closing-cliche`, `padded-intro`, `no-em-dash`, `sentence-rhythm`, `rule-of-three`, `section-length-uniformity`, `ai-structure` (`bold-density` is not counted) |

None of these rules says the text was generated. People write every one of these shapes.
Piled up, they mark a place to reread.
`fix-plan` also gives a way to rewrite for other rules that flag such spots, such as `no-lead` and `paragraph-restatement`; the [reference](./reference) lists them all.

The Japanese word list of `ai-tell` includes the metaphors of technical writing (静かに壊れる "fails silently",
黙って無視される "is ignored without a word", 時間を溶かす "melts your time").
Which phrases go in was measured on technical articles written before generative AI and on the corpus.
Phrases people already wrote as often before (解像度を上げる, 腹落ち) are left out.

## A quick AI-likeness score

`npx chaffjs ai-score <file>` counts how many of the signs above show in a document that human documents of the same genre rarely show, and says low, medium or high.
**It is not a verdict on whether AI wrote the text.** It says whether there is more to reread than in human documents.

- The signs are the findings of the rules above and the structure measures of `chaff outline`. Only those that 90% of human documents do not show count.
- The human documents are the corpus's human documents, by genre group (blog, technical, business and so on), and technical articles written before generative AI. Both are numbers shipped with chaff.
- Three signs make "medium" and five make "high": the number `ai-generated-composite` reports at, and its relaxed level.
- Two or more of the rules `ai-generated-composite` reads showing in one document (its strict level) count as one more sign. No human document in the corpus shows two of them together; `yarn ai-score:corpus --all` counts them.
- A structure measure and the rule that reads the same shape (section length variation and `section-length-uniformity`, for one) count once when both show.
- A document that is too short (under 500 characters in Japanese, 200 words in English), or in a genre without enough human documents (academic, speech), gets no level and the reason instead.
- A plain `npx chaffjs <file>` also ends its report with the level on one line, and `chaff grade` puts `aiScore` in each output's result ([Using chaff for AI evals](./ai-evals)).

The [tech article example](./ai-sounding-examples#a-bold-rewrite-of-a-tech-article) ends with a screen.

## Three ways to fix it

| Way | Depth | What it changes | When to use it |
| --- | --- | --- | --- |
| Light | `light` | Only the spots chaff flagged | The content and structure are fine and only the wording grates |
| Bold | `light` | The prose of each section; the outline stays | The outline is fixed: a report template, a manual, required sections |
| Full | `structure` | The whole document, from its structure up | The request says "from scratch" or "rewrite the whole thing"; a blog post or an essay; `ai-generated-composite` fires; the plan's structure score reaches its limit |

A light pass removes findings one at a time. It fixes typos and long sentences, but the shape of the document stays.
A bold rewrite changes the sentences of each section, and the outline stays as it was.
A heading every few paragraphs, bold lead-ins and a closing summary that repeats the body still read as generated after the sentences are fixed.

For a blog post or an essay, choose the full rewrite. Do the same whenever `ai-generated-composite` fires.
What the writer wants changed there is usually the structure, not the sentences.

### Setting the rewrite depth

When how deep the rewrite may go is decided beforehand, give the depth with `--depth`.

```bash
npx chaffjs fix-plan article.md --depth light        # keep the structure; words and sentences only
npx chaffjs fix-plan article.md --depth structure    # up to reorganising sections, headings and paragraphs
npx chaffjs fix-plan article.md --depth register     # up to converting the style (polite to plain endings, and so on)
```

| Depth | What it rewrites |
| --- | --- |
| `light` | Words and sentences. The structure and the voice stay |
| `structure` | Sections, headings and paragraphs, reorganised. Includes `light` |
| `register` | The style, converted (polite to plain endings, comparatives removed, and so on). Includes `structure` |

Each rule's file says how deep its direction reaches, under `rewrite.depth`.
With `--depth light`, a rule that reorganises paragraphs, such as `one-sentence-paragraph-run`, is listed under "Rules deeper than the depth set" with its spot count only.
Dropping what the plan does not fix without a word would make it look fixed.
To use the same depth every time, put it in chaff.yaml ([Configuration](./configuration#setting-the-depth-of-a-fix-plan)).
Without a depth, chaff recommends one of the ways above and writes its depth in the plan. chaff never recommends a register change.

## The light pass

1. Run `npx chaffjs fix-plan article.md` for the plan.
2. Rewrite only the flagged spots, following each rule's direction in the plan. Keep the meaning, the numbers, the conditions and the technical constraints.
3. Run chaff again. Stop after two rewrites.
4. Keep the rewritten text and a short list of what changed and why.

Do not repeat a pass just to silence a warning. If a word you chose trips another rule but is the right technical term in context, keep it.

## The bold rewrite

A bold rewrite keeps the outline and changes the prose of each section, rather than one finding at a time. Go section by section.

1. Before rewriting, run chaff and note the document-level signals:
   the inputs of `ai-generated-composite`, `bold-density`, `contrast-framing`, `stock-transition` and `sentence-rhythm`.
2. Rewrite each section, reducing these shapes:

| Reduce | How |
| --- | --- |
| Bold | Keep it only for a word the reader must not skip |
| One-sentence paragraphs and punchlines | Fold them back into the paragraph around them, with the reason |
| "It's not X. It's Y" | Drop the X nobody said and write Y |
| Sections that are all lists | Where the items connect, turn them back into sentences that say how |
| Em dashes | Use a comma or parentheses, or split the sentence |
| Announcements ("The key point is") | Delete the announcement and start with the point |

3. Give each paragraph one claim and link it to the one before with a connective.
   Where the original has the writer's own experience or concrete numbers, put them at the centre of the paragraph.
4. Run chaff again and compare with the signals from step 1.
   Show the change with chaff's output, not with adjectives.
5. Run `npx chaffjs compare <before> <after>` and check every fact dropped or added.
   It matches numbers, dates, times, URLs, code, names, quotations, headings, references and footnotes before and after.
   Restore every dropped fact. For what is not a fact (a number inside a metaphor, the heading of a section you cut), note why it stays out.
   A kind you cut on purpose can be excluded with `--allow-dropped <kind>`.

## The full rewrite

Leave the old sentences alone. Take an inventory of what the document says, and write from that.

1. Take the inventory before writing. `npx chaffjs facts <file> --json` lists every fact `compare` will check.
   `npx chaffjs outline <file>` shows the old outline, its shape and its structure score; a measure past 90% of human articles is marked ✗.
   Write down the writer's claims and every concrete experience, example and opinion, one line each. Write from this inventory, not from the old text.
2. Throw away the structure. Decide who reads the piece and what for, and choose one angle or story for the whole of it.
   Then make these changes to the outline before writing a sentence.

| Change | What to do |
| --- | --- |
| Reorder | Put the conclusion, or the most interesting episode, first |
| Merge and split | Merge thin sections and split overloaded ones; a section is a real unit, not one heading per paragraph |
| Cut restatements | Cut sections that only restate the body, the closing summary included |
| Drop lone headings | A heading over a single paragraph goes; the paragraph joins its neighbours |
| Turn points into a story | A section that lists points becomes prose with one through-line |
| Break the symmetry | No three sections or three items unless the content really has three parts |
| Move the experience | Put the writer's concrete experience where it carries the argument |
| Open on the point | Start with the point or a concrete scene, not a generic opener |

   Size the new outline by the plan's structure targets: no more headings than the target allows.
   Split no heading into three unless the content has three parts; use no bold-label lists and no closing that restates the body.

3. Show the new outline first. Put the old outline (the headings from `chaff outline`) next to the new one, with one line per section on what it says.
   The writer can then see the structural change at a glance and decide. If the person asked for it to be done without asking, go straight on.
4. Write it fresh, in the writer's voice, from the inventory.

| Aspect | How |
| --- | --- |
| Paragraphs | Each argues something and joins the last with a connective; sentence lengths vary |
| Verbs | Plain verbs for what happens, not metaphors ("silently fails") |
| Experience and numbers | Keep the writer's own episodes and numbers; cut filler that fits any article |
| Bold and lists | Bold only where a reader must not miss something; lists only for real enumerations, steps or commands |
| Shapes to avoid | Hedges stacked on a claim, announcing what comes next, "it's not X, it's Y", em dashes |
| Register | Match the writer's other paragraphs and the platform (a blog, a company report, an email) |
| What not to add | No fact, person, number, cause or consequence the inventory does not have |

   Three principles hold while you write.

| Principle | Before | After |
| --- | --- | --- |
| Undo personification | A culture of code review was fostered across the team. | People on the team started reviewing each other's code. |
| Turn noun chains back into verbs | Occurrence of message processing delays due to queue backlog. | Messages piled up in the queue, so processing slowed down. |
| Never invent specifics | The team's mood improved. | The sentence stays, and the writer is asked: "When did you notice the mood improve?" |

   - Undo personification. Watch for a thing or an idea as the subject of a verb of will: "order breaks down", "a culture is fostered", "the architecture demands". Write it as what a person or the system does. If the original does not say who, ask the writer.
   - Turn noun endings and noun chains back into sentences with a verb. A string of nouns hides who did what, and when.
   - Never invent specifics. A vague sentence may read better with a concrete example. If the writer did not give one, ask for it, or mark your guess for the writer to confirm. Never write it as fact.
     `chaff compare` catches an added number or name. It does not catch added wording: "people started joking at the morning stand-up" adds no number and no name, and `compare` says nothing. Keeping this rule is up to the rewriter.

5. Check the result.

```bash
npx chaffjs old.md                          # the AI signals before
npx chaffjs new.md                          # and after
npx chaffjs outline old.md new.md                          # headings, average section, lists, bold and the structure score, before and after
npx chaffjs compare old.md new.md --distinct --allow-dropped heading --allow-added heading  # no fact other than a heading dropped or added
```

   The headings are the structure you rebuilt on purpose, so `--allow-dropped heading --allow-added heading` excludes them. Restore any other dropped fact and remove any added one.
   A summary you cut restated facts the body still holds. `--distinct` counts a fact as kept when the new text states it at least once, so those repeats do not read as dropped.

6. Stop when all of these hold. Two full passes at most.
   - `ai-generated-composite` does not fire.
   - The density rules (`bold-density`, `contrast-framing`, `stock-transition`, `colon-lead-in`) are under their limits.
   - `compare` passes, or every exclusion has a reason.
   - `chaff outline old.md new.md` shows the new structure score under the plan's limit, with no ✗ left on the measures the plan listed as targets.
7. Show the new text, a short list of what changed and why, and a table of the signals and the shape before and after. Take the numbers from chaff's output.

## What chaff cannot see

chaff cannot find these shapes by machine. Check them by reading, whichever way you rewrite.

| Shape | What to look for |
| --- | --- |
| Stock openers and closers | Starting with "In this post, we'll explore" or ending with "I hope this helps" |
| Explaining the obvious | Telling readers what every one of them already knows |
| Identical sections | Every section built the same way (`chaff outline` measures the lengths and the heading forms) |
| Benefits without a cost | Only the upside, with nothing given up for it |
| No first-hand detail | Nothing the writer saw, measured or did |
| Uniform enthusiasm | The same excitement everywhere, so nothing stands out |
| Over-politeness | Courtesy and preamble piled on courtesy |
| Unasked definitions | A term defined that no reader asked about |
| Sentence headings | Headings written as full sentences or slogans |
| A repeating summary | A last section that only says the body again in other words (`chaff outline` measures the repeated wording) |

## Rules for every way

- Do not add facts, people, numbers or causes that are not in the original.
- Do not change the meaning, the numbers, the conditions or the technical constraints.
- Prefer a direct statement over a negated contrast.
- Say who does what.
- Stop after two rewrites. Do not loop just to silence a warning.

## Per genre

| Genre | What to watch |
| --- | --- |
| Tech blog (`blog/tech`) | Replace metaphors ("silently breaks", "the error is swallowed") with what happens ("returns without raising an exception"). Keep steps and commands as lists. |
| Business (`business/report`) | Put the conclusion first, then who does what by when. Drop decoration such as "not just a tool, but a turning point". Keep tables and figures as they are. |
| Essay (`blog/essay`) | Fold one-line paragraphs and punchlines back into the text. Replace big words ("profound truth", "new possibilities") with what happened in that scene. |

## Examples

Three worked examples, from a draft to the checks after the rewrite, are on their own page, [Examples: making AI-sounding text sound human](./ai-sounding-examples):

- [from a fix plan to a clean check](./ai-sounding-examples#from-a-fix-plan-to-a-clean-check), the plan followed step by step;
- [a bold rewrite of a tech article](./ai-sounding-examples#a-bold-rewrite-of-a-tech-article), with the outline kept;
- [a full rewrite of a blog post](./ai-sounding-examples#a-full-rewrite-of-a-blog-post), from the structure up.

## Further reading

| Source | What it has to do with this page |
| --- | --- |
| Kobak et al., "[Delving into LLM-assisted writing in biomedical publications through excess vocabulary](https://arxiv.org/abs/2406.07016)" (Science Advances, 2025) | Comparing word use before and after generated text spread, and picking the words that grew. The Japanese `ai-tell` entries were chosen the same way. |
| Hayashi and Aizawa, "[LLM による日本語生成におけるモデル固有表現パターンの分析](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/B9-17.pdf)" (NLP 2026) | Japanese generated text also carries model-specific phrasing and structure (conclusion first, numbered structure, announcing the steps). |

## What to read next

- Worked examples, from a draft to the checks, are in [Examples: making AI-sounding text sound human](./ai-sounding-examples).
- Every option of `fix-plan`, `facts`, `outline` and `compare` is in [Commands](./commands#planning-a-rewrite).
- Checking a model's output in an eval with the same rules is in [Using chaff for AI evals](./ai-evals).
- Each AI-shape rule, with an example and its real output, is in the [Reference](./reference).
