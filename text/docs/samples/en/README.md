<!-- yarn samples:update writes this file from the rules and the samples. Do not edit it by hand. -->

# Samples of what chaff fixes

One sample per rule: a mistake chaff finds, shown on a short document of the kind where it happens.
Each sample has the original text, what chaff says about it, the corrected text, how it was fixed, and the settings.
What chaff says is its real output on that text.

To try it on your own text, run `npx chaffjs your-file.md` with Node.js 24 or later. Nothing to install, no settings.
Or paste a draft into the [playground](https://isamu.github.io/lab/en/playground/).

日本語の見本: [../ja/README.md](../ja/README.md)

Rules with a sample: 144 / 259

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
