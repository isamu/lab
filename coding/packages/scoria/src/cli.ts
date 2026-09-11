import { assay } from "./run.ts";
import { renderExplain, renderReport } from "./render.ts";

interface Options {
  readonly target: string;
  readonly json: boolean;
  readonly explain: string | undefined;
}

const parse = (argv: readonly string[]): Options => {
  const explainAt = argv.indexOf("--explain");
  const positional = argv.filter((a) => !a.startsWith("--"));
  const target = explainAt < 0 ? positional[0] : positional.filter((a) => a !== argv[explainAt + 1])[0];
  return {
    target: target ?? ".",
    json: argv.includes("--json"),
    explain: explainAt < 0 ? undefined : argv[explainAt + 1],
  };
};

export const main = async (argv: readonly string[]): Promise<void> => {
  const options = parse(argv);
  const { report } = await assay(options.target);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(options.explain === undefined ? renderReport(report) : renderExplain(report, options.explain));
};
