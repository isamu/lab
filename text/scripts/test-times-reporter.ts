// A node:test reporter that prints each test file's time once the run ends, for yarn test:times to read from a CI log.
// CI passes it beside the spec reporter: --test-reporter=spec --test-reporter-destination=stdout
// --test-reporter=./scripts/test-times-reporter.ts --test-reporter-destination=stdout
import { addEndedTest, timeLines, type EndedTest } from "./test-times.ts";

export default async function* testTimesReporter(source: AsyncIterable<EndedTest>): AsyncGenerator<string> {
  const totals = new Map<string, number>();
  for await (const event of source) addEndedTest(totals, event, process.cwd());
  // A collapsed group, so the lines do not push the test output off the screen in the Actions log.
  yield `::group::test file times\n${timeLines(totals).join("\n")}\n::endgroup::\n`;
}
