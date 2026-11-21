<!-- chaff-sample
rule: abstract-length
genre: academic/paper
file: paper.md
-->

# Abstract too long, or missing (`abstract-length`)

**Where it helps:** research papers, conference submissions, theses. Any paper whose reader decides from the abstract whether to read on.

## Original

```markdown chaff-before
# Standing desks and afternoon focus in an open-plan office

## Introduction

Many offices now offer standing desks, but few studies measure what they do for focus after lunch.

## Method

We asked 36 staff at one accounting firm to work standing for half of each afternoon for four weeks.
They rated their focus every hour on a scale from 1 to 7.

## Results

Mean focus ratings between 14:00 and 16:00 rose from 4.1 to 4.6.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre academic/paper paper.md

paper.md   academic/paper · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    ## Introduction

  ·  Abstract too long, or missing

     This paper has sections but no abstract
     Readers decide from the abstract alone whether to read the paper. An abstract that runs long takes as much time as the paper to judge, and tends to exceed the venue's word limit. A paper with sections but no abstract makes the reader read on before learning what the study is. The abstract is the text under an "Abstract" heading, the paragraph after a line that says only "Abstract", or the text after "Abstract:" at the head of a paragraph. The Japanese abstract (要旨) of a bilingual paper is measured in characters.

     → Cut the abstract to a sentence or two each for the aim, the method, the results and the conclusion. If there is none, add an "Abstract" section before the body.

     Relax this rule:  npx chaffjs relax abstract-length


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Standing desks and afternoon focus in an open-plan office

## Abstract

We asked 36 staff at one accounting firm to work standing for half of each afternoon for four weeks.
Their mean focus rating between 14:00 and 16:00 rose from 4.1 to 4.6 on a scale from 1 to 7.

## Introduction

Many offices now offer standing desks, but few studies measure what they do for focus after lunch.

## Method

The staff rated their focus every hour on the same scale.

## Results

The rise was largest in the hour after lunch.
```

## How it was fixed

The paper has an introduction, a method and results, but no abstract.
A reviewer or a colleague scanning a list of papers reads the abstract and nothing else; here they have to open the paper to learn what was studied and what was found.

The fix adds an "Abstract" section before the body, with the method and the result in two sentences.
The details that the abstract now carries are not repeated word for word below it.

The same rule also reports an abstract that has grown too long: at the default level, more than 400 words.

## Settings

The levels are word limits for the abstract: `strict` allows 250 words, the default 400, `relaxed` 500.
If your venue allows a longer abstract, choose the level that matches its limit:

```yaml chaff-settings
rules:
  abstract-length: relaxed
```

The rule runs only for the academic paper genre (`academic/paper`).

```text chaff-explain
$ npx chaffjs explain abstract-length --genre academic/paper

  Abstract too long, or missing   (abstract-length)

  Readers decide from the abstract alone whether to read the paper. An abstract that runs long takes as much time as the paper to judge, and tends to exceed the venue's word limit. A paper with sections but no abstract makes the reader read on before learning what the study is. The abstract is the text under an "Abstract" heading, the paragraph after a line that says only "Abstract", or the text after "Abstract:" at the head of a paragraph. The Japanese abstract (要旨) of a bilingual paper is measured in characters.

  How to fix: Cut the abstract to a sentence or two each for the aim, the method, the results and the conclusion. If there is none, add an "Abstract" section before the body.

  Rewrite depth: structure (sections, headings and paragraphs are reorganised). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 250 words in the abstract
  → normal   up to 400 words in the abstract
    relaxed  up to 500 words in the abstract
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax abstract-length --why "reason"
```

[All samples](README.md)
