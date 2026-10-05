# lab

[![scoria · coding](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/isamu/lab/badges/scoria-coding.json)](https://github.com/isamu/lab/actions/workflows/quality.yml)
[![scoria · text](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/isamu/lab/badges/scoria-text.json)](https://github.com/isamu/lab/actions/workflows/quality.yml)

Two tools for checking work by machine, each in its own workspace: one for code and one for prose.

**Try chaff in your browser:** [playground (English)](https://isamu.github.io/lab/en/playground/) ·
[playground (日本語)](https://isamu.github.io/lab/ja/playground/)

## What is here

- [`text/`](text/): **chaff**, a linter and unit tests for prose, for contracts, blog posts and technical documents,
  in Japanese and English. Published on npm as [`chaffjs`](https://www.npmjs.com/package/chaffjs); run
  `npx chaffjs article.md`. The guide and the reference of every rule are at
  [isamu.github.io/lab](https://isamu.github.io/lab/) ([English](https://isamu.github.io/lab/en/),
  [日本語](https://isamu.github.io/lab/ja/)). [How to use it](text/packages/chaff/README.md) ·
  [how to work on it](text/README.md).
- [`coding/`](coding/): **scoria**, a code quality assay harness for TypeScript and JavaScript.
  [How to use it](coding/packages/scoria/README.md) · [the workspace](coding/README.md).
- [`plans/`](plans/): plans written before larger changes to chaff and scoria.

## The badges

Both workspaces are measured by [scoria](coding/packages/scoria/README.md) on every push to `main`.

The number is this repository's own score and nothing else. scoria's scales are uncalibrated and its
rubrics change between versions, so holding it against another project's badge means nothing. The
colour is the part that carries information: **green** when no dimension fell since the recorded
baseline, **orange** when one did, **blue** when there is no baseline yet.
