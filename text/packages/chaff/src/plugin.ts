// 言語アダプタと genre pack が依存してよい唯一の面。spec §6。
// ここに実装を置かない。型だけを置く。

export type Span = { readonly start: number; readonly end: number };

export type Sentence = { readonly span: Span; readonly text: string };

/** 品詞は Universal Dependencies の UPOS に統一する。アダプタ独自の体系を露出させない。 */
export type Token = { readonly span: Span; readonly surface: string; readonly pos: string; readonly lemma?: string };

export type Segmentation = {
  readonly sentences: readonly Sentence[];
  readonly words?: readonly Span[];
  readonly tokens?: readonly Token[];
};

export type LengthUnit = "char" | "word";

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

export type LanguageAdapter = {
  readonly kind: "language";
  /** BCP 47 の primary subtag。"ja" / "en"。 */
  readonly id: string;
  readonly apiVersion: 1;
  readonly capabilities: AdapterCapabilities;
  /** この言語である確からしさ。0..1。 */
  readonly detect: (source: string) => number;
  readonly segment: (text: string) => Segmentation;
};
