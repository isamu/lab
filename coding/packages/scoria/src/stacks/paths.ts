const IGNORED_SEGMENTS = new Set(["node_modules", ".git", "dist", "lib", "build", "coverage", ".next", "out", ".turbo", ".output"]);
const TEST_SEGMENTS = new Set(["test", "tests", "__tests__", "__mocks__", "e2e", "spec"]);

const segmentsOf = (relativePath: string): readonly string[] => relativePath.split("/");

export const basenameOf = (relativePath: string): string => segmentsOf(relativePath).at(-1) ?? relativePath;

export const isIgnoredPath = (relativePath: string): boolean => segmentsOf(relativePath).some((segment) => IGNORED_SEGMENTS.has(segment));

export const isTestPath = (relativePath: string): boolean => {
  const name = basenameOf(relativePath);
  const inTestDirectory = segmentsOf(relativePath)
    .slice(0, -1)
    .some((segment) => TEST_SEGMENTS.has(segment));
  return inTestDirectory || /\.(test|spec)\./.test(name) || name.startsWith("test_");
};
