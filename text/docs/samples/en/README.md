<!-- yarn samples:update writes this file from the rules and the samples. Do not edit it by hand. -->

# Samples of what chaff fixes

One sample per rule: a mistake chaff finds, shown on a short document of the kind where it happens.
Each sample has the original text, what chaff says about it, the corrected text, how it was fixed, and the settings.
What chaff says is its real output on that text.

To try it on your own text, run `npx chaffjs your-file.md` with Node.js 24 or later. Nothing to install, no settings.
Or paste a draft into the [playground](https://isamu.github.io/lab/en/playground/).

日本語の見本: [../ja/README.md](../ja/README.md)

Rules with a sample: 74 / 259

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
| [Passive with no actor](agentless-passive.md) (`agentless-passive`) | A passive sentence ("the budget was approved") that never says who did it |
| [Cliché](cliche.md) (`cliche`) | A worn phrase such as "at the end of the day" or "low-hanging fruit" |
| [Cliched closing](closing-cliche.md) (`closing-cliche`) | A stock closing such as "Hope this helps" that leaves the reader nothing |
| [A comparison with nothing to compare with](comparative-without-baseline.md) (`comparative-without-baseline`) | A comparison such as "is faster" that never says faster than what |
| [Too many softeners](cushion-phrase-density.md) (`cushion-phrase-density`) | So many softeners ("sorry to bother", "just wanted to") that the ask gets lost |
| [Dangling participle](dangling-participle.md) (`dangling-participle`) | An opening participle followed by an empty "it" or "there" as the subject |
| [Empty intensifier](empty-intensifier.md) (`empty-intensifier`) | Words like "extremely important" that add weight without saying what matters |
| [Too much hedging](excessive-hedging.md) (`excessive-hedging`) | Hedges piled up ("it may perhaps be possible") until nobody is saying anything |
| [Open list that a limit closes](nado-closed-list.md) (`nado-closed-list`) | An open list (etc., and so on) that "only" or "limited to" closes |
| [Verbs hidden in nouns](nominalization.md) (`nominalization`) | Verbs hidden in nouns ("make a decision", "conduct an analysis"), used too often |
| [Nonstandard word](nonstandard-word.md) (`nonstandard-word`) | A word formal writing treats as nonstandard, such as "irregardless" |
| [A sentence that opens with a numeral](numeral-sentence-start.md) (`numeral-sentence-start`) | A sentence that opens with a numeral, such as "20 people came." |
| [A duty to act with no deadline (shall pay, shall return)](obligation-without-deadline.md) (`obligation-without-deadline`) | A duty to pay, deliver, return or notify with no deadline, where others have one |
| [An ordinal with the wrong ending](ordinal-suffix-mismatch.md) (`ordinal-suffix-mismatch`) | An ordinal whose ending does not fit its number, such as "3th" or "11st" |
| [Padded opening](padded-intro.md) (`padded-intro`) | An opening such as "In recent years, X has gained attention" that says nothing |
| [Redundant pair](redundant-expression.md) (`redundant-expression`) | Two words that say the same thing, such as "end result" or "each and every" |
| [Request with no deadline or owner](request-without-deadline.md) (`request-without-deadline`) | A request ("Please send …") with no deadline and no one named to do it |
| [A requirement that leaves its reader to decide](requirement-smell.md) (`requirement-smell`) | "As far as possible", "if necessary", "etc." or "and/or" in a requirement |
| [Sentence opening with "So,"](sentence-initial-so.md) (`sentence-initial-so`) | A sentence that opens with "So,", a spoken pause carried into writing |
| [An uncomparable adjective given a degree](uncomparable-graded.md) (`uncomparable-graded`) | A degree given to a word that has none, such as "very unique" |
| [Superlative with nothing to compare](unqualified-superlative.md) (`unqualified-superlative`) | A superlative such as "the fastest" with nothing to compare it against |
| [A time limit left to the reader (promptly)](vague-deadline.md) (`vague-deadline`) | A deadline written as "promptly" where other deadlines are in days |
| [Too many vague words](vague-word-density.md) (`vague-word-density`) | Too many vague words ("as appropriate", "as needed") for the length |
| [Too many "very" + adjective](very-adjective.md) (`very-adjective`) | "Very" + adjective, such as "very important", used too often |
| [Warning that gives no action](warning-without-action.md) (`warning-without-action`) | A Warning that names a risk but not what the reader should do |
| [Weasel words](weasel-word.md) (`weasel-word`) | Phrases like "many experts say" or "studies show" that credit no one |
| [Wordy phrase](wordy-phrase.md) (`wordy-phrase`) | Phrases like "in order to" or "due to the fact that" where one word does |

## Slips

Words and spaces left over from an edit.

| Rule | What it finds |
| --- | --- |
| [Words that do not agree](agreement-slip.md) (`agreement-slip`) | Words that no longer agree after an edit, as in "these new version" |
| ["a" or "an" against the next sound](article-sound.md) (`article-sound`) | "a" or "an" that does not fit the next sound, as in "a apple" or "an user" |
| [Weekday or month in lower case](calendar-name-case.md) (`calendar-name-case`) | A weekday or month written in lower case, as in "on monday" |
| [Chat citation residue](chat-citation-residue.md) (`chat-citation-residue`) | Marks a pasted chat answer leaves behind, such as "?utm_source=chatgpt.com" |
| ["And so on" said twice](doubled-nado.md) (`doubled-nado`) | "And etc." or など with 等: two words for "and so on" written together |
| [Doubled punctuation](doubled-punctuation.md) (`doubled-punctuation`) | Two punctuation marks side by side, as ",," or ".." |
| [Word written twice](doubled-word.md) (`doubled-word`) | The same word written twice in a row, as in "the the" |
| [Homophone typed for another (its / it's, their / there)](homophone-slip.md) (`homophone-slip`) | A sound-alike typed for another word, such as "it's own" or "their are" |
| [Hyphen used as a dash](hyphen-as-dash.md) (`hyphen-as-dash`) | A spaced hyphen or a double hyphen standing in for a dash |
| [Invisible character](invisible-character.md) (`invisible-character`) | Characters that do not show on screen, such as a zero-width space |
| [Common misspelling](known-misspelling.md) (`known-misspelling`) | A common misspelling, such as "definately" or "seperate" |
| [e.g. or i.e. missing a period](latin-abbreviation-form.md) (`latin-abbreviation-form`) | "e.g" or "eg." for "e.g.", and the same for "i.e." |
| ["Less" with a countable plural](less-for-fewer.md) (`less-for-fewer`) | "Less" before a countable plural, as in "less errors" for "fewer errors" |
| [Link text shows one address, the link goes to another](link-text-url-mismatch.md) (`link-text-url-mismatch`) | A link whose text is a URL on one site and whose target is on another |
| [Look-alike character](lookalike-character.md) (`lookalike-character`) | A character that looks like an ordinary one but is a different one |
| [No space after a comma](missing-space-after-comma.md) (`missing-space-after-comma`) | A comma between two words with no space after it, as in "address,and" |
| [Space before punctuation](space-before-punctuation.md) (`space-before-punctuation`) | A space before a period, comma or other mark, as in "word ." |
| [Unbalanced bracket](unbalanced-bracket.md) (`unbalanced-bracket`) | A bracket or quotation mark with no partner, such as a "(" that is never closed |
| [Unfilled placeholder](unfilled-placeholder.md) (`unfilled-placeholder`) | A template blank left unfilled, such as "[Your Name]" or "TODO: …" |
| [Word not in the dictionary](unknown-word.md) (`unknown-word`) | An English word not in the dictionary but one letter from one ("attched") |
| [Text runs on after a URL](url-run-on.md) (`url-run-on`) | A URL followed straight away by text that the link swallows |

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
