// Seeded mistakes of a work email for `yarn bench`: the greeting or the closing dropped, a subject grown long, and an
// attachment mentioned with none listed. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

type Sentences = Readonly<Record<string, string>>;

const GREETING: Sentences = { ja: "いつもお世話になっております。", en: "Dear " };
const CLOSING: Sentences = { ja: "どうぞよろしくお願いいたします。", en: "Best regards," };
const SUBJECT: Sentences = { ja: "件名", en: "Subject" };
const LONG_SUBJECT: Sentences = {
  ja: "来週の火曜日に予定している会議室の予約サービスの導入に向けた打ち合わせの日程と、当日の進め方についてのご相談",
  en: "Following up on our conversation last week about the meeting room booking service, the visit and the trial panels",
};
const ATTACHED: Sentences = { ja: "建物の平面図の例を添付しました。", en: "I have attached an example floor plan." };

/** The greeting taken out of its line: a Japanese greeting sentence, or an English "Dear …," line emptied. */
const dropGreeting =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => line.trimStart().startsWith(GREETING[language] ?? ""),
      (line) => (language === "ja" ? line.replace(GREETING.ja ?? "", "") : ""),
    );

const dropClosing =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => line.trim() === CLOSING[language],
      () => "",
    );

const lengthenSubject =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => line.startsWith(`${SUBJECT[language] ?? ""}:`),
      () => `${SUBJECT[language] ?? ""}: ${LONG_SUBJECT[language] ?? ""}`,
    );

/** A sentence that mentions an attachment, at the end of the first paragraph of prose in the sample's language. */
const mentionAttachment =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${ATTACHED[language] ?? ""}`,
    );

const both = (id: string, rule: string, plant: (language: string) => Mutation["plant"], reportsOn?: "document"): Mutation[] =>
  ["ja", "en"].map((language) => ({
    id: `${id}-${language}`,
    rule,
    languages: [language],
    ...(reportsOn === undefined ? {} : { reportsOn }),
    plant: plant(language),
  }));

export const MUTATIONS: readonly Mutation[] = [
  ...both("email-greeting-dropped", "email-greeting-closing", dropGreeting, "document"),
  ...both("email-closing-dropped", "email-greeting-closing", dropClosing, "document"),
  ...both("email-subject-long", "email-subject-length", lengthenSubject),
  ...both("email-attachment-unlisted", "attachment-not-attached", mentionAttachment),
];
