# Bibliography

This page lists the papers and standards behind chaff's rules.
Every entry was checked against its original record (the journal, the publisher or the standards body) before it was listed.
Each entry says what the work found and how chaff uses it.

## How to read an entry

Entries are grouped by topic. Each one has three parts.

| Part | What it holds |
| --- | --- |
| Reference | Authors, year, title, where it appeared, and a link to the original record |
| Found | What the work showed, in one or two sentences |
| In chaff | The rules it supports. A work chaff does not use directly is marked [background], with the reason |

Neither a readability formula nor a detector of generated text decides whether a document is good.
Both only show statistical tendencies.
That is why chaff never grades a document. It points at each place to fix, one at a time.
The rules themselves are listed in the [Reference](./reference).

## Japanese readability

- <a id="shibasaki-tamaoka-2010"></a>**柴崎秀子, 玉岡賀津雄 (Shibasaki and Tamaoka, 2010)** [doi.org](https://doi.org/10.15077/jjet.KJ00006063558)
  - 「国語科教科書を基にした小・中学校の文章難易学年判定式の構築」 (a formula for the school grade of a text, built from Japanese-language textbooks)
  - Appeared in: 日本教育工学会論文誌 (Japan Journal of Educational Technology) 33(4), 449–458.
  - Found: From 205 textbook passages, the authors built a formula that predicts which school grade a text suits.
    Only two measures mattered: the share of hiragana, and the number of predicates in a sentence.
  - In chaff: the grounds for [`max-kanji-continuous`](../../rules/max-kanji-continuous/) and
    [`max-sentence-length`](../../rules/max-sentence-length/).
- <a id="lee-2016"></a>**李在鎬 (Lee Jae-ho, 2016)** [jhlee.sakura.ne.jp (PDF)](http://jhlee.sakura.ne.jp/papers/lee2016.pdf)
  - 「日本語教育のための文章難易度に関する研究」 (text difficulty for teaching Japanese)
  - Appeared in: 早稲田日本語教育学 (Waseda Studies in Japanese Language Education) 21, 1–16.
  - Found: A formula that places a text on six levels for learners of Japanese.
    It uses average sentence length and the shares of Sino-Japanese words, native words, verbs and particles.
    The jReadability website is built on it.
  - In chaff: more Sino-Japanese words made a text harder, which backs `max-kanji-continuous`.
- <a id="sato-2008"></a>**Sato, Matsuyoshi, Kondoh (2008)** [aclanthology.org](https://aclanthology.org/L08-1230/)
  - Automatic Assessment of Japanese Text Readability Based on a Textbook Corpus
  - Appeared in: LREC 2008.
  - Found: Using textbooks from first grade to university, the authors predicted a text's grade from its characters alone.
    This is the basis of the readability tool Obi (帯). It needs no word segmentation.
  - In chaff: [background] chaff gives no grade. It points at the hard places instead.
- <a id="sato-2011"></a>**佐藤理史 (Sato, 2011)** [cir.nii.ac.jp](https://cir.nii.ac.jp/crid/1050845762830703616)
  - 「均衡コーパスを規範とするテキスト難易度測定」 (text difficulty measured against a balanced corpus)
  - Appeared in: 情報処理学会論文誌 (IPSJ Journal) 52(4), 1777–1789.
  - Found: Difficulty is shown as where a text sits among real Japanese texts of all kinds, not against school grades.
  - In chaff: [background] the same idea as chaff's genres, which set different limits for different kinds of document.
- <a id="yasashii-nihongo-2020"></a>**Immigration Services Agency of Japan and Agency for Cultural Affairs (2020)** [bunka.go.jp (PDF)](https://www.bunka.go.jp/seisaku/kokugo_nihongo/kyoiku/pdf/92484001_01.pdf)
  - 『在留支援のためのやさしい日本語ガイドライン』 (guidelines for plain Japanese for foreign residents)
  - Found: How to write Japanese that foreign residents understand.
    It asks for short sentences, no double negatives, few passives, consistent です・ます endings and not too many kanji.
    It sets no number of characters per sentence.
  - In chaff: `max-sentence-length`, [`no-mixed-desumasu`](../../rules/no-mixed-desumasu/) and
    [`agentless-passive`](../../rules/agentless-passive/) check three of these points.
- <a id="iori-2016"></a>**庵功雄 (Iori, 2016)** [iwanami.co.jp](https://www.iwanami.co.jp/book/b243840.html)
  - 『やさしい日本語―多文化共生社会へ』 (plain Japanese, toward a multicultural society)
  - Appeared in: Iwanami Shinsho (a book).
  - Found: How plain Japanese began after the 1995 Kobe earthquake, and whom it is for.
  - In chaff: [background] it explains why to write short and plain, rather than giving a limit.

## English readability and plain English

- <a id="flesch-1948"></a>**Flesch (1948)** [doi.org](https://doi.org/10.1037/h0057532)
  - A new readability yardstick
  - Appeared in: Journal of Applied Psychology 32(3), 221–233.
  - Found: A score from 0 to 100, from sentence length and syllables per word.
    About 70 is "easy" and about 30 is "very difficult".
  - In chaff: [background] sentence length is in every formula. chaff checks it directly with `max-sentence-length`.
- <a id="kincaid-1975"></a>**Kincaid et al. (1975)** [eric.ed.gov](https://eric.ed.gov/?id=ED108134)
  - Derivation of New Readability Formulas (Automated Readability Index, Fog Count and Flesch Reading Ease Formula) for Navy Enlisted Personnel
  - Appeared in: US Navy Research Branch Report 8-75.
  - Found: Using 531 Navy enlisted personnel, the formulas were recalculated to give a school grade.
    This is the Flesch–Kincaid grade level in wide use today.
  - In chaff: [background] a grade means little until the readers are known, so chaff does not give one.
- <a id="dale-chall-1948"></a>**Dale, Chall (1948)** [files.eric.ed.gov (PDF)](https://files.eric.ed.gov/fulltext/ED506404.pdf)
  - A Formula for Predicting Readability
  - Appeared in: Educational Research Bulletin 27(1), 11–20, 28. The link is the ERIC PDF that reprints it.
  - Found: Readability from the share of words outside a list of 3,000 familiar words, and sentence length.
  - In chaff: [background] chaff ships no word lists of its own. A team lists the words its readers will not know in `chaff.yaml`.
- <a id="redish-2000"></a>**Redish (2000)** [doi.org](https://doi.org/10.1145/344599.344637)
  - Readability formulas have even more limitations than Klare discusses
  - Appeared in: ACM Journal of Computer Documentation 24(3), 132–137.
  - Found: A formula tells you neither why a text is hard nor how to fix it.
    The formulas were built on children's schoolbooks, and nobody knows whether they hold for adult technical writing.
  - In chaff: the reason chaff gives no score, and names the place and the reason instead.
- <a id="crossley-2019"></a>**Crossley, Skalicky, Dascalu (2019)** [doi.org](https://doi.org/10.1111/1467-9817.12283)
  - Moving beyond classic readability formulas: new methods and new models
  - Appeared in: Journal of Research in Reading 42(3–4), 541–561.
  - Found: Using readers' judgments of comprehension, models built from many language features beat classic formulas such as Flesch–Kincaid.
  - In chaff: [background] a trained model does not belong in chaff's checks, which must give the same result for the same text.
- <a id="plain-2011"></a>**PLAIN (2011)** [wid.org (PDF)](https://wid.org/wp-content/uploads/2022/03/FederalPLGuidelines.pdf)
  - Federal Plain Language Guidelines
  - Appeared in: guidance for US federal agencies. The PDF is gone from the government site, so the link is a copy at wid.org.
  - Found: Use the active voice, call the same thing by the same word, use fewer abbreviations, and avoid double negatives.
    Use "must", not "shall", for requirements, and keep sentences and paragraphs short. It gives no word limit.
  - In chaff: `agentless-passive`, [`preferred-term`](../../rules/preferred-term/) and
    [`undefined-acronym`](../../rules/undefined-acronym/) check the voice, the terms and the abbreviations.
- <a id="gov-uk-clear-language"></a>**Government Digital Service (UK)** [guidance.publishing.service.gov.uk](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/)
  - Use clear language
  - Appeared in: GOV.UK content and publishing guidance.
  - Found: Split sentences over 25 words. Keep paragraphs to 5 sentences or fewer.
  - In chaff: the `normal` level of `max-sentence-length` for English (25 words) and of
    [`max-paragraph-length`](../../rules/max-paragraph-length/) (5 sentences) match these numbers.
- <a id="iso-24495-1"></a>**ISO 24495-1:2023** [cdn.standards.iteh.ai (PDF)](https://cdn.standards.iteh.ai/samples/78907/d194fac21d6a45f38bfcfec9657f7498/ISO-24495-1-2023.pdf)
  - Plain language — Part 1: Governing principles and guidelines
  - Appeared in: ISO. The link is the sample PDF published by the reseller iTeh.
  - Found: The international standard defines plain language by whether readers can find, understand and use what they need.
    It measures that by what readers can do, not by mechanical measures such as readability formulas.
  - In chaff: like Redish, a reason chaff does not grade documents.

## Rules for writing and notation

- <a id="koyobun-2022"></a>**文化審議会 (Council for Cultural Affairs, 2022)** [bunka.go.jp (PDF)](https://www.bunka.go.jp/seisaku/bunkashingikai/kokugo/hokoku/pdf/93651301_01.pdf)
  - 「公用文作成の考え方」 (how to write public documents)
  - Appeared in: a recommendation to the government, 7 January 2022.
  - Found: Once a sentence reaches about 50 to 60 characters, check whether it has become hard to read.
    Documents for the public use です・ます, loanwords keep the final ー (コンピューター), and full-width and half-width characters are used consistently.
  - In chaff: `max-sentence-length`, `no-mixed-desumasu`,
    [`katakana-long-vowel`](../../rules/katakana-long-vowel/) and [`latin-spacing`](../../rules/latin-spacing/) check these points.
- <a id="gairaigo-1991"></a>**Cabinet notice (1991)** [bunka.go.jp](https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/gairai/honbun06.html)
  - 「外来語の表記」 (how to write loanwords)
  - Appeared in: Cabinet notice No. 2 of 1991.
  - Found: English endings such as -er, -or and -ar are written with a long-vowel mark ー as a rule.
    It also allows the mark to be dropped where that is customary.
  - In chaff: `style: bunkacho` in `chaff.yaml` runs `katakana-long-vowel` by this rule.
- <a id="jis-z8301-2019"></a>**JIS Z 8301:2019** [webdesk.jsa.or.jp](https://webdesk.jsa.or.jp/books/W11M0090/index/?bunsyo_id=JIS+Z+8301%3A2019)
  - 「規格票の様式及び作成方法」 (rules for drafting Japanese Industrial Standards)
  - Appeared in: Japanese Standards Association.
  - Found: It fixes the sentence endings for a requirement, a prohibition, a recommendation and a permission, and does not use 「すべきである」.
    It avoids vague pointers such as 「上記の図」 ("the figure above") and keeps an abbreviation the same throughout.
    The 2011 edition dropped the final ー of loanwords of three morae or more.
  - In chaff: `undefined-acronym` and [`dangling-reference`](../../rules/dangling-reference/) check the abbreviations and the pointers.
    `style: jis-z8301-2011` runs `katakana-long-vowel` by the 2011 edition's rule.
- <a id="kyodo-2022"></a>**Kyodo News, ed. (2022)** [kyodo.co.jp](https://www.kyodo.co.jp/publish/%E8%A8%98%E8%80%85%E3%83%8F%E3%83%B3%E3%83%89%E3%83%96%E3%83%83%E3%82%AF%E3%80%80%E6%96%B0%E8%81%9E%E7%94%A8%E5%AD%97%E7%94%A8%E8%AA%9E%E9%9B%86%E3%80%80%E7%AC%AC%EF%BC%91%EF%BC%94%E7%89%88/)
  - 『記者ハンドブック 新聞用字用語集 第 14 版』 (the Kyodo reporters' handbook, 14th edition)
  - Found: A book of the spellings and word choices used in Japanese newspapers. Press officers and web writers use it as well as reporters.
  - In chaff: chaff ships no spellings of its own. Words a team takes from this book go under `prefer` in `chaff.yaml`,
    and `preferred-term` checks them.
- <a id="jtf-style-guide"></a>**Japan Translation Federation (JTF)** [jtf.jp](https://www.jtf.jp/tips/styleguide)
  - 『JTF 日本語標準スタイルガイド（翻訳用）』 (the JTF style guide for Japanese translation)
  - Found: Twelve basic rules, all of which a machine can check.
    Among them: do not mix です・ます with である, keep the final ー on katakana words, and put no space between full-width and half-width characters.
  - In chaff: `no-mixed-desumasu`, `katakana-long-vowel` and `latin-spacing` check close to these rules.
    chaff does not decide whether to put the space. It checks only that one document is consistent.

## Scoring writing and finding errors

- <a id="attali-burstein-2006"></a>**Attali, Burstein (2006)** [ejournals.bc.edu](https://ejournals.bc.edu/index.php/jtla/article/view/1650)
  - Automated Essay Scoring With e-rater V.2
  - Appeared in: Journal of Technology, Learning, and Assessment 4(3).
  - Found: A system that scores test essays. It showed that a small set of meaningful features is enough to score them.
  - In chaff: [background] chaff does not score documents.
- <a id="ke-ng-2019"></a>**Ke, Ng (2019)** [doi.org](https://doi.org/10.24963/ijcai.2019/879)
  - Automated Essay Scoring: A Survey of the State of the Art
  - Appeared in: IJCAI-19.
  - Found: A review of 50 years of essay scoring research. It concludes the task is far from solved.
  - In chaff: [background] one more reason chaff points at places rather than giving a score.
- <a id="ng-2014"></a>**Ng et al. (2014)** [aclanthology.org](https://aclanthology.org/W14-1701/)
  - The CoNLL-2014 Shared Task on Grammatical Error Correction
  - Appeared in: CoNLL 2014.
  - Found: A shared task to correct grammar in essays by learners of English. It widened the previous year's five error types to all types.
  - In chaff: [background] chaff does not correct grammar, and never rewrites text.
- <a id="bryant-2023"></a>**Bryant et al. (2023)** [aclanthology.org](https://aclanthology.org/2023.cl-3.4/)
  - Grammatical Error Correction: A Survey of the State of the Art
  - Appeared in: Computational Linguistics 49(3), 643–701.
  - Found: How grammar correction moved from hand-written rules, to statistics, to machine translation.
  - In chaff: [background] a guide to which errors rules can catch, the part chaff takes on.
- <a id="mizumoto-2011"></a>**Mizumoto et al. (2011)** [aclanthology.org](https://aclanthology.org/I11-1017/)
  - Mining Revision Log of Language Learning SNS for Automated Japanese Error Correction of Second Language Learners
  - Appeared in: IJCNLP 2011.
  - Found: A large corpus of errors by learners of Japanese, taken from corrections on the language-learning site Lang-8.
  - In chaff: [background] research on learners' errors, a different readership from chaff's.
- <a id="koyama-2020"></a>**Koyama et al. (2020)** [aclanthology.org](https://aclanthology.org/2020.lrec-1.26/)
  - Construction of an Evaluation Corpus for Grammatical Error Correction for Learners of Japanese as a Second Language
  - Appeared in: LREC 2020.
  - Found: Lang-8 is too noisy to evaluate with, so the authors built a cleaner Japanese evaluation corpus, TEC-JL.
  - In chaff: [background] an example of why judging corrections needs answers a person has checked.
- <a id="yamamoto-cheng-2015"></a>**山本和英, 鄭育昌 (Yamamoto and Cheng, 2015)** [anlp.jp (PDF)](https://www.anlp.jp/proceedings/annual_meeting/2015/html/paper/WS_PNN12_j-proofreading.pdf)
  - 「Project Next 日本語校正タスク」 (the Project Next Japanese proofreading task)
  - Appeared in: a workshop at the 21st annual meeting of the Association for Natural Language Processing (Japan).
  - Found: A survey of the errors Japanese proofreading tools look for.
    A missing particle, the same particle twice in a row, or a mismatched adverb are easy for a machine. Errors that depend on context are hard.
  - In chaff: [`no-doubled-joshi`](../../rules/no-doubled-joshi/) finds the same particle repeated.

## What generated text looks like

The works in this section study what tends to show up in generated text.
chaff uses them to point at phrasing and formatting, but it never says "an AI wrote this".
Several of them also show how often human writing is mistaken for generated text.

- <a id="gehrmann-2019"></a>**Gehrmann, Strobelt, Rush (2019)** [aclanthology.org](https://aclanthology.org/P19-3019/)
  - GLTR: Statistical Detection and Visualization of Generated Text
  - Appeared in: ACL 2019 System Demonstrations.
  - Found: Coloring each word by how predictable it is raised people's accuracy at spotting generated text from 54% to 72%.
  - In chaff: [background] it needs a language model's probabilities, which chaff's checks do not use.
- <a id="liang-2023"></a>**Liang et al. (2023)** [arxiv.org](https://arxiv.org/abs/2304.02819)
  - GPT detectors are biased against non-native English writers
  - Appeared in: Patterns.
  - Found: Popular AI detectors often label writing by non-native speakers of English as generated.
  - In chaff: the reason chaff judges phrasing, never the writer.
- <a id="wu-2025"></a>**Wu et al. (2025)** [aclanthology.org](https://aclanthology.org/2025.cl-1.8/)
  - A Survey on LLM-Generated Text Detection: Necessity, Methods, and Future Directions
  - Appeared in: Computational Linguistics 51(1), 275–338.
  - Found: Detection methods fall into four kinds: watermarks, statistics, trained classifiers and human judgment.
  - In chaff: [background] in these terms, chaff uses only surface counts.
- <a id="reinhart-2025"></a>**Reinhart et al. (2025)** [arxiv.org](https://arxiv.org/abs/2410.16107)
  - Do LLMs write like humans? Variation in grammatical and rhetorical styles
  - Appeared in: PNAS.
  - Found: Instruction-tuned models use participle clauses and nominalizations several times as often as people, and list nouns more.
  - In chaff: supports [`rule-of-three`](../../rules/rule-of-three/).
- <a id="kobak-2025"></a>**Kobak et al. (2025)** [arxiv.org](https://arxiv.org/abs/2406.07016)
  - Delving into LLM-assisted writing in biomedical publications through excess vocabulary
  - Appeared in: Science Advances 11(27).
  - Found: Across more than 15 million biomedical abstracts, words such as "delves", "underscores", "showcasing" and "pivotal" jumped in 2024.
  - In chaff: backs the English words [`ai-tell`](../../rules/ai-tell/) looks for.
- <a id="liang-2024"></a>**Liang et al. (2024)** [proceedings.mlr.press](https://proceedings.mlr.press/v235/liang24b.html)
  - Monitoring AI-Modified Content at Scale: A Case Study on the Impact of ChatGPT on AI Conference Peer Reviews
  - Appeared in: ICML 2024.
  - Found: In conference peer reviews, adjectives such as "commendable", "meticulous" and "intricate" rose sharply.
  - In chaff: supports `ai-tell`, and is why it speaks only when such words pile up, never at one word.
- <a id="zhang-2024"></a>**Zhang et al. (2024)** [arxiv.org](https://arxiv.org/abs/2409.11704)
  - From Lists to Emojis: How Format Bias Affects Model Alignment
  - Appeared in: arXiv (not peer reviewed).
  - Found: Human raters and AI judges alike favour lists, bold text, emojis and long answers, whatever the content.
    That is one reason models use these formats so much.
  - In chaff: [`bold-density`](../../rules/bold-density/), [`emoji-density`](../../rules/emoji-density/) and
    `rule-of-three` point at the places where this bias shows in a text.
- <a id="freeburg-2026"></a>**Freeburg (2026)** [arxiv.org](https://arxiv.org/abs/2603.27006)
  - The Last Fingerprint: How Markdown Training Shapes LLM Prose
  - Appeared in: arXiv (not peer reviewed).
  - Found: Across 12 models, how often a model uses the em dash (—) varies widely.
  - In chaff: supports [`no-em-dash`](../../rules/no-em-dash/), and is why it counts frequency instead of flagging one dash.
- <a id="zaitsu-jin-2023"></a>**Zaitsu, Jin (2023)** [doi.org](https://doi.org/10.1371/journal.pone.0288453)
  - Distinguishing ChatGPT(-3.5, -4)-generated and human-written papers through Japanese stylometric analysis
  - Appeared in: PLOS ONE 18(8).
  - Found: In Japanese papers, counting function words and where commas fall separated human and ChatGPT text well.
  - In chaff: [background] the separation uses a trained classifier, which chaff does not include.
- <a id="zaitsu-2025"></a>**Zaitsu et al. (2025)** [doi.org](https://doi.org/10.1371/journal.pone.0335369)
  - Stylometry can reveal artificial intelligence authorship, but humans struggle: A comparison of human and seven large language models in Japanese
  - Appeared in: PLOS ONE 20(10).
  - Found: Japanese text by seven models could be told apart by counting.
    Human judges did poorly, relying on surface cues such as sentence endings, conjunctions and punctuation.
  - In chaff: [background] counting beat human hunches, which is the position chaff takes.
- <a id="hayashi-aizawa-2026"></a>**林美佐, 相澤彰子 (Hayashi and Aizawa, 2026)** [anlp.jp (PDF)](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/B9-17.pdf)
  - 「LLM による日本語生成におけるモデル固有表現パターンの分析」 (model-specific phrasing in Japanese generated by LLMs)
  - Appeared in: the 32nd annual meeting of the Association for Natural Language Processing (Japan), B9-17.
  - Found: Each model has set openings and closings, such as 「結論から申し上げますと」 ("to give the conclusion first") and 「ステップバイステップで説明します」 ("I will explain step by step").
  - In chaff: the same kind of phrasing as the chat leftovers [`assistant-residue`](../../rules/assistant-residue/) looks for.
- <a id="iwamoto-2026"></a>**岩本海風, 宮本友樹, 内海彰 (Iwamoto, Miyamoto and Utsumi, 2026)** [anlp.jp (PDF)](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/P9-11.pdf)
  - 「大規模言語モデルで生成された文学テキストの検出と有効な識別的特徴の探求」 (detecting literary text generated by LLMs, and the features that tell it apart)
  - Appeared in: the 32nd annual meeting of the Association for Natural Language Processing (Japan), P9-11.
  - Found: In poems, lyrics, haiku and short stories alike, generated Japanese text varied less in sentence length.
  - In chaff: supports [`sentence-rhythm`](../../rules/sentence-rhythm/).

## Requirements and contradictions

- <a id="iso-29148"></a>**ISO/IEC/IEEE 29148:2018** [standards.ieee.org](https://standards.ieee.org/ieee/29148/6937/)
  - Systems and software engineering — Life cycle processes — Requirements engineering
  - Found: The international standard for what makes a good requirement. It also names words to avoid, such as loopholes and vague adverbs.
  - In chaff: [background] Femmer et al., below, turned its language criteria into machine checks.
- <a id="berry-2003"></a>**Berry, Kamsties, Krieger (2003)** [cs.uwaterloo.ca (PDF)](https://cs.uwaterloo.ca/~dberry/handbook/ambiguityHandbook.pdf)
  - From Contract Drafting to Software Specification: Linguistic Sources of Ambiguity
  - Found: A handbook of words that let contracts and specifications be read two ways.
    It covers "and/or", "all" against "each", where "only" goes, and pronouns that point at nothing clear.
  - In chaff: [background] most of these are not chaff rules yet.
- <a id="femmer-2017"></a>**Femmer et al. (2017)** [doi.org](https://doi.org/10.1016/j.jss.2016.02.047)
  - Rapid quality assurance with Requirements Smells
  - Appeared in: Journal of Systems and Software 123, 190–213.
  - Found: Machine checks for warning signs in requirements.
    The signs are subjective words, vague adverbs, loopholes, superlatives, comparatives, negatives, vague pronouns and incomplete references.
    On average 59% of the findings were right, and 82% of the real problems were found.
  - In chaff: supports [`unqualified-superlative`](../../rules/unqualified-superlative/),
    [`excessive-hedging`](../../rules/excessive-hedging/) and `dangling-reference`.
    It also matches chaff's view that a person confirms what a machine finds.
- <a id="gervasi-zowghi-2005"></a>**Gervasi, Zowghi (2005)** [doi.org](https://doi.org/10.1145/1072997.1072999)
  - Reasoning about inconsistencies in natural language requirements
  - Appeared in: ACM Transactions on Software Engineering and Methodology 14(3), 277–330.
  - Found: Requirements written in plain language were turned into logic, and requirements that contradict each other were found automatically.
  - In chaff: [background] turning sentences into logic is beyond what chaff does.
- <a id="de-marneffe-2008"></a>**de Marneffe, Rafferty, Manning (2008)** [aclanthology.org](https://aclanthology.org/P08-1118/)
  - Finding Contradictions in Text
  - Appeared in: ACL-08.
  - Found: Some contradictions are easy to see, such as negation, opposite words and numbers that disagree. Others need knowledge of the world.
  - In chaff: the basis for checking numbers and dates by machine, as [`total-mismatch`](../../rules/total-mismatch/) and
    [`date-order`](../../rules/date-order/) do.
- <a id="mavin-2009"></a>**Mavin et al. (2009)** [doi.org](https://doi.org/10.1109/RE.2009.9)
  - Easy Approach to Requirements Syntax (EARS)
  - Appeared in: RE'09.
  - Found: Writing every requirement in one of five fixed patterns cut common problems such as ambiguity.
  - In chaff: [background] no rule checks these patterns yet.
