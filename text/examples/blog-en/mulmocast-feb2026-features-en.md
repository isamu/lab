---
title: "MulmoCast New Features - Markdown to Video, AI Queries & Summaries"
emoji: "🎬"
type: "tech"
topics: [AI, mulmocast, GraphAI, Markdown, LLM]
published: true
publication_name: "singularity"
---

# MulmoCast Early February Feature Roundup

In one week (February 4-10, 2026), we shipped major feature additions to MulmoCast-Slides (`@mulmocast/slide`) and mulmocast-preprocessor. This article covers each feature with the "why" and the "how."

## Overview

The new features fall into three themes.

| Theme | What it enables |
|-------|----------------|
| **ExtendedScript** | A richer format that adds metadata, variants, and output profiles on top of MulmoScript |
| **Markdown to video pipeline** | Automatically generate narrated videos from plain Markdown documents |
| **AI-powered content interaction** | Summarize, query, and interactively explore your video scripts |

## Installation / Update

```bash
# MulmoCast-Slides
npm install -g @mulmocast/slide

# mulmocast-preprocessor
npm install -g mulmocast-preprocessor
```

Check versions:

```bash
mulmo-slide --version    # 0.5.0 or later
npx mulmocast-preprocessor --version  # 0.4.1 or later
```

---

## 1. ExtendedScript — An Enhanced MulmoScript Format

### Why we needed it

MulmoScript is a simple "slide image + narration text" format. That's enough for video generation, but when working with long papers or documents, several limitations emerged:

- **No metadata**: Keywords, section info, and context weren't preserved in the script
- **No variant switching**: Couldn't manage "detailed" and "summary" versions of the same slide in one file
- **Hard for AI to leverage**: Structured information needed for Q&A and summarization was missing

So we introduced **ExtendedScript** — an extension format that's fully compatible with MulmoScript, adding metadata only when you need it.

### ExtendedScript structure

```json
{
  "$mulmocast": { "version": "1.1" },
  "title": "Document Title",
  "scriptMeta": {
    "audience": "Engineers",
    "keywords": ["API Design", "REST", "GraphQL"],
    "references": [
      { "title": "RFC 7231", "url": "https://..." }
    ]
  },
  "outputProfiles": {
    "detailed": {
      "description": "Full version with all beats",
      "includeTags": ["core", "detail", "example"]
    },
    "short": {
      "description": "Summary version with core beats only",
      "includeTags": ["core"]
    }
  },
  "beats": [
    {
      "text": "Narration text",
      "image": { "type": "markdown", "markdown": ["# Slide"] },
      "meta": {
        "section": "introduction",
        "tags": ["core"],
        "keywords": ["overview"],
        "context": "This slide explains the overall flow"
      },
      "variants": {
        "short": { "text": "Shortened narration" }
      }
    }
  ]
}
```

Compared to standard MulmoScript, `scriptMeta`, `outputProfiles`, and per-beat `meta`/`variants` fields are added.

### How to create an ExtendedScript

#### Option 1: `/extend` skill (Claude Code)

Add AI-generated metadata to an existing MulmoScript.

```bash
# Install the skill (first time only)
mulmo-slide extend init

# Run in Claude Code:
/extend scripts/my-slides/my-slides.json
```

#### Option 2: `scaffold` command (no LLM needed)

Generate a skeleton ExtendedScript without using an LLM.

```bash
mulmo-slide extend scaffold scripts/my-slides/my-slides.json
```

This creates `extended_script.json` with empty metadata. You can fill it in manually later or let `/extend` handle it with AI.

#### Option 3: `validate` for schema verification

Check that an ExtendedScript has a valid format.

```bash
mulmo-slide extend validate scripts/my-slides/extended_script.json
```

---

## 2. `/narrate` — Narrated Video from PDF / PPTX

### Why we needed it

To turn a PDF paper or slide deck into a video, you previously had to:

1. Convert PDF to MulmoScript
2. Manually write narration for each slide
3. Generate the video

Step 2 was the bottleneck. A 30-page paper means writing 30 narrations. **If AI can auto-generate narration**, the whole process takes just a few minutes.

### Usage

```bash
# Install the skill (first time only)
mulmo-slide extend init

# Run in Claude Code:
/narrate your-paper.pdf
```

That's all it takes. The `/narrate` skill automatically:

1. Converts the PDF to slide images
2. Extracts text from each page
3. Generates AI narration
4. Adds metadata (keywords, sections, context)
5. Validates the output

Generated files:

```
scripts/your-paper/
  your-paper.json        # Base MulmoScript
  extracted_texts.json    # Raw text extracted from each page
  extended_script.json   # ExtendedScript (narration + metadata)
  images/
    your-paper-0.png     # Page images
    your-paper-1.png
    ...
```

### Also available from the CLI

You can run the full pipeline without Claude Code.

```bash
# Full pipeline (uses OpenAI GPT)
mulmo-slide narrate your-paper.pdf -l ja

# Scaffold only (no LLM, complete later with /extend)
mulmo-slide narrate your-paper.pdf --scaffold-only
```

### Supported formats

```bash
/narrate your-paper.pdf       # PDF (papers, documents)
/narrate your-slides.pptx     # PowerPoint
/narrate your-slides.md       # Marp markdown
/narrate your-slides.key      # Keynote (macOS only)
```

---

## 3. `/md-to-mulmo` — Auto-Generate Video from Markdown Documents

### Why we needed it

`/narrate` assumes you already have slides. But sometimes you want to create a video from a **plain Markdown document** — a tech blog, a specification, or a design document.

Markdown has no slide boundaries. Heading hierarchy and paragraph lengths vary widely. Automatically deciding "which content goes on which slide" requires an LLM.

### Pipeline overview

```
Markdown → parse-md → LLM designs plan → assemble-extended → ExtendedScript
```

1. **parse-md**: Parses Markdown structure (headings, paragraphs, code blocks, lists, etc.) into JSON
2. **LLM planning**: Based on the parsed structure, the LLM designs a plan for which sections go on which slides
3. **assemble-extended**: Automatically assembles an ExtendedScript from the plan

### Usage (Quick Start)

```bash
# Install the skill (first time only)
mulmo-slide extend init

# Run in Claude Code:
/md-to-mulmo your-document.md
```

The skill runs the entire pipeline automatically, producing `scripts/your-document/extended_script.json`.

### Running each step manually

#### Step 1: Parse the Markdown

```bash
mulmo-slide parse-md your-document.md
```

Generated files:

```
scripts/your-document/
  parsed_structure.json           # Parsed structure
  extended-script.schema.json     # ExtendedScript JSON Schema
  presentation-plan.schema.json   # Presentation plan JSON Schema
```

`parsed_structure.json` contains the Markdown's section structure with each element (headings, paragraphs, code blocks, lists, tables, etc.) recorded hierarchically.

#### Step 2: Create a presentation plan

```bash
# Run in Claude Code:
/md-to-mulmo your-document.md
```

The LLM reads `parsed_structure.json` and `presentation-plan.schema.json`, then designs which sections go on which slides. The result is saved as `presentation_plan.json`.

#### Step 3: Assemble the ExtendedScript

```bash
mulmo-slide assemble-extended scripts/your-document/presentation_plan.json
```

Generates an ExtendedScript from the plan. Two output profiles — `detailed` (all beats) and `short` (core only) — are automatically included.

### Generating the video

To create a video from the ExtendedScript, first convert it to a standard MulmoScript using the preprocessor.

```bash
# ExtendedScript → MulmoScript
npx mulmocast-preprocessor scripts/your-document/extended_script.json \
  -o scripts/your-document/your-document.json

# MulmoScript → Video
npx mulmo movie scripts/your-document/your-document.json
```

Output: `output/your-document_ja.mp4`

### Switching output profiles

```bash
# Generate the summary version
npx mulmocast-preprocessor scripts/your-document/extended_script.json \
  -o scripts/your-document/your-document.json -p short
```

---

## 4. mulmocast-preprocessor — AI-Powered Content Interaction

### Why we needed it

Creating an ExtendedScript shouldn't be the end of the story. The script contains all the content from the original document. We wanted to leverage it for:

- **Summarization** — quickly grasp key points of a long paper
- **Q&A** — drill into specific topics
- **Interactive exploration** — ask questions in a chat-like flow

To meet these needs, we added AI commands to the preprocessor.

### summarize — Generate a summary

```bash
# Generate a summary in Japanese
npx mulmocast-preprocessor summarize scripts/your-paper/extended_script.json -l ja

# Summary in English
npx mulmocast-preprocessor summarize scripts/your-paper/extended_script.json -l en
```

The LLM reads the entire script and outputs a human-readable summary.

### query — Ask a question

```bash
# Ask a single question
npx mulmocast-preprocessor query scripts/your-paper/extended_script.json "What is HBF?"
```

The script content is passed as context to the LLM, which answers the question.

### Interactive mode — Chat with your content

```bash
npx mulmocast-preprocessor query scripts/your-paper/extended_script.json -i
```

The `-i` flag enters interactive mode.

```
> What is the main topic of this paper?
The paper discusses challenges in LLM inference hardware...

> What are the four research directions?
1. High Bandwidth Flash (HBF)
2. Processing-Near-Memory (PNM)
3. 3D Compute-Logic Stacking
4. Low-latency Interconnect

> /refs
References:
1. RFC 7231 - https://...
2. ...

> /fetch
Fetching reference URLs...

> exit
```

Interactive mode preserves conversation history, so you can ask follow-up questions that build on previous answers.

#### Interactive mode special commands

| Command | Description |
|---------|-------------|
| `/refs` | Show the list of references |
| `/fetch` | Fetch reference URLs and add their content to the LLM context |
| `/clear` | Clear conversation history |
| `/history` | Show conversation history |
| `exit` | Exit interactive mode |

### scriptMeta — Document-level metadata

The `scriptMeta` field in ExtendedScript stores document-wide metadata.

```json
{
  "scriptMeta": {
    "audience": "Backend engineers",
    "prerequisites": ["Basic REST API knowledge"],
    "goals": ["Understand the benefits of GraphQL"],
    "keywords": ["GraphQL", "API Design"],
    "references": [
      { "title": "GraphQL Official Docs", "url": "https://graphql.org/" }
    ]
  }
}
```

The `summarize` and `query` commands automatically include this metadata in LLM prompts, resulting in more accurate answers.

---

## 5. Filtering and Profiles — Filter by Section and Tags

### Why we needed it

When you create a video from a long document, beats can grow to 30, 50, or more. You need a way to extract "just this part" depending on the use case.

### Switch by profile

```bash
# List available profiles
npx mulmocast-preprocessor process scripts/your-doc/extended_script.json --list-profiles

# Detailed profile (all beats)
npx mulmocast-preprocessor process scripts/your-doc/extended_script.json -p detailed

# Short profile (summary)
npx mulmocast-preprocessor process scripts/your-doc/extended_script.json -p short
```

### Filter by section

```bash
# Only the introduction section
npx mulmocast-preprocessor process scripts/your-doc/extended_script.json --section introduction
```

### Filter by tags

```bash
# Only beats tagged "example"
npx mulmocast-preprocessor process scripts/your-doc/extended_script.json --tags example
```

---

## 6. Auto Layout Detection — Slide Layouts Based on Markdown Content

### Why we needed it

When converting Markdown to slides, every slide being a single column gets monotonous. Slides with code blocks should show code on the left and explanation on the right. Slides with many list items should use a 2-column layout. **Specifying this manually is tedious**, so we made it automatic based on the content.

### Detected layouts

| Content | Layout |
|---------|--------|
| Code block + text | `row-2` (2-column: code left, explanation right) |
| Mermaid diagram + text | `row-2` (2-column: diagram left, explanation right) |
| 4+ list items | `2x2` (4-quadrant grid) |
| H1 heading + content | `header` + `content` / `row-2` / `2x2` |
| Simple text | `default` (single column) |

### Using it with the Markdown converter

```bash
# Layout auto-detection is always active
mulmo-slide markdown your-slides.md

# Add Mermaid support
mulmo-slide markdown your-slides.md --mermaid
```

Layout detection is implemented as a plugin system, so you can also manually specify a particular layout if needed.

---

## 7. Browser-Safe Exports

### Why we needed it

MulmoCast-Slides is a Node.js tool, but there are cases where you want to run Markdown to MulmoScript conversion inside a web application. By providing a **browser-safe bundle** that excludes Node.js-specific dependencies (filesystem, child processes, etc.), we made it usable in browser environments.

### Usage

```typescript
// Browser-safe import
import { transformMarkdownToMulmoScript } from "@mulmocast/slide/browser";

const mulmoScript = transformMarkdownToMulmoScript(markdownText, {
  mermaid: true,
  separator: "heading",
});
```

Importing from `@mulmocast/slide/browser` ensures Node.js-specific dependencies are not bundled, so it works seamlessly with bundlers like Vite or webpack.

---

## Workflow Quick Reference

Here are the workflows for common use cases.

### Markdown Document to Video

```bash
# In Claude Code:
/md-to-mulmo your-document.md

# ExtendedScript → MulmoScript
npx mulmocast-preprocessor scripts/your-document/extended_script.json \
  -o scripts/your-document/your-document.json

# Generate video
npx mulmo movie scripts/your-document/your-document.json
```

### PDF / PPTX to Video

```bash
# In Claude Code:
/narrate your-paper.pdf

# ExtendedScript → MulmoScript
npx mulmocast-preprocessor scripts/your-paper/extended_script.json \
  -o scripts/your-paper/your-paper.json

# Generate video
npx mulmo movie scripts/your-paper/your-paper.json
```

### Explore your video scripts

```bash
# Summarize
npx mulmocast-preprocessor summarize scripts/your-doc/extended_script.json -l en

# Interactive Q&A
npx mulmocast-preprocessor query scripts/your-doc/extended_script.json -i

# Generate video from a specific section
npx mulmocast-preprocessor scripts/your-doc/extended_script.json \
  -o scripts/your-doc/your-doc.json --section introduction
npx mulmo movie scripts/your-doc/your-doc.json
```

## Summary

Here's a recap of the features added in the week of February 4-10.

| Feature | Tool | What it does |
|---------|------|-------------|
| ExtendedScript | mulmo-slide | Rich scripts with metadata and variants |
| `/narrate` | mulmo-slide | AI-narrated scripts from PDF/PPTX/MD |
| `/md-to-mulmo` | mulmo-slide | AI auto-designs presentation structure from Markdown |
| Auto layout detection | mulmo-slide | Automatically selects row-2 / 2x2 / header based on content |
| Browser-safe exports | mulmo-slide | `@mulmocast/slide/browser` for browser environments |
| summarize | preprocessor | LLM-powered script summarization |
| query | preprocessor | LLM-powered Q&A with interactive mode |
| Filtering | preprocessor | Filter by section, tags, or profile |

All tools are published on npm.

```bash
npm install -g @mulmocast/slide
npm install -g mulmocast-preprocessor
```

## Links

- [MulmoCast-Slides GitHub](https://github.com/receptron/MulmoCast-Slides)
- [mulmocast-preprocessor (mulmocast-plus monorepo)](https://github.com/receptron/mulmocast-plus)
- [MulmoCast CLI](https://github.com/receptron/mulmocast-cli)
