<!-- yarn samples:update writes this file from the rules and the samples. Do not edit it by hand. -->

# Samples of what chaff fixes

One sample per rule: a mistake chaff finds, shown on a short document of the kind where it happens.
Each sample has the original text, what chaff says about it, the corrected text, how it was fixed, and the settings.
What chaff says is its real output on that text.

To try it on your own text, run `npx chaffjs your-file.md` with Node.js 24 or later. Nothing to install, no settings.
Or paste a draft into the [playground](https://isamu.github.io/lab/en/playground/).

日本語の見本: [../ja/README.md](../ja/README.md)

Rules with a sample: 3 / 259

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
| [Reference to a missing provision](dangling-reference.md) (`dangling-reference`) | A reference such as "see Article 5" to an article the document does not have |

Rules with no sample yet: `absolute-exception`, `abstract-length`, `broken-link`, `concrete-evidence-density`, `cross-doc-broken-link`, `cross-doc-duplicate-definition`, `date-without-year`, `duplicate-definition`, `duplicate-heading`, `email-greeting-closing`, `email-subject-length`, `empty-list-item`, `empty-section`, `empty-table-cell`, `figure-reference-order`, `footnote-mismatch`, `heading-level-skip`, `heading-numbering-mix`, `image-alt-text`, `image-file-name-alt`, `modal-conflict`, `no-lead`, `number-without-unit`, `numbered-generic-heading`, `numbering-gap`, `preamble-length`, `prerequisite-after-step`, `required-listed-as-preferred`, `step-reference-missing`, `table-row-overflow`, `toc-heading-mismatch`, `unclosed-code-fence`, `unlisted-item-used`, `unrendered-emphasis`, `unused-definition`, `use-before-definition`, `vague-figure-reference`, `vague-link-text`

## Facts that disagree

A date and its weekday, dates out of order, a total and its items: disagreements a calendar or a sum can settle.

No sample in this group yet.

Rules with no sample yet: `amount-range-reversed`, `announced-count-mismatch`, `annual-holidays-mismatch`, `annual-pay-mismatch`, `arrival-before-departure`, `attachment-not-attached`, `backorder-mismatch`, `bmi-mismatch`, `capacity-runtime-mismatch`, `change-rate-mismatch`, `citation-reference-mismatch`, `closing-balance-mismatch`, `connection-time-short`, `contact-variant`, `count-over-capacity`, `cross-doc-fact-conflict`, `cumulative-below-current`, `currency-column-mix`, `dangling-figure-reference`, `date-order`, `date-outside-period`, `date-range-reversed`, `date-stamp-order`, `date-weekday-mismatch`, `deadline-after-event`, `deductible-exceeds-limit`, `default-value-mismatch`, `delivered-over-ordered`, `deprecated-option-used`, `discount-rate-mismatch`, `due-before-issue`, `duration-mismatch`, `duration-product-mismatch`, `elapsed-years-mismatch`, `fact-conflict`, `formula-amount-mismatch`, `gpa-mismatch`, `heading-command-missing`, `impossible-date`, `impossible-time`, `installment-total-mismatch`, `interest-mismatch`, `interval-count-mismatch`, `layout-code-mismatch`, `line-amount-mismatch`, `meter-usage-mismatch`, `net-amount-mismatch`, `net-over-gross`, `number-word-figure-mismatch`, `parameter-table-mismatch`, `percent-sum-mismatch`, `period-label-conflict`, `period-multiple-mismatch`, `period-part-exceeds-whole`, `phone-number-variant`, `product-exceeds-maximum`, `quantity-range-reversed`, `quote-unnamed-speaker`, `quote-without-source`, `range-band-mismatch`, `ratio-mismatch`, `reference-flag-mismatch`, `reference-number-repeated`, `reference-number-variant`, `reference-title-mismatch`, `reference-topic-missing`, `reference-unit-mismatch`, `relative-date-mismatch`, `rent-multiple-mismatch`, `return-type-mismatch`, `revision-direction-mismatch`, `running-balance-mismatch`, `scaled-quantity-mismatch`, `serial-range-reversed`, `share-amount-mismatch`, `share-over-hundred`, `step-time-sum-mismatch`, `summary-fact-mismatch`, `table-unit-mix`, `tax-mismatch`, `tier-threshold-mismatch`, `time-order`, `time-range-reversed`, `total-mismatch`, `undefined-function-call`, `unit-mismatch`, `variance-mismatch`, `version-mismatch`, `version-order`, `walk-time-distance-mismatch`

## Signs of generated text

Traits common in generated text. None of them alone says the text was generated; they mark places to reread.

No sample in this group yet.

Rules with no sample yet: `ai-generated-composite`, `ai-structure`, `ai-tell`, `announcing-opener`, `assistant-residue`, `bold-emphasis`, `bold-label-list`, `closing-exhortation`, `cold-open`, `colon-lead-in`, `contrast-framing`, `email-stock-courtesy`, `emoji-heading`, `figurative-density`, `honesty-marker`, `no-em-dash`, `over-general-claim`, `paragraph-length-variance`, `q-fragment-answer`, `rule-of-three`, `section-length-uniformity`, `sentence-rhythm`, `stock-transition`, `unprompted-denial`

## Your team's words

Rules that check only what your team lists in chaff.yaml: spellings, jargon, required headings. With nothing listed, they say nothing.

No sample in this group yet.

Rules with no sample yet: `internal-jargon`, `preferred-term`, `required-sections`, `requirement-modal`

The checks that read meaning run under `npx chaffjs test`, which asks an AI, so they have no fixed output to show here: `empty-conclusion`, `generic-opening`, `risk-disclosure`, `unsourced-number`
