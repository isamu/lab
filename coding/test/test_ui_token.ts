import { test } from "node:test";
import assert from "node:assert/strict";
import { uiToken } from "../packages/scoria/src/probes/ui-token.ts";
import { contextWith, sourceFile } from "./helpers.ts";
import type { Metric } from "../packages/scoria/src/plugin.ts";

const valueOf = (metrics: readonly Metric[], id: string): number | undefined => metrics.find((metric) => metric.id === id)?.value;

const component = (path: string, ...lines: readonly string[]): ReturnType<typeof sourceFile> => sourceFile(path, lines);

const measure = async (files: readonly ReturnType<typeof sourceFile>[]) => uiToken.run(contextWith(files));

/** A repository with no components has no UI to be consistent about (spec §18.1). */
test("a project with no components skips the probe rather than scoring it", async () => {
  const status = await uiToken.detect(contextWith([sourceFile("src/index.ts", ["export const a = 1;"])]));
  assert.equal(status.kind, "skipped");
});

test("a project with components runs", async () => {
  const status = await uiToken.detect(contextWith([component("src/A.vue", "<template><div/></template>")]));
  assert.equal(status.kind, "ok");
});

/**
 * Cardinality, not count. Counting occurrences measures how much UI there is; counting distinct
 * values separates growth from disorder.
 */
test("the same colour used ten times is one decision", async () => {
  const files = [component("src/A.vue", ...Array.from({ length: 10 }, () => '<div style="color: #ff0000" />'))];
  const result = await measure(files);
  assert.equal(valueOf(result.metrics, "ui-token.color_cardinality"), 1);
});

test("colours are counted across notations and files", async () => {
  const files = [
    component("src/A.vue", '<div style="color: #ff0000; background: rgb(0, 0, 255)" />'),
    component("src/B.tsx", "const s = { color: '#00ff00' };"),
  ];
  assert.equal(valueOf((await measure(files)).metrics, "ui-token.color_cardinality"), 3);
});

/** `#ff0000` and `#FF0000` are one decision written twice, not two. */
test("colour case does not make a second decision", async () => {
  const files = [component("src/A.vue", '<div style="color: #FF0000" /><div style="color: #ff0000" />')];
  assert.equal(valueOf((await measure(files)).metrics, "ui-token.color_cardinality"), 1);
});

test("spacing counts distinct values, whatever the unit", async () => {
  const files = [component("src/A.vue", "<style>.a { margin: 8px; padding: 8px } .b { gap: 13px; top: 1.5rem }</style>")];
  assert.equal(valueOf((await measure(files)).metrics, "ui-token.spacing_cardinality"), 3);
});

/**
 * A colour lives in a template, a class string or a `<style>` block — none of which survive being
 * treated as JavaScript, which is why the raw lines are read rather than the code view.
 */
test("a colour in a template is found, not only one in script", async () => {
  const files = [
    component("src/A.vue", "<template>", '  <div class="x" style="color: #123456" />', "</template>", "<script setup lang='ts'>", "const a = 1;", "</script>"),
  ];
  assert.equal(valueOf((await measure(files)).metrics, "ui-token.color_cardinality"), 1);
});

test("inline styles are counted in both dialects", async () => {
  const files = [component("src/A.vue", '<div :style="{ top: 0 }" />'), component("src/B.tsx", "<div style={{ top: 0 }} />")];
  assert.ok((valueOf((await measure(files)).metrics, "ui-token.inline_style_per_kloc") ?? 0) > 0);
});

test("style blocks are reported as a share of the components that carry them", async () => {
  const files = [component("src/A.vue", "<style scoped>.a { color: red }</style>"), component("src/B.vue", "<template><div/></template>")];
  const result = await measure(files);
  assert.equal(valueOf(result.metrics, "ui-token.style_block_ratio"), 0.5);
  assert.deepEqual(
    result.findings.map((finding) => finding.file),
    ["src/A.vue"],
  );
});

test("a test component is not part of the product's UI", async () => {
  const files = [sourceFile("test/A.vue", ['<div style="color: #ff0000" />'], "test")];
  const result = await measure(files);
  assert.equal(valueOf(result.metrics, "ui-token.ui_file_count"), 0);
});
