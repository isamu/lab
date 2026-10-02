// A promptfoo assertion that grades the output with chaff (type: javascript, value: file://chaff-assertion.cjs).
// promptfoo loads this file with require(); chaffjs/grade is an ES module, so it is imported inside the function.
// The test's vars may carry `reference`, `sources` and `citations`, as in a `chaff grade` item.

/** @param {string} output @param {{ vars?: Record<string, unknown>, config?: Record<string, unknown> }} context */
module.exports = async (output, context) => {
  const { grade, toScorer } = await import("chaffjs/grade");
  const vars = context.vars ?? {};
  const result = await grade(output, {
    reference: typeof vars.reference === "string" ? vars.reference : undefined,
    sources: vars.sources,
    citations: vars.citations,
    config: typeof context.config?.chaffConfig === "string" ? context.config.chaffConfig : undefined,
  });
  const scored = toScorer(result);
  // promptfoo's GradingResult: pass, score and reason. The score is 1 or 0; chaff has no full marks to map a penalty onto.
  return { pass: scored.pass, score: scored.score, reason: scored.reason };
};
