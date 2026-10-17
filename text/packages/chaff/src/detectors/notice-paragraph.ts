import { entryIn } from "./lexicon-match.ts";
import type { LexiconEntry, Paragraph, Sentence } from "../plugin.ts";

/** 一文だけの断りは本文の書き損じのことがある。段落ごと別の調子で揃えてあるときだけ、意図した別の声と読む。 */
const MIN_SENTENCES = 2;

/**
 * 断り書きの段落（「…無償で提供します。…一切の責任を負いません。…ご了承ください。」）の文。
 * 免責や変更の予告は、である調の文書でもですます調で書く決まり文句で、本文と文末の調子を比べるものではない。
 * 断りの語（cues）を含み、調子を持つ文が MIN_SENTENCES 以上あって、それがみな同じ、文書の多いほう（majority）ではない調子の段落だけ。
 * 調子が混ざった段落と、文書と同じ調子の段落は、本文と同じに数える。
 */
export const noticeSentences = <R>(
  paragraphs: readonly Paragraph[],
  cues: readonly LexiconEntry[],
  registerOf: (sentence: Sentence) => R | undefined,
  majority: R | undefined,
): Set<Sentence> =>
  new Set(
    paragraphs.flatMap((paragraph) => {
      const registers = new Set(
        paragraph.sentences.flatMap((sentence) => {
          const register = registerOf(sentence);
          return register === undefined ? [] : [register];
        }),
      );
      const counted = paragraph.sentences.filter((sentence) => registerOf(sentence) !== undefined).length;
      const [only] = registers;
      const ownVoice = counted >= MIN_SENTENCES && registers.size === 1 && only !== majority;
      const notice = ownVoice && paragraph.sentences.some((sentence) => cues.some((cue) => entryIn(sentence, cue)));
      return notice ? paragraph.sentences : [];
    }),
  );
