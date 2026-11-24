<!-- yarn samples:update writes this file from the rules and the samples. Do not edit it by hand. -->

# Samples of what chaff fixes

One sample per rule: a mistake chaff finds, shown on a short document of the kind where it happens.
Each sample has the original text, what chaff says about it, the corrected text, how it was fixed, and the settings.
What chaff says is its real output on that text.

To try it on your own text, run `npx chaffjs your-file.md` with Node.js 24 or later. Nothing to install, no settings.
Or paste a draft into the [playground](https://isamu.github.io/lab/en/playground/).

日本語の見本: [../ja/README.md](../ja/README.md)

Rules with a sample: 267 / 267

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
| [Filler word left in](filler-word.md) (`filler-word`) | Fillers such as "um" or "you know" left in minutes made from a transcript |
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
| [Item numbers written in mixed forms](enumeration-marker-mix.md) (`enumeration-marker-mix`) | Item numbers mixed in one run: "1.", "2.", "3)", "4." |
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
| [No space after the heading marks](heading-marker-no-space.md) (`heading-marker-no-space`) | A line like "##Steps", with no space after the marks, that is not a heading |
| [Heading numbering mixed](heading-numbering-mix.md) (`heading-numbering-mix`) | Sibling headings numbered in mixed ways: "1. Overview", "Steps", "3. Costs" |
| [Image without alt text](image-alt-text.md) (`image-alt-text`) | An image with no alt text, as in "![](chart.png)" |
| [Image alt text is a file name](image-file-name-alt.md) (`image-file-name-alt`) | An image whose alt text is a file name, as in "![IMG_1234.png](…)" |
| [Link definition that does nothing](link-definition-unused.md) (`link-definition-unused`) | A "[label]: URL" definition no link uses, or one defined twice with different addresses |
| [Opposite obligations on the same act](modal-conflict.md) (`modal-conflict`) | The same act required or allowed in one sentence and forbidden in another |
| [The lead only restates the title](no-lead.md) (`no-lead`) | A first paragraph under the title that only says the title again |
| [Number without its unit](number-without-unit.md) (`number-without-unit`) | A bare number where the other values in its column all have a unit |
| [Headings that are only a label and a number](numbered-generic-heading.md) (`numbered-generic-heading`) | Headings such as "Benefit 1" and "Tip 2" that are only a label and a number |
| [Skipped or repeated number](numbering-gap.md) (`numbering-gap`) | A numbered item that skips or repeats a number, such as Article 1 then 3 |
| [Too long before the point](preamble-length.md) (`preamble-length`) | Too many paragraphs before the first heading, which delays the point |
| [Prerequisite written after the steps](prerequisite-after-step.md) (`prerequisite-after-step`) | "Before you begin" written after the numbered steps it should come before |
| [A bold line used as a heading](pseudo-heading.md) (`pseudo-heading`) | A bold line standing in for a heading in a document that uses headings |
| [A required skill listed again as preferred](required-listed-as-preferred.md) (`required-listed-as-preferred`) | A job posting that lists one skill both as required and as preferred |
| [Link written the wrong way round](reversed-link.md) (`reversed-link`) | A link written "(text)[URL]", with the brackets the wrong way round |
| [A reference to a step that does not exist](step-reference-missing.md) (`step-reference-missing`) | A reference such as "see step 5" past the last step the document has |
| [Line swallowed by a table](table-absorbed-line.md) (`table-absorbed-line`) | A sentence written right under a table with no blank line, which becomes a row of the table |
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

| Rule | What it finds |
| --- | --- |
| [An amount range whose upper end is below its lower end](amount-range-reversed.md) (`amount-range-reversed`) | An amount range that ends lower than it starts, such as "$90,000–$70,000" |
| [A list that does not have the number of items announced](announced-count-mismatch.md) (`announced-count-mismatch`) | A list whose number of items differs from the number announced just before it |
| [Annual days off fewer than the weekly days off give](annual-holidays-mismatch.md) (`annual-holidays-mismatch`) | Annual days off fewer than the 104 days that two days off every week give |
| [An example annual pay that is not the monthly pay and bonus](annual-pay-mismatch.md) (`annual-pay-mismatch`) | An example annual pay that is not 12 months' pay plus the bonus months |
| [An arrival before its departure](arrival-before-departure.md) (`arrival-before-departure`) | A flight or a train in an itinerary that arrives before it departs |
| [Attachment mentioned but not shown](attachment-not-attached.md) (`attachment-not-attached`) | A sent email that says something is attached but shows no attachment |
| [A backordered quantity that is not the ordered less the delivered](backorder-mismatch.md) (`backorder-mismatch`) | A backordered quantity that is not the ordered less the delivered on its row |
| [A BMI the height and weight beside it do not give](bmi-mismatch.md) (`bmi-mismatch`) | A BMI in a checkup that the weight divided by the height squared does not give |
| [A runtime longer than the battery capacity divided by the consumption](capacity-runtime-mismatch.md) (`capacity-runtime-mismatch`) | A runtime longer than the battery capacity divided by its consumption |
| [A rate of change the two values do not give](change-rate-mismatch.md) (`change-rate-mismatch`) | A rate of change the two values in one sentence or table row do not give |
| [Citations and reference list do not match](citation-reference-mismatch.md) (`citation-reference-mismatch`) | A citation with no entry in the reference list, or an entry the text never cites |
| [A closing balance that is not the opening balance plus deposits less withdrawals](closing-balance-mismatch.md) (`closing-balance-mismatch`) | A closing balance that is not the opening balance plus deposits less withdrawals |
| [A connection shorter than the stated travel time](connection-time-short.md) (`connection-time-short`) | An itinerary that leaves less time for a connection than the trip it states |
| [A contact written two ways](contact-variant.md) (`contact-variant`) | An email or postal address written differently in one place |
| [More registered than the stated capacity](count-over-capacity.md) (`count-over-capacity`) | A stated capacity smaller than the number registered |
| [One item given different values in different files](cross-doc-fact-conflict.md) (`cross-doc-fact-conflict`) | The same item (a fee, a deadline, a contact) given different values in two files |
| [A cumulative figure lower than this period's](cumulative-below-current.md) (`cumulative-below-current`) | A year-to-date figure lower than the same row's figure for this period |
| [One amount in another currency in a column of amounts](currency-column-mix.md) (`currency-column-mix`) | A lone amount in another currency in a column, such as ¥12,500 among dollars |
| [Reference to a missing figure or table](dangling-figure-reference.md) (`dangling-figure-reference`) | A figure or table the text refers to that the document does not have |
| [A date out of order in a schedule](date-order.md) (`date-order`) | One date out of order in an itinerary, a schedule or a changelog's headings |
| [A date outside the stated period](date-outside-period.md) (`date-outside-period`) | A dated item outside the period the document gives, such as a trip's dates |
| [A period that ends before it starts](date-range-reversed.md) (`date-range-reversed`) | A period whose end date comes before its start date |
| [An established date after the last update](date-stamp-order.md) (`date-stamp-order`) | An established date later than the last update at the foot of a policy or terms |
| [Date and weekday disagree](date-weekday-mismatch.md) (`date-weekday-mismatch`) | A date and its weekday that disagree, such as "Friday, 1 October 2026" |
| [A registration deadline after the event](deadline-after-event.md) (`deadline-after-event`) | A sign-up or RSVP deadline that falls after the event itself |
| [A deductible larger than the most paid](deductible-exceeds-limit.md) (`deductible-exceeds-limit`) | A deductible or excess larger than the most paid for the same benefit |
| [Default value stated two ways](default-value-mismatch.md) (`default-value-mismatch`) | A parameter's default that differs between the signature, a table and the text |
| [A delivered quantity larger than the ordered quantity](delivered-over-ordered.md) (`delivered-over-ordered`) | A row of an order table that delivers more than was ordered |
| [Deprecated name used in an example](deprecated-option-used.md) (`deprecated-option-used`) | An option the document calls deprecated, still used in one of its examples |
| [A discount that the list price and the tier price do not give](discount-rate-mismatch.md) (`discount-rate-mismatch`) | A discount on a price list that the list price and the tier price do not give |
| [A due date before the issue date](due-before-issue.md) (`due-before-issue`) | A due date or other later date that falls before the date it must follow |
| [A start plus a length of time that does not reach the stated end](duration-mismatch.md) (`duration-mismatch`) | A start date plus a length of time that does not reach the end date given |
| [A number of sessions times their length that does not make the stated total](duration-product-mismatch.md) (`duration-product-mismatch`) | Sessions times the length of each that does not make the total given |
| [A count of years that does not match its starting year](elapsed-years-mismatch.md) (`elapsed-years-mismatch`) | A count of years or an age that does not match its starting year or birth date |
| [One item given two different values](fact-conflict.md) (`fact-conflict`) | The same item (a deadline, a fee) given two different values in one section |
| [An amount that is not what its label's formula gives](formula-amount-mismatch.md) (`formula-amount-mismatch`) | An amount that is not what its label's formula ("5% of the sale price") gives |
| [A grade-point average the course rows do not give](gpa-mismatch.md) (`gpa-mismatch`) | A grade-point average that is not what the course grades and credits give |
| [A heading names a command its section's code does not show](heading-command-missing.md) (`heading-command-missing`) | A command or option named in a heading that the section's examples never use |
| [A date the calendar does not have](impossible-date.md) (`impossible-date`) | A date not on the calendar ("February 30"), or a year two calendars disagree on |
| [A time the clock does not have](impossible-time.md) (`impossible-time`) | A time the clock does not have, such as "13 PM", "午後13時" or "10:75" |
| [A total of payments that is not the payments added up](installment-total-mismatch.md) (`installment-total-mismatch`) | A total of payments that is not the number of payments times the payment |
| [An interest amount that is not the stated balance times the stated rate](interest-mismatch.md) (`interest-mismatch`) | Interest on a statement that is not the stated balance times the stated rate |
| [A minimum interval and a maximum count of uses that cannot both hold, or a count that differs from the table](interval-count-mismatch.md) (`interval-count-mismatch`) | A minimum gap and maximum count that conflict, or a maximum unlike the table's |
| [A layout that does not match the rooms listed](layout-code-mismatch.md) (`layout-code-mismatch`) | A room layout such as "3 bedrooms" that does not match the rooms listed |
| [Quantity times unit price is not the line amount](line-amount-mismatch.md) (`line-amount-mismatch`) | A line of a quote or invoice whose quantity times price is not its amount |
| [The meter readings' difference is not the usage](meter-usage-mismatch.md) (`meter-usage-mismatch`) | A utility bill whose current minus previous meter reading is not the usage |
| [A net amount that is not the gross amount minus the deductions](net-amount-mismatch.md) (`net-amount-mismatch`) | A net pay that is not the gross pay minus the total deductions |
| [A net weight larger than the gross weight](net-over-gross.md) (`net-over-gross`) | A row of a packing list whose net weight is larger than its gross weight |
| [Number in words differs from its figure](number-word-figure-mismatch.md) (`number-word-figure-mismatch`) | A number in words with a different figure in brackets, as "six (7) months" |
| [Parameter table that does not match the signature](parameter-table-mismatch.md) (`parameter-table-mismatch`) | A parameter in only one of a signature and the parameter table under it |
| [Shares of a whole that do not add up to 100%](percent-sum-mismatch.md) (`percent-sum-mismatch`) | A breakdown whose percentages do not add up to 100% |
| [A period other than the one the title reports](period-label-conflict.md) (`period-label-conflict`) | Not the title's period: Q3 in a Q2 release, tax year 2025 in a 2026 statement |
| [An amount that is not the stated number of payments](period-multiple-mismatch.md) (`period-multiple-mismatch`) | An amount said to be 12 monthly payments that is not 12 times the monthly one |
| [A part of a period that is longer than the period](period-part-exceeds-whole.md) (`period-part-exceeds-whole`) | A part of a period longer than the whole: 18 months within a 12-month warranty |
| [Phone number with two digits swapped](phone-number-variant.md) (`phone-number-variant`) | A phone number written elsewhere with two digits swapped |
| [An amount per use times the uses that goes over the stated maximum](product-exceeds-maximum.md) (`product-exceeds-maximum`) | An amount per use times the uses per period that is over that period's maximum |
| [A measured range whose upper end is below its lower end](quantity-range-reversed.md) (`quantity-range-reversed`) | A measured range that ends lower than it starts, such as "-10 to -40 °C" |
| [A quotation given to a speaker with no name](quote-unnamed-speaker.md) (`quote-unnamed-speaker`) | A quotation given to a speaker named only by a role ("…," said an analyst) |
| [A quotation given to someone, with no source](quote-without-source.md) (`quote-without-source`) | A quotation given to someone ("X said …") in a paragraph that gives no source |
| [Bands that overlap or leave a gap](range-band-mismatch.md) (`range-band-mismatch`) | Neighbouring bands that overlap or leave a gap, such as "7 to 12", "12 to 14" |
| [A margin the two values it divides do not give](ratio-mismatch.md) (`ratio-mismatch`) | A margin in a table or sentence that is not its profit divided by its sales |
| [A flag that does not match the result and its reference range](reference-flag-mismatch.md) (`reference-flag-mismatch`) | A lab result flagged high though within its range, or normal though outside it |
| [The same receipt or invoice number on two rows of an itemised table](reference-number-repeated.md) (`reference-number-repeated`) | The same receipt or invoice number written on two rows of one itemised table |
| [Booking or reference number with two characters swapped](reference-number-variant.md) (`reference-number-variant`) | A booking number written once with two neighbours swapped (MN-48215, MN-48251) |
| [A reference whose name does not match its target's heading](reference-title-mismatch.md) (`reference-title-mismatch`) | A reference's title ("Section 5 (Privacy)") that differs from the heading |
| [A reference to a topic its target never mentions](reference-topic-missing.md) (`reference-topic-missing`) | A reference that names a topic ("see Section 2 for pricing") never found there |
| [A test result in another unit than its reference range](reference-unit-mismatch.md) (`reference-unit-mismatch`) | A results table row whose result and reference range are in different units |
| [A relative date that does not match its base date](relative-date-mismatch.md) (`relative-date-mismatch`) | A date given as "two weeks later, on May 16" that is not that far away |
| [A deposit that is not the stated months of rent](rent-multiple-mismatch.md) (`rent-multiple-mismatch`) | A deposit amount that is not the stated months of rent |
| [A return type stated two ways](return-type-mismatch.md) (`return-type-mismatch`) | A return type that the signature and the description state differently |
| [A forecast revision that moves the other way](revision-direction-mismatch.md) (`revision-direction-mismatch`) | A forecast said to be revised up whose new figure is lower, or the reverse |
| [A running balance the row above and this row's amounts do not give](running-balance-mismatch.md) (`running-balance-mismatch`) | A running balance that is not the balance above plus or minus this row's amounts |
| [One row of a servings table that does not scale with the others](scaled-quantity-mismatch.md) (`scaled-quantity-mismatch`) | A recipe table with one row that does not scale with the servings |
| [A serial or lot number range that ends below where it starts](serial-range-reversed.md) (`serial-range-reversed`) | A serial or lot number range that ends below its start, such as "L5240 to L5210" |
| [An amount paid that is not the stated share of the total](share-amount-mismatch.md) (`share-amount-mismatch`) | An amount paid on a medical bill that is not the stated share (30%) of the total |
| [A share above 100%](share-over-hundred.md) (`share-over-hundred`) | A share of a group over 100%, such as "120% of respondents" |
| [A total time that is not the sum of the steps' times](step-time-sum-mismatch.md) (`step-time-sum-mismatch`) | A recipe or guide whose total time is not the sum of its steps' times |
| [A summary value that differs from the body](summary-fact-mismatch.md) (`summary-fact-mismatch`) | A value in the summary (a deadline, a fee) that differs from the body |
| [A table that mixes scales of amount](table-unit-mix.md) (`table-unit-mix`) | A cell in thousands in a table in millions, or a row a thousand times the others |
| [A tax that is not its rate of the subtotal](tax-mismatch.md) (`tax-mismatch`) | A tax line, or a price list's price with tax, that does not match the tax rate |
| [A member's tier that their own points or nights do not reach](tier-threshold-mismatch.md) (`tier-threshold-mismatch`) | A stated tier whose member's points or nights fall outside that tier's band |
| [A time out of order in a day's schedule](time-order.md) (`time-order`) | One time out of order in an itinerary or a day's programme |
| [A time range that ends before it starts](time-range-reversed.md) (`time-range-reversed`) | A time range whose end comes before its start |
| [A total that is not the sum of its items](total-mismatch.md) (`total-mismatch`) | A total in a quote, invoice or contract that is not the sum of its items |
| [Example calls a function the page does not define](undefined-function-call.md) (`undefined-function-call`) | An example calling a name the page never defines, close to one it documents |
| [One item given in two units that do not convert](unit-mismatch.md) (`unit-mismatch`) | The same item in two units that do not convert ("5 km" and "3000 m") |
| [A variance that is not the difference of the budget and the actual](variance-mismatch.md) (`variance-mismatch`) | A table row whose variance is not the difference of its budget and actual |
| [The version in the text is not the one in the code](version-mismatch.md) (`version-mismatch`) | A version named right above a code block that the block does not use |
| [A version out of order in a changelog](version-order.md) (`version-order`) | One version out of order in a changelog or a list of releases |
| [A walking time that does not match the stated distance](walk-time-distance-mismatch.md) (`walk-time-distance-mismatch`) | A walking time that does not match the distance beside it |

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

| Rule | What it finds |
| --- | --- |
| [Words that only work inside](internal-jargon.md) (`internal-jargon`) | Words that only work inside your team, from jargon in chaff.yaml |
| [Not the team's spelling](preferred-term.md) (`preferred-term`) | A spelling the team chose not to use ("e-mail" for "email"), from chaff.yaml |
| [A required heading is missing](required-sections.md) (`required-sections`) | A heading the team requires (such as "Risks") missing, set in chaff.yaml |
| [A provision's verb form is not the one the house rule uses](requirement-modal.md) (`requirement-modal`) | A requirement's verb ("must", "shall") that the team's house rule does not use |
| [A term not written the listed way](term-form.md) (`term-form`) | A term listed under terms, in another case, width, hyphen or spacing (Github) |

The checks that read meaning run under `npx chaffjs test`, which asks an AI, so they have no fixed output to show here: `empty-conclusion`, `generic-opening`, `risk-disclosure`, `unsourced-number`
