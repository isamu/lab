// Grades an output with chaff and records the result as a score on a Langfuse trace.
// Install: npm i @langfuse/client chaffjs. The client reads LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY and LANGFUSE_BASE_URL.
import { LangfuseClient } from "@langfuse/client";
import { grade, toScorer } from "chaffjs/grade";

const langfuse = new LangfuseClient();

/** @param {{ traceId: string, output: string, reference?: string }} args */
export const scoreTrace = async ({ traceId, output, reference }) => {
  const scored = toScorer(await grade(output, { reference }));
  langfuse.score.create({ traceId, name: "chaff", value: scored.score, dataType: "BOOLEAN", comment: scored.reason });
  await langfuse.flush();
  return scored;
};
