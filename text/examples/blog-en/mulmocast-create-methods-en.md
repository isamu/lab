---
title: "How to Create MulmoScript - CLI, AI, Conversion Tools, and GUI Apps"
emoji: "🎬"
type: "tech"
topics: ["mulmocast", "ai", "presentation", "typescript"]
published: true
publication_name: "singularity"
---


## Introduction

MulmoCast is a tool that generates videos and web content combining slides and narration. At its core is **MulmoScript**, a JSON-format script file.

This article introduces five methods for creating MulmoScript.

## Installing CLI Tools

The CLI tools used in this article can be installed globally via npm.

```bash
# mulmo command (MulmoScript generation, video/audio output)
npm install -g mulmocast

# mulmo-slide command (converting existing files)
npm install -g @mulmocast/slide
```

## What is MulmoScript?

MulmoScript is a JSON file with the following structure:

```json
{
  "$mulmocast": { "version": "1.1", "credit": "closing" },
  "lang": "en",
  "title": "Presentation Title",
  "beats": [
    {
      "text": "Content to speak on this slide",
      "image": {
        "type": "markdown",
        "markdown": ["# Title", "- Point 1", "- Point 2"]
      }
    }
  ]
}
```

## 1. Creating with CLI (mulmo tool scripting)

The most convenient method. Specify a theme interactively or auto-generate from a URL.

### Interactive Mode

```bash
mulmo tool scripting -i -t business
```

Build slide structure through interactive conversation with an LLM.

### Generate from URL

```bash
mulmo tool scripting -t coding -u https://example.com/article
```

Analyzes web page content and automatically generates MulmoScript.

### Template Selection

Available templates: `business`, `coding`, `documentary`, `vision`, `shorts`, etc.

```bash
# View available templates
mulmo tool info templates
```

## 2. Creating with Your Own AI (LLM)

This method uses LLMs like ChatGPT or Claude to generate MulmoScript yourself. There are two approaches.

### Method A: Generate Complete MulmoScript at Once

Pass prompt templates or schemas to an LLM and have it generate complete MulmoScript in one go.

#### Step 1: Get Prompt or Schema

```bash
# Get prompt template (with template specification)
mulmo tool prompt -t business

# Or get JSON Schema
mulmo tool schema
```

#### Step 2: Request from LLM

Submit the obtained prompt (or schema) along with your desired content to ChatGPT or Claude chat.

**Example: Request to ChatGPT**
```
Following the prompt template below, please create a MulmoScript in JSON format
about "Introduction to GraphAI".

[Paste mulmo tool prompt output here]
```

The LLM will generate complete MulmoScript (including `$mulmocast`, `lang`, `beats`, etc.).

> **Note**: AI output may be incomplete. Check for JSON syntax errors or missing required fields and correct as needed.

---

### Method B: Generate Only Beats and Auto-complete

Create only the beats array and auto-complete the remaining metadata with `mulmo tool complete`. This is a lighter approach that allows for fine-tuned adjustments.

#### Beats Structure

Beats is an array with the following structure. Different image types can be used depending on the purpose. Copy the samples below for use in LLM requests or programmatic generation.

**Basic Form (Markdown Slide):**
```json
{
  "text": "Narration (content to be spoken)",
  "image": {
    "type": "markdown",
    "markdown": ["# Slide Title", "", "- Point 1", "- Point 2"]
  }
}
```

**Image URL Specification:**
```json
{
  "text": "Let me explain this image.",
  "image": {
    "type": "image",
    "source": {
      "kind": "url",
      "url": "https://example.com/image.png"
    }
  }
}
```

**Video URL Specification:**
```json
{
  "text": "Please watch this video.",
  "image": {
    "type": "movie",
    "source": {
      "kind": "url",
      "url": "https://example.com/video.mp4"
    }
  }
}
```

**Text Slide (Simple Text Display):**
```json
{
  "text": "I'll share an important point.",
  "image": {
    "type": "textSlide",
    "text": "Text to display prominently here"
  }
}
```

**Mermaid Diagram:**
```json
{
  "text": "I'll explain the process flow with a flowchart.",
  "image": {
    "type": "mermaid",
    "mermaid": "graph TD\\n    A[Start] --> B[Process]\\n    B --> C[End]"
  }
}
```

**AI Image Generation (imagePrompt):**
```json
{
  "text": "Here's an AI-generated image.",
  "imagePrompt": "Shibuya Scramble Crossing at night, urban landscape with glowing neon lights"
}
```

**AI Video Generation (moviePrompt):**
```json
{
  "text": "This is an AI-generated video.",
  "moviePrompt": "Camera walking through a beautiful Japanese garden",
  "duration": 5
}
```

**Video from Image (imagePrompt + moviePrompt):**
```json
{
  "text": "Generating a video from an image.",
  "imagePrompt": "Tokyo night view, high-rise buildings",
  "moviePrompt": "Camera slowly panning",
  "duration": 5
}
```

**Main Beat Fields:**
- `text`: Narration (spoken content)
- `image`: Directly specify image/slide
  - `image.type`: `"markdown"` / `"image"` / `"movie"` / `"textSlide"` / `"mermaid"`, etc.
  - `image.source`: For images/videos, specify `kind` (`"url"` or `"path"`) and `url`/`path`
- `imagePrompt`: Prompt for AI image generation
- `moviePrompt`: Prompt for AI video generation
- `duration`: Video length (seconds)

#### Creation Method 1: Generate with LLM

Pass the samples above to ChatGPT or Claude to generate content.

**Example: Request to ChatGPT**
```
Please create 5 slides about "Introduction to GraphAI" in the following JSON format.

{
  "beats": [
    {
      "text": "Narration content",
      "image": {
        "type": "markdown",
        "markdown": ["# Title", "- Point 1"]
      }
    }
  ]
}
```

**LLM Output Example:**
```json
{
  "beats": [
    {
      "text": "GraphAI is a framework that makes it easy to build complex workflows.",
      "image": {
        "type": "markdown",
        "markdown": ["# What is GraphAI", "", "A workflow building framework"]
      }
    },
    {
      "text": "Let's look at the main features.",
      "image": {
        "type": "markdown",
        "markdown": ["## Features", "- Declarative workflow definition", "- Automatic parallel processing", "- LLM integration"]
      }
    }
  ]
}
```

#### Creation Method 2: Generate Programmatically

You can also generate beats with your own programs. Useful for data transformation or batch processing.

```typescript
const beats = data.map(item => ({
  text: item.description,
  image: {
    type: "markdown",
    markdown: [`# ${item.title}`, "", ...item.points]
  }
}));

fs.writeFileSync("beats.json", JSON.stringify({ beats }, null, 2));
```

#### Auto-complete with complete

Save the generated beats to a file and convert to complete MulmoScript with the `complete` command.

```bash
mulmo tool complete beats.json -o mulmo_script.json
```

This automatically adds required metadata like `$mulmocast`, `speechParams`, and `imageParams`.

---

### Method A vs Method B

| Item | Method A (All at Once) | Method B (beats + complete) |
|------|------------------------|----------------------------|
| Convenience | ★★★ | ★★☆ |
| Fine Control | ★★☆ | ★★★ |
| LLM Token Usage | High | Low |
| Best For | Quick creation | Gradual refinement |

## 3. Converting with mulmo-slide

Convert existing documents and presentations to MulmoScript.

**Why Convert?**

Converting existing slides and documents to MulmoScript enables:

- **Video Creation** - Convert slides to narrated videos
- **Audio Narration** - Auto-generate AI voice explanations of slide content
- **Web Content** - Publish as interactive web presentations

This isn't just format conversion—it's transformation of static slides into "talking presentations."

### Markdown

```bash
# Plain Markdown (no image generation)
mulmo-slide markdown document.md -l en

# Marp format (with image generation)
mulmo-slide marp slides.md -l en

# Generate narration with LLM
mulmo-slide markdown document.md -g -l en
```

**Common Options:**
- `-l, --lang` - Language specification (ja, en, fr, de)
- `-g, --generate-text` - Auto-generate narration with LLM

**markdown Command Specific Options:**
- `-s, --separator` - Slide separator method (horizontal-rule, heading, heading-1, heading-2, heading-3, blank-lines, comment, page-break)
- `--mermaid` - Convert Mermaid code blocks to mermaid beats
- `--directive` - Remove Marp-style directives
- `--style` - Specify slide style (e.g., corporate-blue, finance-green)

**marp Command Specific Options:**
- `--theme` - Custom theme CSS file path
- `--allow-local-files` - Allow access to local files

### PowerPoint

```bash
mulmo-slide pptx presentation.pptx -l en
```

Uses speaker notes as narration if available.

### PDF

```bash
mulmo-slide pdf document.pdf -l en
```

Imports each page as an image.

### Keynote (macOS only)

```bash
mulmo-slide keynote presentation.key
```

## 4. Writing by Hand

Write JSON directly. Maximum flexibility but more effort.

```json
{
  "$mulmocast": {
    "version": "1.1",
    "credit": "closing"
  },
  "lang": "en",
  "title": "Handwritten Presentation",
  "description": "Created by writing JSON directly",
  "beats": [
    {
      "text": "Hello. Welcome to today's presentation.",
      "image": {
        "type": "markdown",
        "markdown": [
          "# Welcome",
          "",
          "Interactive presentations",
          "created with MulmoCast"
        ]
      }
    },
    {
      "text": "Let's get started.",
      "image": {
        "type": "markdown",
        "markdown": [
          "## Table of Contents",
          "1. Introduction",
          "2. Main Topic",
          "3. Summary"
        ]
      }
    }
  ]
}
```

## 5. Creating with GUI App

Download the desktop app from [https://mulmocast.com/](https://mulmocast.com/).

MulmoCast is an AI-native presentation platform. While PowerPoint and Keynote were designed in the pre-AI era, MulmoCast is built from the ground up for collaboration with generative AI.

**Key Features:**
- Visual editing of MulmoScript
- Real-time preview
- Multiple output formats including video, slideshow, PDF, and podcast
- Integration with AI models like ChatGPT and Claude

## Comparison of Creation Methods

| Method | Difficulty | Flexibility | Best For |
|--------|------------|-------------|----------|
| CLI scripting | ★☆☆ | ★★☆ | Quick creation |
| LLM + complete | ★★☆ | ★★★ | Fine-grained control |
| mulmo-slide conversion | ★☆☆ | ★★☆ | Leveraging existing materials |
| Handwritten | ★★★ | ★★★ | Full customization |
| GUI app | ★☆☆ | ★★★ | Visual editing |

## Generating Output from MulmoScript

Various outputs can be generated from created MulmoScript:

```bash
# Generate video
mulmo movie mulmo_script.json

# Generate PDF slides
mulmo pdf mulmo_script.json

# Generate web bundle (for MulmoViewer)
mulmo bundle mulmo_script.json

# Generate images
mulmo images mulmo_script.json

# Generate audio
mulmo audio mulmo_script.json
```

## Summary


MulmoScript can be created in multiple ways:

1. **CLI** - Most convenient, interactive or URL-based
2. **LLM** - Highly flexible, can integrate into custom workflows
3. **Conversion Tools** - Leverage existing Markdown/PPTX/PDF
4. **Handwritten** - Complete control, also good for learning
5. **GUI App** - Visual editing ([mulmocast.com](https://mulmocast.com/))

Choose the best method for your use case.

## Reference Links

- [MulmoCast GitHub](https://github.com/receptron/mulmocast)
- [MulmoCast-Slides GitHub](https://github.com/receptron/MulmoCast-Slides)
- [npm: mulmocast](https://www.npmjs.com/package/mulmocast)
- [npm: @mulmocast/slide](https://www.npmjs.com/package/@mulmocast/slide)
