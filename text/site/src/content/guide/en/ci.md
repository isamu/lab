# CI

Run chaff in CI and its findings appear on the changed lines of a PR.
A finding in a log is seen only by whoever goes to read it. A finding on the line is in front of the person who wrote it.
This page covers sending findings to GitHub code scanning, and shelving today's findings when you add chaff to existing documents.

## Writing the findings as SARIF

With `--sarif <path>`, chaff also saves its results to a file, in version 2.1.0 of that format.
SARIF is the standard format for handing check results to CI.

```
$ npx chaffjs . --sarif report/chaff.sarif

  Wrote SARIF: report/chaff.sarif (1 finding)
…
```

The usual screen follows it.
How to read the screen is in [Getting started](./getting-started).

## Showing findings on the lines of a GitHub PR

Upload the SARIF to GitHub code scanning with `github/codeql-action/upload-sarif@v4`.
An example workflow:

```yaml
name: chaff

on: pull_request

permissions:
  contents: read
  security-events: write

jobs:
  prose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npx -y chaffjs . --sarif report/chaff.sarif
      - name: Upload SARIF to Code Scanning
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: report/chaff.sarif
          category: chaff-prose
```

Uploading to code scanning needs `security-events: write`, so it is in `permissions`.
`category` keeps these results apart from other checks'.

## Opening a finding shows how to fix it

chaff sends why to fix it and how, along with each finding.
The reason and the "→ how to fix" from the screen come with the finding on the PR.
For a sentence that is too long, the finding carries:

| Field | Content |
| --- | --- |
| Title | Sentence too long |
| Message | This sentence runs 43 words (limit 25) |
| Why fix it | In a long sentence the reader loses the subject before reaching the verb. |
| How to fix it | Split it in two at the conjunction. |

Pointing at a problem without saying how to fix it leaves the writer stuck.

## Adding chaff to existing documents

A repository with many documents gets a flood of findings on the first run.
Fixing them all before starting is not possible, so `baseline` shelves today's findings.

```
$ npx chaffjs baseline docs/
  Checked 1 file.

  Recorded 1 finding in .chaff-baseline.json.
  They will not be reported again; only new ones will.

  Commit .chaff-baseline.json.
```

From then on, shelved findings are not reported, and only new ones are.
Commit `.chaff-baseline.json` and the whole team starts from the same point.

## Why the shelf survives edits

A shelved finding is recognised by its content, not its line number,
so adding paragraphs before or after it does not bring it back.

To see the shelved ones too, add `--show-baseline`.
There is an example in [Commands](./commands).
