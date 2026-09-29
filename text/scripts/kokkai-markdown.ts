// A meeting of the Diet as the 国会会議録検索システム API serves it (kokkai.ndl.go.jp/api/meeting?issueID=…&
// recordPacking=json) as plain Markdown: the meeting's name as a heading, then every speech in order, each line of a
// speech a paragraph, as the printed minutes set them. The "会議録情報" record (the roster of members present and the
// agenda, laid out in columns of full-width spaces) and the rule lines between items are dropped. Pure.

type Speech = { readonly speaker: string; readonly speech: string };

type Meeting = {
  readonly session: number;
  readonly nameOfHouse: string;
  readonly nameOfMeeting: string;
  readonly issue: string;
  readonly date: string;
  readonly speechRecord: readonly Speech[];
};

// API が発言の一つとして返す、出席者一覧・議事日程の欄。発言ではない。
const ROSTER_SPEAKER = "会議録情報";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isSpeech = (value: unknown): value is Speech => isRecord(value) && typeof value["speaker"] === "string" && typeof value["speech"] === "string";

const isMeeting = (value: unknown): value is Meeting =>
  isRecord(value) &&
  typeof value["session"] === "number" &&
  ["nameOfHouse", "nameOfMeeting", "issue", "date"].every((field) => typeof value[field] === "string") &&
  Array.isArray(value["speechRecord"]) &&
  value["speechRecord"].every(isSpeech);

const meetingsOf = (data: unknown): Meeting[] => (isRecord(data) && Array.isArray(data["meetingRecord"]) ? data["meetingRecord"].filter(isMeeting) : []);

/** A line of box-drawing characters only (─────), the minutes' divider between items. */
const RULE_LINE = new RegExp(String.raw`^[─-╿]+$`, "u");

const isRuleLine = (line: string): boolean => RULE_LINE.test(line);

/** Each line of a speech, without the full-width indent that opens a paragraph in the printed minutes (trim() removes U+3000). */
const speechParagraphs = (speech: string): string[] =>
  speech
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !isRuleLine(line));

const title = (meeting: Meeting): string =>
  `# 第${String(meeting.session)}回国会 ${meeting.nameOfHouse} ${meeting.nameOfMeeting} ${meeting.issue}（${meeting.date}）`;

const meetingMarkdown = (meeting: Meeting): string[] => [
  title(meeting),
  ...meeting.speechRecord.filter((speech) => speech.speaker !== ROSTER_SPEAKER).flatMap((speech) => speechParagraphs(speech.speech)),
];

export const kokkaiToMarkdown = (json: string): string => {
  const meetings = meetingsOf(JSON.parse(json));
  // 番号違い・API の仕様変更で会議が一つも無い応答を、指摘ゼロの文書として黙って置かない。
  if (meetings.length === 0) throw new Error("no meetingRecord: not a 国会会議録検索システム meeting response");
  return `${meetings.flatMap(meetingMarkdown).join("\n\n")}\n`;
};
