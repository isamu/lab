<!-- yarn samples:update writes this file from the rules and the samples. Do not edit it by hand. -->

# Samples of what chaff fixes

One sample per rule: a mistake chaff finds, shown on a short document of the kind where it happens.
Each sample has the original text, what chaff says about it, the corrected text, how it was fixed, and the settings.
What chaff says is its real output on that text.

To try it on your own text, run `npx chaffjs your-file.md` with Node.js 24 or later. Nothing to install, no settings.
Or paste a draft into the [playground](https://isamu.github.io/lab/en/playground/).

日本語の見本: [../ja/README.md](../ja/README.md)

Rules with a sample: 65 / 259

## Readability

Sentences that run too long, packed paragraphs, and other places a reader stumbles.

| Rule | What it finds |
| --- | --- |
| [Acronym never expanded](undefined-acronym.md) (`undefined-acronym`) | An acronym such as "KGI" or "PMF" used without ever being spelled out |

Rules with no sample yet: `adverb-overuse`, `all-caps-shouting`, `bold-density`, `bracket-nesting`, `demonstrative-opener-run`, `double-negative`, `emoji-density`, `expletive-construction`, `heading-echo`, `max-paragraph-length`, `max-sentence-length`, `ngram-repetition`, `one-sentence-paragraph-run`, `paragraph-restatement`, `proper-noun-density`, `repeated-conjunction`, `repeated-sentence-head`, `sentence-initial-conjunction-run`, `title-length`

## Wording

Emphasis that says nothing, stock phrases, and passives that never say who acted.

| Rule | What it finds |
| --- | --- |
| [Empty intensifier](empty-intensifier.md) (`empty-intensifier`) | Words like "extremely important" that add weight without saying what matters |

Rules with no sample yet: `agentless-passive`, `cliche`, `closing-cliche`, `comparative-without-baseline`, `cushion-phrase-density`, `dangling-participle`, `excessive-hedging`, `nado-closed-list`, `nominalization`, `nonstandard-word`, `numeral-sentence-start`, `obligation-without-deadline`, `ordinal-suffix-mismatch`, `padded-intro`, `redundant-expression`, `request-without-deadline`, `requirement-smell`, `sentence-initial-so`, `uncomparable-graded`, `unqualified-superlative`, `vague-deadline`, `vague-word-density`, `very-adjective`, `warning-without-action`, `weasel-word`, `wordy-phrase`

## Slips

Words and spaces left over from an edit.

No sample in this group yet.

Rules with no sample yet: `agreement-slip`, `article-sound`, `calendar-name-case`, `chat-citation-residue`, `doubled-nado`, `doubled-punctuation`, `doubled-word`, `homophone-slip`, `hyphen-as-dash`, `invisible-character`, `known-misspelling`, `latin-abbreviation-form`, `less-for-fewer`, `link-text-url-mismatch`, `lookalike-character`, `missing-space-after-comma`, `space-before-punctuation`, `unbalanced-bracket`, `unfilled-placeholder`, `unknown-word`, `url-run-on`

## Consistency

Two ways of writing that are both right, mixed in one document. chaff does not pick a side; it points at whichever the document uses less.

No sample in this group yet.

Rules with no sample yet: `acronym-expansion-conflict`, `amount-scale-consistency`, `bare-url-mix`, `citation-style-mix`, `code-fence-language-mix`, `contraction-consistency`, `cross-doc-term-variant`, `currency-notation-consistency`, `date-format-consistency`, `defined-name-repeated`, `defined-term-form`, `ellipsis-consistency`, `heading-end-punctuation-mix`, `list-item-form-mix`, `list-marker-mix`, `name-variant`, `number-style-consistency`, `orthographic-variant`, `outside-announced-list`, `oxford-comma-consistency`, `party-role-name`, `person-consistency`, `quote-style-consistency`, `range-notation-consistency`, `sentence-spacing-consistency`, `shell-prompt-mix`, `spelling-consistency`, `step-statement-mix`, `table-header-variant`, `title-case-consistency`, `ui-label-variant`, `undefined-term`, `unit-spacing-consistency`, `which-that-consistency`

## Structure

Skipped numbers, references to provisions that are not there, terms defined twice, long preambles.

| Rule | What it finds |
| --- | --- |
| [An absolute rule with an exception written elsewhere](absolute-exception.md) (`absolute-exception`) | A rule said to have no exception ("must always") that another part excepts |
| [Abstract too long, or missing](abstract-length.md) (`abstract-length`) | An abstract over the length limit, or a paper with sections that has no abstract |
| [Link that goes nowhere](broken-link.md) (`broken-link`) | A link that goes nowhere: no address, a missing heading, or no definition |
| [Section with nothing concrete](concrete-evidence-density.md) (`concrete-evidence-density`) | A section with no number, code or link: nothing for the reader to take away |
| [Link to another file that goes nowhere](cross-doc-broken-link.md) (`cross-doc-broken-link`) | A link to another of the files checked whose file or heading is not there |
| [One term defined differently in different files](cross-doc-duplicate-definition.md) (`cross-doc-duplicate-definition`) | The same term defined in other words in different files |
| [Reference to a missing provision](dangling-reference.md) (`dangling-reference`) | A reference such as "see Article 5" to an article the document does not have |
| [Date without a year](date-without-year.md) (`date-without-year`) | A date with no year where the document's dates span years or cross a new year |
| [Term defined twice](duplicate-definition.md) (`duplicate-definition`) | The same term defined in two places in one document |
| [Duplicate sibling heading](duplicate-heading.md) (`duplicate-heading`) | Two headings with the same words under the same parent heading |
| [Email without a greeting or a closing](email-greeting-closing.md) (`email-greeting-closing`) | A work email that opens without a greeting or ends without a closing |
| [Subject line empty or too long](email-subject-length.md) (`email-subject-length`) | A work email whose "Subject:" line is empty or longer than the limit |
| [Empty list item](empty-list-item.md) (`empty-list-item`) | A list item with only a label ("Owner:") and no value, or with nothing in it |
| [Empty section](empty-section.md) (`empty-section`) | A heading with nothing under it before the next heading at its level or higher |
| [Blank table cell](empty-table-cell.md) (`empty-table-cell`) | A table cell left blank in a column every other row fills |
| [Figures and tables referred to out of order or out of place](figure-reference-order.md) (`figure-reference-order`) | A figure or table referred to out of order, too late, or never |
| [A note mark with no note, or a note nothing points to](footnote-mismatch.md) (`footnote-mismatch`) | A note mark ("[^3]") with no note, or a note nothing points to |
| [Heading level skipped](heading-level-skip.md) (`heading-level-skip`) | A heading that skips a level, such as "####" right after "##" |
| [Heading numbering mixed](heading-numbering-mix.md) (`heading-numbering-mix`) | Sibling headings numbered in mixed ways: "1. Overview", "Steps", "3. Costs" |
| [Image without alt text](image-alt-text.md) (`image-alt-text`) | An image with no alt text, as in "![](chart.png)" |
| [Image alt text is a file name](image-file-name-alt.md) (`image-file-name-alt`) | An image whose alt text is a file name, as in "![IMG_1234.png](…)" |
| [Opposite obligations on the same act](modal-conflict.md) (`modal-conflict`) | The same act required or allowed in one sentence and forbidden in another |
| [The lead only restates the title](no-lead.md) (`no-lead`) | A first paragraph under the title that only says the title again |
| [Number without its unit](number-without-unit.md) (`number-without-unit`) | A bare number where the other values in its column all have a unit |
| [Headings that are only a label and a number](numbered-generic-heading.md) (`numbered-generic-heading`) | Headings such as "Benefit 1" and "Tip 2" that are only a label and a number |
| [Skipped or repeated number](numbering-gap.md) (`numbering-gap`) | A numbered item that skips or repeats a number, such as Article 1 then 3 |
| [Too long before the point](preamble-length.md) (`preamble-length`) | Too many paragraphs before the first heading, which delays the point |
| [Prerequisite written after the steps](prerequisite-after-step.md) (`prerequisite-after-step`) | "Before you begin" written after the numbered steps it should come before |
| [A required skill listed again as preferred](required-listed-as-preferred.md) (`required-listed-as-preferred`) | A job posting that lists one skill both as required and as preferred |
| [A reference to a step that does not exist](step-reference-missing.md) (`step-reference-missing`) | A reference such as "see step 5" past the last step the document has |
| [Table row with more cells than the header](table-row-overflow.md) (`table-row-overflow`) | A table row with more cells than the header row (the extra ones are not shown) |
| [A table-of-contents entry with no heading](toc-heading-mismatch.md) (`toc-heading-mismatch`) | A table of contents entry that matches no heading of the document |
| [Unclosed code fence](unclosed-code-fence.md) (`unclosed-code-fence`) | A code block opened with "```" and never closed |
| [A step uses something the list of what you need leaves out](unlisted-item-used.md) (`unlisted-item-used`) | A step that uses an ingredient or a tool missing from the document's own list |
| [Unrendered emphasis marks](unrendered-emphasis.md) (`unrendered-emphasis`) | "**" or "__" that Markdown cannot pair and shows as written |
| [Term defined but never used](unused-definition.md) (`unused-definition`) | A term the document defines and then never uses |
| [Term used before it is defined](use-before-definition.md) (`use-before-definition`) | A term defined in passing, as in (the "Seller"), that is used before that point |
| [A figure, table or clause pointed at by where it is](vague-figure-reference.md) (`vague-figure-reference`) | "The table below" in a document that numbers its tables and figures |
| [Link text that does not say where it goes](vague-link-text.md) (`vague-link-text`) | A link whose whole text is "here", "click here" or "read more" |

## Facts that disagree

A date and its weekday, dates out of order, a total and its items: disagreements a calendar or a sum can settle.

No sample in this group yet.

Rules with no sample yet: `amount-range-reversed`, `announced-count-mismatch`, `annual-holidays-mismatch`, `annual-pay-mismatch`, `arrival-before-departure`, `attachment-not-attached`, `backorder-mismatch`, `bmi-mismatch`, `capacity-runtime-mismatch`, `change-rate-mismatch`, `citation-reference-mismatch`, `closing-balance-mismatch`, `connection-time-short`, `contact-variant`, `count-over-capacity`, `cross-doc-fact-conflict`, `cumulative-below-current`, `currency-column-mix`, `dangling-figure-reference`, `date-order`, `date-outside-period`, `date-range-reversed`, `date-stamp-order`, `date-weekday-mismatch`, `deadline-after-event`, `deductible-exceeds-limit`, `default-value-mismatch`, `delivered-over-ordered`, `deprecated-option-used`, `discount-rate-mismatch`, `due-before-issue`, `duration-mismatch`, `duration-product-mismatch`, `elapsed-years-mismatch`, `fact-conflict`, `formula-amount-mismatch`, `gpa-mismatch`, `heading-command-missing`, `impossible-date`, `impossible-time`, `installment-total-mismatch`, `interest-mismatch`, `interval-count-mismatch`, `layout-code-mismatch`, `line-amount-mismatch`, `meter-usage-mismatch`, `net-amount-mismatch`, `net-over-gross`, `number-word-figure-mismatch`, `parameter-table-mismatch`, `percent-sum-mismatch`, `period-label-conflict`, `period-multiple-mismatch`, `period-part-exceeds-whole`, `phone-number-variant`, `product-exceeds-maximum`, `quantity-range-reversed`, `quote-unnamed-speaker`, `quote-without-source`, `range-band-mismatch`, `ratio-mismatch`, `reference-flag-mismatch`, `reference-number-repeated`, `reference-number-variant`, `reference-title-mismatch`, `reference-topic-missing`, `reference-unit-mismatch`, `relative-date-mismatch`, `rent-multiple-mismatch`, `return-type-mismatch`, `revision-direction-mismatch`, `running-balance-mismatch`, `scaled-quantity-mismatch`, `serial-range-reversed`, `share-amount-mismatch`, `share-over-hundred`, `step-time-sum-mismatch`, `summary-fact-mismatch`, `table-unit-mix`, `tax-mismatch`, `tier-threshold-mismatch`, `time-order`, `time-range-reversed`, `total-mismatch`, `undefined-function-call`, `unit-mismatch`, `variance-mismatch`, `version-mismatch`, `version-order`, `walk-time-distance-mismatch`

## Signs of generated text

Traits common in generated text. None of them alone says the text was generated; they mark places to reread.

| Rule | What it finds |
| --- | --- |
| [Several signals of generated text together](ai-generated-composite.md) (`ai-generated-composite`) | Many signs of generated text in one document (a place to reread, not a verdict) |
| [The outline is unlike human articles](ai-structure.md) (`ai-structure`) | An outline that lies past human articles on several structure measures at once |
| [Phrasing common in generated text](ai-tell.md) (`ai-tell`) | Phrases common in generated text ("delve into", "plays a crucial role") piled up |
| [Too many sentences that announce before they say](announcing-opener.md) (`announcing-opener`) | Openers that announce a point before making it ("The key point is") piled up |
| [Chat-reply residue](assistant-residue.md) (`assistant-residue`) | Words left from a pasted chat reply, such as "I hope this helps" |
| [Bold emphasis scattered through the text](bold-emphasis.md) (`bold-emphasis`) | Bold phrases scattered mid-sentence through the whole text |
| [Too many list items led by a bold label](bold-label-list.md) (`bold-label-list`) | List items in a row that open with a bold label or a bold lead sentence |
| [A closing that cheers the reader on](closing-exhortation.md) (`closing-exhortation`) | A closing piled with cheering lines ("You've got this", "Happy baking!") |
| [An opening with no situation and no example](cold-open.md) (`cold-open`) | An opening that piles a bare wish, a quoted echo and a teaser |
| [Too many colon lead-ins to lists](colon-lead-in.md) (`colon-lead-in`) | Section after section that opens with a sentence ending in a colon before a list |
| [Too many contrast frames](contrast-framing.md) (`contrast-framing`) | Contrasts piled up ("It's not X, it's Y"), knocking down an X nobody said |
| [Stock email courtesies piled up](email-stock-courtesy.md) (`email-stock-courtesy`) | Stock email courtesies ("I hope this email finds you well") piled up |
| [Headings decorated with emoji](emoji-heading.md) (`emoji-heading`) | Headings with an emoji in them ("## 🚀 Getting started"), one after another |
| [Too many decorative figures](figurative-density.md) (`figurative-density`) | Figures such as "like magic" or "secret sauce" piled up instead of the mechanism |
| [An honesty marker](honesty-marker.md) (`honesty-marker`) | A sentence flagged as candid ("honestly", "if I'm being honest") |
| [Too many dashes](no-em-dash.md) (`no-em-dash`) | Too many dashes, which is also one of the better-known marks of generated text |
| [Too many sweeping claims about people](over-general-claim.md) (`over-general-claim`) | Sweeping claims about people ("most people", "nobody") piled up |
| [Paragraph lengths are too uniform](paragraph-length-variance.md) (`paragraph-length-variance`) | Paragraphs all of about the same length, as if poured into a mould |
| [Questions answered with a fragment](q-fragment-answer.md) (`q-fragment-answer`) | Questions the writer answers at once with a fragment ("Is it perfect? No.") |
| [Everything comes in threes](rule-of-three.md) (`rule-of-three`) | Lists that almost all have exactly three items, as if padded or trimmed to fit |
| [Section lengths are too uniform](section-length-uniformity.md) (`section-length-uniformity`) | Every section filled to the same size, which is what a template does |
| [Monotonous sentence rhythm](sentence-rhythm.md) (`sentence-rhythm`) | Sentences that are all about the same length, so the text reads as a drone |
| [Too many stock transitions](stock-transition.md) (`stock-transition`) | Too many sentences opening with "Moreover" or "Additionally" |
| [Too many denials of a premise nobody stated](unprompted-denial.md) (`unprompted-denial`) | Sentences that deny a premise nobody stated ("This isn't about tooling.") |

## Your team's words

Rules that check only what your team lists in chaff.yaml: spellings, jargon, required headings. With nothing listed, they say nothing.

No sample in this group yet.

Rules with no sample yet: `internal-jargon`, `preferred-term`, `required-sections`, `requirement-modal`

The checks that read meaning run under `npx chaffjs test`, which asks an AI, so they have no fixed output to show here: `empty-conclusion`, `generic-opening`, `risk-disclosure`, `unsourced-number`
