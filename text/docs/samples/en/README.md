<!-- yarn samples:update writes this file from the rules and the samples. Do not edit it by hand. -->

# Samples of what chaff fixes

One sample per rule: a mistake chaff finds, shown on a short document of the kind where it happens.
Each sample has the original text, what chaff says about it, the corrected text, how it was fixed, and the settings.
What chaff says is its real output on that text.

To try it on your own text, run `npx chaffjs your-file.md` with Node.js 24 or later. Nothing to install, no settings.
Or paste a draft into the [playground](https://isamu.github.io/lab/en/playground/).

日本語の見本: [../ja/README.md](../ja/README.md)

Rules with a sample: 46 / 259

## Readability

Sentences that run too long, packed paragraphs, and other places a reader stumbles.

| Rule | What it finds |
| --- | --- |
| [Too many -ly adverbs](adverb-overuse.md) (`adverb-overuse`) | Too many -ly adverbs, which usually prop up a weak verb |
| [Shouting in capitals](all-caps-shouting.md) (`all-caps-shouting`) | Ordinary words run together in capitals, such as "DO NOT DELETE THIS" |
| [Too much bold](bold-density.md) (`bold-density`) | So much bold text that nothing stands out any more |
| [Brackets nested too deep](bracket-nesting.md) (`bracket-nesting`) | Brackets inside brackets inside brackets in one sentence |
| [Sentences in a row opening with a demonstrative](demonstrative-opener-run.md) (`demonstrative-opener-run`) | Sentences in a row that open with a word pointing back (This, That, It) |
| [Double negative](double-negative.md) (`double-negative`) | A negative negated, such as "not uncommon" or "not unlike" |
| [Too many emoji](emoji-density.md) (`emoji-density`) | So many emoji that the decoration drowns the text |
| [Expletive construction](expletive-construction.md) (`expletive-construction`) | Many sentences that open with "There is" or "It is ... that" |
| [Heading echoed](heading-echo.md) (`heading-echo`) | A first sentence that only repeats the heading above it |
| [Paragraph too long](max-paragraph-length.md) (`max-paragraph-length`) | A paragraph packed with so many sentences that the reader has nowhere to pause |
| [Sentence too long](max-sentence-length.md) (`max-sentence-length`) | A sentence so long that the reader loses the subject before the verb |
| [Repeated phrasing](ngram-repetition.md) (`ngram-repetition`) | The same phrase used over and over, so nothing new seems to be said |
| [Run of one-sentence paragraphs](one-sentence-paragraph-run.md) (`one-sentence-paragraph-run`) | Paragraph after paragraph of a single sentence, so nothing is grouped |
| [A paragraph that only restates the one before](paragraph-restatement.md) (`paragraph-restatement`) | A paragraph opening "In other words" that mostly repeats the one before |
| [Too many proper nouns](proper-noun-density.md) (`proper-noun-density`) | So many product, company and personal names that a newcomer gets lost |
| [Paragraphs keep opening the same way](repeated-conjunction.md) (`repeated-conjunction`) | Paragraph after paragraph opening with a connective such as "Also" or "Moreover" |
| [Repeated sentence opening](repeated-sentence-head.md) (`repeated-sentence-head`) | Several sentences in a row that open with the same words |
| [Run of sentences opening with a conjunction](sentence-initial-conjunction-run.md) (`sentence-initial-conjunction-run`) | A run of sentences that open with "And", "But" or "So" (そして, しかし) |
| [Title or heading too long](title-length.md) (`title-length`) | A title or heading too long to take in at a glance |
| [Acronym never expanded](undefined-acronym.md) (`undefined-acronym`) | An acronym such as "KGI" or "PMF" used without ever being spelled out |

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
| [Reference to a missing provision](dangling-reference.md) (`dangling-reference`) | A reference such as "see Article 5" to an article the document does not have |

Rules with no sample yet: `absolute-exception`, `abstract-length`, `broken-link`, `concrete-evidence-density`, `cross-doc-broken-link`, `cross-doc-duplicate-definition`, `date-without-year`, `duplicate-definition`, `duplicate-heading`, `email-greeting-closing`, `email-subject-length`, `empty-list-item`, `empty-section`, `empty-table-cell`, `figure-reference-order`, `footnote-mismatch`, `heading-level-skip`, `heading-numbering-mix`, `image-alt-text`, `image-file-name-alt`, `modal-conflict`, `no-lead`, `number-without-unit`, `numbered-generic-heading`, `numbering-gap`, `preamble-length`, `prerequisite-after-step`, `required-listed-as-preferred`, `step-reference-missing`, `table-row-overflow`, `toc-heading-mismatch`, `unclosed-code-fence`, `unlisted-item-used`, `unrendered-emphasis`, `unused-definition`, `use-before-definition`, `vague-figure-reference`, `vague-link-text`

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
