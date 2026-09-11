---
title: "MulmoCast Claude Plugin - Create Video Presentations from Claude Code"
emoji: "🔌"
type: "tech"
topics: [mulmocast, ClaudeCode, AI, presentation, plugin]
published: true
publication_name: "singularity"
---

# What is MulmoCast Claude Plugin?

**MulmoCast Claude Plugin** is a plugin that lets you create video presentations directly from [Claude Code](https://claude.com/claude-code).

Just provide a URL, topic, or document, and it automatically handles everything from research to narration writing, slide design, and video generation.

https://github.com/receptron/mulmocast-claude-plugin

## Features

- **Create videos from URLs**: Fetch and analyze articles, then generate professional presentation videos
- **Create videos from topics**: Research via web search and generate videos with data-rich slides
- **Create videos from documents**: Read PDF or text files and compile them into videos
- **Multilingual support**: Supports Japanese and English

## Installation

```bash
# Step 1: Add the marketplace
claude plugin marketplace add receptron/mulmocast-claude-plugin

# Step 2: Install the plugin
claude plugin install mulmocast@mulmocast-plugins
```

### Updating

To update the plugin to the latest version:

```bash
# Update the marketplace catalog
/plugin marketplace update mulmocast-plugins

# Update the plugin
/plugin update mulmocast@mulmocast-plugins
```

The commit hash is pinned at install time, so `marketplace update` alone won't update the plugin itself. You need to run `/plugin update` as well.

## Prerequisites

- **Node.js** 22+
- **ffmpeg** — Used for combining video and audio
- **OPENAI_API_KEY** — Text-to-speech (default TTS provider)

Optionally, `GEMINI_API_KEY` (image generation / TTS), `REPLICATE_API_TOKEN` (video generation), and `ELEVENLABS_API_KEY` (TTS) are also available.

## Usage

Run the `/mulmocast:story` command in Claude Code.

```
/mulmocast:story https://example.com/article make a movie in English
```

```
/mulmocast:story AI trends in 2026, 5 slides, English
```

```
/mulmocast:story path/to/quarterly-report.pdf
```

You can also specify a cinematic style:

```
/mulmocast:story Introduce MulmoCast with a Star Wars opening crawl
```

```
/mulmocast:story https://example.com/article Terminator HUD style, English
```

```
/mulmocast:story Latest trends in quantum computing, Evangelion alert screen style
```

## 5-Phase Structured Process

The plugin creates videos through an interactive 5-phase process. User approval is obtained at each phase before proceeding.

### Phase 1: Research

Collects and analyzes content based on the input source.

- **URL**: Fetch and parse pages with WebFetch or Playwright
- **Topic**: Search 3–5 sources with WebSearch
- **File**: Read documents and identify themes

Research results are presented as a **Topic Brief** to confirm the theme, tone, and key insights.

### Phase 2: Structure

Determines the number of beats based on content volume and presents a **Beat Outline**.

| Source Length | Beat Count | Structure |
|---|---|---|
| Short (1 article) | 3–8 | HOOK → SECTIONS → CLOSE |
| Medium (long article) | 8–15 | HOOK → (SECTION × N) → CLOSE |
| Long (report) | 15–25 | HOOK → (CHAPTER × N) → CLOSE |

### Phase 3: Narration

Creates spoken narration for each beat.

- 2–4 sentences per beat (30–60 words)
- Natural spoken rhythm
- Includes specific numbers and names

### Phase 4: Visual Design

Designs slides using 11 layout types and 12 content block types.

**Layouts**: title, columns, comparison, grid, bigQuote, stats, timeline, split, matrix, table, funnel

**Content blocks**: text, bullets, code, callout, metric, divider, image, imageRef, chart, mermaid, table, section

Slide density is automatically adjusted based on beat count.

| Beat Count | Density | Approach |
|---|---|---|
| 3–5 | Maximum | Pack like a cheat sheet |
| 6–10 | Standard | 3–5 points/slide + images |
| 11+ | Relaxed | 1 point/slide, generous whitespace |

### Phase 5: Assembly

Assembles narrations and visuals into MulmoScript JSON and generates the video.

Output: `output/video/<basename>.mp4`

## Slide Themes

Automatically selects from 6 preset themes to match the content.

| Content Type | Theme |
|---|---|
| Business news, financial data | corporate (default) |
| Pop culture, entertainment | pop |
| Education, tutorials | warm |
| Academic, research | minimal |
| Startups, design | creative |
| Tech, developer-focused | dark |

## Cinematic Animations

In addition to slide-based presentations, you can create cinematic effects using **html_tailwind animations**. CSS animations and JavaScript programmatically generate movie and anime-style HUD overlays and scene backgrounds.

14 cinematic themes are available:

| # | Theme | Features |
|---|---|---|
| 1 | Space Opera (Star Wars) | 3D opening crawl, starfield generation |
| 2 | Cyberpunk Terminal (Ghost in the Shell) | Neon green terminal, CRT scanlines |
| 3 | Mecha Anime (Evangelion) | Red alert screen, typewriter, status counters |
| 4 | Film Noir | Monochrome, venetian blinds, smoke effects |
| 5 | Retro Synthwave / 80s | Neon grid, sunset gradients |
| 6 | Matrix / Digital Rain | Digital rain, green code |
| 7 | Documentary / Nature | Ken Burns effect, subtitle overlay |
| 8 | Anime Opening | Speed lines, dynamic text |
| 9 | Horror / Thriller | Glitch, red flash, noise |
| 10 | Terminator T-800 Vision | City silhouette generation, targeting brackets |
| 11 | Dragon Ball Scouter | Power level counter, warrior silhouette, lens frame |
| 12 | Blade Runner | 3-layer cityscape, neon signs, rain |
| 13 | Total Recall | Mars gradient, dome structures, brain scan |
| 14 | Iron Man JARVIS HUD | Hexagonal grid, 3D hologram panels |

### Sample Video

A showcase video featuring all 14 themes:

@[youtube](oLxfhzx5nnQ)

Just instruct with phrases like "Star Wars style" or "Terminator HUD" and the matching cinematic animation is automatically generated.

## Links

- [Documentation](https://mulmocast.com/docs/claude-plugin)
- [GitHub - mulmocast-claude-plugin](https://github.com/receptron/mulmocast-claude-plugin)
- [GitHub - mulmocast-cli](https://github.com/receptron/mulmocast-cli)
- [Claude Code](https://claude.com/claude-code)
