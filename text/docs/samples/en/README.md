<!-- yarn samples:update writes this file from the rules and the samples. Do not edit it by hand. -->

# Samples of what chaff fixes

One sample per rule: a mistake chaff finds, shown on a short document of the kind where it happens.
Each sample has the original text, what chaff says about it, the corrected text, how it was fixed, and the settings.
What chaff says is its real output on that text.

To try it on your own text, run `npx chaffjs your-file.md` with Node.js 24 or later. Nothing to install, no settings.
Or paste a draft into the [playground](https://isamu.github.io/lab/en/playground/).

日本語の見本: [../ja/README.md](../ja/README.md)

Rules with a sample: 61 / 259

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

| Rule | What it finds |
| --- | --- |
| [Abbreviation expanded two ways](acronym-expansion-conflict.md) (`acronym-expansion-conflict`) | The same abbreviation spelled out as two different names in one document |
| [Amounts of one size written two ways](amount-scale-consistency.md) (`amount-scale-consistency`) | Amounts written with and without a scale word ("$1.5 million", "$2,500,000") |
| [A bare URL among worded links](bare-url-mix.md) (`bare-url-mix`) | A URL written bare in a document whose other links are words |
| [Citations written in more than one style](citation-style-mix.md) (`citation-style-mix`) | A paper that cites as [1] in one place and as (Smith, 2020) in another |
| [Code blocks with and without a language](code-fence-language-mix.md) (`code-fence-language-mix`) | A code block without a language among blocks that name theirs |
| [Contraction use is inconsistent](contraction-consistency.md) (`contraction-consistency`) | The same word written both contracted ("don't") and in full ("do not") |
| [A word spelled differently in different files](cross-doc-term-variant.md) (`cross-doc-term-variant`) | The same word spelled one way in some files and another way in others |
| [A currency written two ways](currency-notation-consistency.md) (`currency-notation-consistency`) | One currency written two ways in one document, such as "$20" and "USD 20" |
| [Dates written two ways](date-format-consistency.md) (`date-format-consistency`) | Dates written two ways in one document, as "2026-10-02" and "October 2, 2026" |
| [A long name used again after its short name was defined](defined-name-repeated.md) (`defined-name-repeated`) | A party given a short name ("the Supplier") and later written out in full |
| [A defined term used in another form](defined-term-form.md) (`defined-term-form`) | A defined term later written in another form: quoted, lower case, or lengthened |
| [Ellipses written two ways](ellipsis-consistency.md) (`ellipsis-consistency`) | An ellipsis written two ways in one document, such as "..." and "…" |
| [Heading end punctuation mixed](heading-end-punctuation-mix.md) (`heading-end-punctuation-mix`) | Headings that end with a colon or full stop mixed with headings that do not |
| [List items in mixed forms](list-item-form-mix.md) (`list-item-form-mix`) | One list mixing phrases with sentences, or verb-first items with noun-first ones |
| [List bullets mixed](list-marker-mix.md) (`list-marker-mix`) | Bullets ("-", "*", "+", "・") mixed in one list or one document |
| [One name written two ways](name-variant.md) (`name-variant`) | The same person, company or product name written slightly differently |
| [Numbers written two ways](number-style-consistency.md) (`number-style-consistency`) | Numbers written two ways in one document, such as 1,000 and 1000 |
| [One word spelled two ways](orthographic-variant.md) (`orthographic-variant`) | One word written two ways in one document, such as e-mail and email |
| [A name outside the announced list](outside-announced-list.md) (`outside-announced-list`) | A platform or language named later that the list given earlier left out |
| [Oxford comma use is inconsistent](oxford-comma-consistency.md) (`oxford-comma-consistency`) | Lists that put a comma before the final "and" in some places and not in others |
| [A party named by its role instead of the name the contract gave it](party-role-name.md) (`party-role-name`) | A party given a short name ("the Supplier") and later called something else |
| [The document names itself or its reader two ways](person-consistency.md) (`person-consistency`) | One document calling itself or its reader two ways ("you" and "one") |
| [Straight and curly quotes mixed](quote-style-consistency.md) (`quote-style-consistency`) | Straight quotes (" ') and curly quotes (“ ” ’) mixed in one document |
| [Ranges written with two marks](range-notation-consistency.md) (`range-notation-consistency`) | Ranges written with two marks in one document, such as "10–20" and "10-20" |
| [One and two spaces between sentences mixed](sentence-spacing-consistency.md) (`sentence-spacing-consistency`) | One space between sentences in some places and two in others |
| [Shell commands with and without a prompt](shell-prompt-mix.md) (`shell-prompt-mix`) | Shell commands written with a "$" prompt in some places and without in others |
| [British and American spellings are mixed](spelling-consistency.md) (`spelling-consistency`) | British and American spellings (colour and color) mixed in one document |
| [A step written as a statement among instructions](step-statement-mix.md) (`step-statement-mix`) | Numbered steps that mix statements (The tool asks) with orders (Run it) |
| [One table header written two ways](table-header-variant.md) (`table-header-variant`) | The same column header written two ways across tables (Owner and Owners) |
| [Heading capitalisation is inconsistent](title-case-consistency.md) (`title-case-consistency`) | Headings that mix Title Case and sentence case |
| [Screen label written two ways](ui-label-variant.md) (`ui-label-variant`) | A screen label written two ways that differ only in case, spacing or a particle |
| [A term written like a defined term but defined nowhere](undefined-term.md) (`undefined-term`) | A term written like a defined one (its Affiliates) that is never defined |
| [Units spaced two ways](unit-spacing-consistency.md) (`unit-spacing-consistency`) | A number and its unit spaced in some places and not others (5 GB, 5GB) |
| [Restrictive "which" and "that" mixed](which-that-consistency.md) (`which-that-consistency`) | Restrictive clauses opened with "which" in some places and "that" in others |

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
