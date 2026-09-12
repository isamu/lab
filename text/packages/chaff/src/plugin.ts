// 言語アダプタと genre pack が依存してよい唯一の面。spec §6。
// ここに実装を置かない。型だけを置く。

export type Span = { readonly start: number; readonly end: number };

/**
 * tokens は adapter が prepare 済みのときだけ入る。無いことと「品詞が無い文」を混ぜない。
 * token の span は文の span と同じ座標系（segment に渡した文字列の先頭が 0）。
 * 2 つの基準を混ぜると、ずれたときに どちらが悪いか分からなくなる。
 */
export type Sentence = { readonly span: Span; readonly text: string; readonly tokens?: readonly Token[] };

/**
 * 品詞は Universal Dependencies の UPOS に統一する。アダプタ独自の体系を露出させない。
 * features は UD の FEATS。「受動か」のように品詞だけでは足りず、かつ言語ごとに
 * 見え方が違うものを、アダプタが自分の言語の知識で畳んでここに置く。例: Voice=Pass。
 */
export type Token = {
  readonly span: Span;
  readonly surface: string;
  readonly pos: string;
  readonly lemma?: string;
  readonly features?: Readonly<Record<string, string>>;
};

export type Segmentation = {
  readonly sentences: readonly Sentence[];
  readonly words?: readonly Span[];
  readonly tokens?: readonly Token[];
};

export type LengthUnit = "char" | "word";

/** L2 の語彙表。detector は共通で、これだけが言語別。spec §11。 */
export type LexiconEntry = { readonly pattern: string; readonly weight?: number | undefined };

export type Lexicon = readonly LexiconEntry[];

/**
 * rule は required な capability を宣言し、満たされなければ skip される。
 * 日本語の品詞解析が 18MB の辞書を要することを、この一枚で吸収する。spec §16。
 */
export type AdapterCapabilities = {
  readonly sentenceSplit: true;
  readonly wordSplit: boolean;
  readonly pos: boolean;
  readonly lemma: boolean;
  readonly lengthUnit: LengthUnit;
};

/** prepare に渡す要求。動く rule が要らないものの代金を払わせない。 */
export type AdapterNeeds = { readonly pos: boolean };

export type LanguageAdapter = {
  readonly kind: "language";
  /** BCP 47 の primary subtag。"ja" / "en"。 */
  readonly id: string;
  readonly apiVersion: 1;
  readonly capabilities: AdapterCapabilities;
  /** この言語である確からしさ。0..1。 */
  readonly detect: (source: string) => number;
  /**
   * 解析器の読み込み。capabilities は「払えばできる」の宣言で、prepare が「払う」。
   * 日本語の辞書は初期化に 1.5 秒かかるので、要求されたときだけ呼ぶ。
   */
  readonly prepare?: (need: AdapterNeeds) => Promise<void>;
  readonly segment: (text: string) => Segmentation;
  /** L2 rule が word_list で引く。アダプタが自分の言語のぶんだけを持つ。 */
  readonly lexicons: Readonly<Record<string, Lexicon>>;
};

// ───────── 文書モデルと rule ─────────

export type Section = {
  /** 見出しの深さ。見出しより前の導入部は 0。 */
  readonly depth: number;
  readonly heading: string;
  readonly span: Span;
  readonly sentences: readonly Sentence[];
  /** この節に含まれる強調（Markdown の ** **）の数。 */
  readonly strongCount: number;
  /** 見出し直後の最初の文。heading-echo が見る。 */
  readonly firstSentence: Sentence | undefined;
};

/**
 * detector に渡る唯一の入り口。core が I/O を済ませてから呼ぶ。
 * detector は純関数で、fs / network / clock に触れない。spec §6。
 */
export type ProseDocument = {
  readonly path: string;
  readonly source: string;
  readonly language: string;
  readonly lengthUnit: LengthUnit;
  /** rule の requires を突き合わせる先。満たさない rule は理由付きで skip する。 */
  readonly capabilities: AdapterCapabilities;
  readonly sections: readonly Section[];
  readonly sentences: readonly Sentence[];
  /** 箇条書きの範囲。体言止めのように、箇条書きでは普通で本文では困る形が見る。 */
  readonly listSpans: readonly Span[];
  /** アダプタが持つ語彙表。detector は言語を知らずにこれを引く。 */
  readonly lexicons: Readonly<Record<string, Lexicon>>;
};

export type Severity = "error" | "warning" | "info";

export type Finding = {
  readonly rule: string;
  readonly severity: Severity;
  readonly line: number;
  readonly column: number;
  /** 引用して見せる範囲。非エンジニア向け出力が使う。 */
  readonly quote: string;
  /** message のプレースホルダに入れる値。 */
  readonly values: Readonly<Record<string, string | number>>;
};

/** rule 定義が threshold を渡す。数値は 4 語から解決済み。 */
export type DetectorOptions = {
  readonly limit: number;
  /** L2 のみ。rule 定義の word_list から解決した語彙表。 */
  readonly lexicon?: Lexicon | undefined;
  /** 見る範囲。opening は冒頭 2 段落、closing は最後の節、whole は全体。 */
  readonly where?: string | undefined;
};

export type Detector = (doc: ProseDocument, options: DetectorOptions) => Finding[];

export type Localized = Readonly<Record<string, string>>;

export type Level = "strict" | "normal" | "relaxed" | "off";

export type LevelTable = Readonly<Partial<Record<Exclude<Level, "off">, number>>>;

export type RuleDefinition = {
  readonly id: string;
  readonly layer: "L1" | "L2" | "L3" | "L4";
  readonly status: "experimental" | "stable" | "deprecated";
  readonly name: Localized;
  readonly why: Localized;
  readonly how_to_fix: Localized;
  readonly message: Localized;
  /** 4 語と数値の対応。2 つ以上。未定義の段は normal に落ちる。spec §18.1。
   *  言語別の閾値を持つ rule（max-sentence-length）は、読み込み時に言語で平坦化済み。 */
  readonly levels: LevelTable;
  /** ジャンル別の上書き。"business" は business/* 全部に効き、"business/email" が勝つ。spec §9。 */
  readonly by_genre: Readonly<Record<string, LevelTable>>;
  readonly how_to_find: string;
  readonly word_list: string | undefined;
  /** L4 のみ。LLM に渡す決まり。言語別。 */
  readonly what_to_check: Localized | undefined;
  readonly where: string | undefined;
  /** adapter に要る capability。"pos" / "lemma"。満たさなければ動かさない。spec §16。 */
  readonly requires: readonly string[];
  /** 動かす言語。未指定は全言語。「ですます調」のように言語に固有の rule が使う。 */
  readonly languages: readonly string[] | undefined;
  readonly use_for: readonly string[];
  readonly severity: Severity;
};
