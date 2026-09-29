// 言語アダプタと genre pack が依存してよい唯一の面。spec §6。
// ここに実装を置かない。型だけを置く。

export type Span = { readonly start: number; readonly end: number };

/**
 * tokens は adapter が prepare 済みのときだけ入る。無いことと「品詞が無い文」を混ぜない。
 * token の span は文の span と同じ座標系（segment に渡した文字列の先頭が 0）。
 * 2 つの基準を混ぜると、ずれたときに どちらが悪いか分からなくなる。
 */
export type Sentence = {
  readonly span: Span;
  readonly text: string;
  readonly tokens?: readonly Token[];
  /**
   * 行の折り返しで語の途中に入った改行（前後の行頭・行末の空白ごと）。span と同じ座標系。chaff が入れる。
   * tokens は全角どうしに挟まれた段落内の改行を除いた文字列から作るので、改行をまたぐ語の span は改行ごと覆い、surface より長い。
   */
  readonly wrapBreaks?: readonly Span[];
};

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
  /** 書いた形の読み（日本語はカタカナ）。表記の違う同じ語（下さい・ください）を同じと見るため。読めない adapter は持たない。 */
  readonly reading?: string;
  readonly features?: Readonly<Record<string, string>>;
};

export type Segmentation = {
  readonly sentences: readonly Sentence[];
  readonly words?: readonly Span[];
  readonly tokens?: readonly Token[];
};

export type LengthUnit = "char" | "word";

/** L2 の語彙表。detector は共通で、これだけが言語別。spec §11。 */
/**
 * `instead_of` は「同じことを言う別の書きかた」。文体の一貫性を見る rule が使う。
 * 2 つの書きかたのどちらが正しいかは決めず、**1 つの文書で混ざっていないか**だけを見る。
 */
export type LexiconEntry = {
  readonly pattern: string;
  readonly weight?: number | undefined;
  readonly instead_of?: string | undefined;
  /** 語が、かかる語のどちら側に立つか。語順が言語で違うものを語彙表が言う（範囲の「で」は前、"in" は後ろ）。 */
  readonly position?: "before" | "after" | undefined;
  /** pattern を adapter が語に分けたもの。品詞が読めるときだけ core が入れる。語彙表を書く側は書かない。 */
  readonly tokens?: readonly Token[] | undefined;
};

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
  /** 文書の構造を読む型。無い言語では `chaff tree` がそう言って止まる。 */
  readonly structure?: StructurePatterns;
};

// ───────── 文書の構造 ─────────

/**
 * 行頭の番号 1 つ。「第3条」「２」「(a)」を読むのは言語パッケージで、
 * 入れ子と番地を決めるのは core。core は番号の書き方を知らない。
 */
export type NumberedLine = {
  readonly kind: "chapter" | "article" | "item";
  /** 入れ子の深さ。条が 1、項が 2、号が 3 のように、言語パッケージが決める。条より外の編・章・節は 0 以下。 */
  readonly depth: number;
  /** 番地の部品。"3"、"4.2"、"a"。 */
  readonly number: string;
  /** true なら number だけで番地が決まる（条番号、4.2 のような通し番号）。false なら親の番地に続ける。 */
  readonly absolute: boolean;
  /** 書かれたままの番号。「第3条」「Section 4.2」。 */
  readonly label: string;
  /** 番号に続く見出し。「第3条（支払）」の「支払」。本文しか無ければ空。 */
  readonly heading: string;
  /**
   * 番号に付いた語（"section"、"article"）。英米の文書は Section と Article を別のものとして使うので、
   * 参照の attrs.numbering と比べて、この文書に無い種類の番号への参照（Section で組んだ法令の中の "Article 6"）を見分ける。
   */
  readonly numbering?: string | undefined;
  /** 番号の後ろの文字列全部。定義や参照はここから探す。 */
  readonly rest: string;
  /**
   * 並びの中の位置。第三条は 3、(ii) は 2、(b) は 2、4.2 は 2。番号の抜けを見る rule が比べる。
   * 枝番号（第3条の2）は並びの外なので付けない。読み方を知っているのは言語パッケージだけなので、core は計算しない。
   */
  readonly ordinal?: number | undefined;
  /** 一行で番号の範囲をまとめるとき（「第四十三条から第五十五条まで 削除」）の最後の位置。次の番号はここから数える。 */
  readonly ordinalTo?: number | undefined;
};

/** 番号を読むときに見える周り。「(i)」がローマ数字か英字かは、開いている番号で決まる。 */
export type NumberingContext = {
  readonly open: readonly NumberedLine[];
  /** Markdown の見出しの行か。本文の「1. 」は箇条書きで、見出しの「1. 」は章番号。 */
  readonly isHeading: boolean;
};

/** 行の中で見つけたもの。start / end は渡した文字列の中の位置。 */
export type Mention = { readonly start: number; readonly end: number; readonly attrs: Readonly<Record<string, string | number>> };

export type StructurePatterns = {
  readonly numbered: (line: string, context: NumberingContext) => NumberedLine | undefined;
  /** 定義。attrs.term に定義された語。 */
  readonly definitions: (text: string) => readonly Mention[];
  /** 参照。attrs.target に正規化した番地（"12.1"）、attrs.label に書かれたまま。 */
  readonly references: (text: string) => readonly Mention[];
  /** 義務・禁止・許可。attrs.marker に語、attrs.type に must / must-not / may。 */
  readonly obligations: (text: string) => readonly Mention[];
  /** 数量。attrs.value に数、attrs.unit に単位。 */
  readonly quantities: (text: string) => readonly Mention[];
  /**
   * 「In this section—」のように、この後の定義はいま開いている条の中でだけ通じると宣言する行なら true。
   * その条の定義に scope: "local" が付く。定義の並びが次の行から始まるので、定義の行だけを見ても分からない。
   */
  readonly opensDefinitionScope?: (text: string) => boolean;
  /**
   * 範囲が条より広いまとまり（「In this Part—」）なら、そのまとまりの深さ（NumberedLine.depth）。
   * そのまとまりの中の定義どうしだけを比べる。無ければ、opensDefinitionScope のとおり条の中。
   */
  readonly definitionScopeDepth?: (text: string) => number | undefined;
  /** 日付。attrs.value に "2024-04-01"・"2024-04"・"04-01"・"2024" のどれか。無い言語は日付を読まない。 */
  readonly dates?: (text: string) => readonly Mention[];
  /**
   * 「1.5 倍」「2.5 days」の 1.5 は通し番号ではない。番号と後ろの文字列を渡し、後ろが単位なら true。
   * 数字と点だけの通し番号は core が言語を問わず読むので、それを数量と見分けられるのは言語パッケージだけ。
   */
  readonly countedAfter?: (number: string, rest: string) => boolean;
  /** 数の書き方（「二十二」「3」）を数にする。相対の参照の「前二項」「前条第二項」が使う。 */
  readonly number?: (text: string) => number | undefined;
};

export type StructureKind = "doc" | "section" | "chapter" | "article" | "item" | "definition" | "reference" | "obligation" | "quantity" | "date";

/** 番地の付いた木の節点。すべて元の文書の位置（UTF-16）と行を持つ。 */
export type StructureNode = {
  readonly kind: StructureKind;
  /** 節・条・項の番地。"3.2"、見出しは "h2.1"。定義や参照のような葉は空。 */
  readonly address: string;
  readonly span: Span;
  readonly line: number;
  readonly attrs: Readonly<Record<string, string | number>>;
  readonly children: readonly StructureNode[];
  /** 番号付きのまとまりの、並びの中の位置（NumberedLine.ordinal）。S 式には出さない。 */
  readonly ordinal?: number;
  /** 番号付きのまとまりの深さ（NumberedLine.depth）。項と号のように、同じ親の下で別の並びを分ける。S 式には出さない。 */
  readonly level?: number;
  /** 範囲をまとめた行の最後の位置（NumberedLine.ordinalTo）。S 式には出さない。 */
  readonly ordinalTo?: number;
  /** 番号に付いた語（NumberedLine.numbering）。S 式には出さない。 */
  readonly numbering?: string;
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

export type Paragraph = { readonly span: Span; readonly sentences: readonly Sentence[] };

/** 箇条書き 1 つ。項目は項目の文字数で持つ。長さのばらつきしか見ないため。 */
export type BulletList = { readonly span: Span; readonly items: readonly number[] };

/**
 * detector に渡る唯一の入り口。core が I/O を済ませてから呼ぶ。
 * detector は純関数で、fs / network / clock に触れない。spec §6。
 */
/**
 * 文書の種類の知識（法令の番地の書き方など）。コードは種類を知らず、profiles/*.yaml に書いたものを読む。
 * 言語ごとに一つに絞ったもの。正規表現は文字列のまま持ち、使う側が組み立てる。
 */
export type DocumentProfile = {
  readonly id: string;
  /** 番地の書き方。漢字の連なりにも、数量にも数えない。 */
  readonly addresses: readonly string[];
  /** 番地と番地のあいだ、番地の後ろに付く語。 */
  readonly connectives: readonly string[];
  /** 番地の並びのすぐ後ろに来てよい文字（正規表現）。無ければどこで終わってもよい。 */
  readonly addressEnd?: string | undefined;
  /**
   * 条の前の行に置く見出しの形（正規表現。最初の括弧の中が見出しの言葉）。法令の「（解雇の予告）」。
   * すぐ次の行の条が見出しを持たなければ、その条の見出しになる。
   */
  readonly caption?: string | undefined;
  /** 前条・同項のように、書いた場所から番地が決まる参照の読み方。無ければ読まない。 */
  readonly relative?: RelativeVocabulary | undefined;
  /**
   * 番号を書かない単位（古い法令の第 2 項以降）。indent で始まる行を、inside の種類の単位の中の、depth の深さの次の単位にする。
   * inside の単位の行に、番号の後ろの本文が続くときだけ。
   */
  readonly unnumbered?: { readonly indent: string; readonly inside: string; readonly depth: number } | undefined;
};

/**
 * 相対の参照の語彙。語の意味（一つ前・一つ後・直前に引いたもの・今いるところ）はコードが知り、どの語がそれに当たるかは種類が決める。
 * units は単位の語から木の深さ（NumberedLine.depth）への対応。
 */
export type RelativeVocabulary = {
  readonly before: readonly string[];
  readonly after: readonly string[];
  readonly same: readonly string[];
  readonly current: readonly string[];
  /** 「前各項」の「各」。一つ前だけでなく、前の全部。 */
  readonly every: readonly string[];
  /** 「前二項」の「二」のような、いくつ分かの数の書き方（正規表現）。数は言語パッケージの number が読む。 */
  readonly count: string;
  readonly units: Readonly<Record<string, number>>;
  /** 「前条第二項」の「第」。後ろに続く番地の書き出し。 */
  readonly suffixPrefix: string;
  /**
   * 最初のものに番号を振らない深さ（法令の項）。あれば「第二条第一号」は 2.1.1、「第四条第一項」は第四条そのものでもある。
   */
  readonly implicitFirst: number | undefined;
  /** すぐ前に来てはいけない文字（正規表現）。「事前条件」の「前条」を参照にしない。 */
  readonly notAfter: string | undefined;
  /**
   * 読み替え（「『前条』とあるのは『…』」）の括弧。中の前条・同項は読み替える先の文の言葉で、ここからは決められないので読まない。
   * 閉じの直後に after、開きの直前に before のどれかがあるものだけ。中の番地を名指しした参照は、document の名前の文書を指す。
   */
  readonly substitution:
    | {
        readonly open: string;
        readonly close: string;
        readonly after: readonly string[];
        readonly before: readonly string[];
        readonly document: string | undefined;
      }
    | undefined;
  /** 条を書かずにこの単位で始まる番地（法令の「第一項」「第二号」）は、書いた場所を含むまとまりの中を指す。 */
  readonly inside: readonly string[];
  /**
   * 並びをつなぐもの（正規表現。及び・若しくは・から・、・枝番号の「の二」）。すぐ前の参照とのあいだがこれとつなぎの語（connectives）と
   * 閉じた括弧だけなら、条を書かない番地はその参照の続き。「第三十三条第七項若しくは第九項」の「第九項」は第三十三条の第九項。
   */
  readonly joiners: readonly string[];
  /** 括弧書き（「（…）」）の開きと閉じ。並びの途中に挟まっても、並びを切らない。 */
  readonly aside: { readonly open: string; readonly close: string } | undefined;
};

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
  /** 段落。文をいくつ載せているかと、長さのばらつきを見る rule が使う。 */
  readonly paragraphs: readonly Paragraph[];
  /** 箇条書き 1 つ。項目の数と長さのばらつきを見る rule が使う。 */
  readonly lists: readonly BulletList[];
  /** リンク（`[text](url)`、`<https://…>`、`[text][ref]`）の範囲。行き先が相対パスでもページ内でも、読み手が辿れる出典。 */
  readonly links: readonly Span[];
  /** アダプタが持つ語彙表と、チームが chaff.yaml に足した語彙表。detector は出所を知らない。 */
  readonly lexicons: Readonly<Record<string, Lexicon>>;
  /** この種類の文書に無いと困る見出し。チームが chaff.yaml で決める。 */
  readonly requiredSections: readonly string[];
  /** 番地の付いた木（§27）。adapter が structure を持たない言語では無い。 */
  readonly structure: StructureNode | undefined;
  /** 文書の種類（法令など）。選ばれなければ無い。 */
  readonly profile?: DocumentProfile | undefined;
  /** 本文でないもの（コード・HTML・強調の印）を同じ長さの空白で覆った source。位置は source と同じ。 */
  readonly prose?: string | undefined;
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
  /** word_list のほかに detector が名前で引く語彙表。どれかが無い言語では rule を動かさない。 */
  readonly extra_word_lists: readonly string[];
  /** L4 のみ。LLM に渡す決まり。言語別。 */
  readonly what_to_check: Localized | undefined;
  readonly where: string | undefined;
  /** adapter に要る capability。"pos" / "lemma"。満たさなければ動かさない。spec §16。 */
  readonly requires: readonly string[];
  /** 使えるなら用意してほしい capability（"pos"）。requires と違い、満たせなくても動かす（品詞が無ければ文字だけで見る）。 */
  readonly uses: readonly string[];
  /** 複合シグナル。ここに並べた rule のうち何本が出たかを見る。spec §20.2。 */
  readonly from: readonly string[];
  /** 動かす言語。未指定は全言語。「ですます調」のように言語に固有の rule が使う。 */
  readonly languages: readonly string[] | undefined;
  readonly use_for: readonly string[];
  readonly severity: Severity;
};
