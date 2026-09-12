---
title: "MulmoCast Markdown Features - Styles, Layouts, and Mermaid Embedding"
emoji: "📊"
type: "tech"
topics: [AI, mulmocast, GraphAI, Markdown, Mermaid]
published: true
publication_name: "singularity"
---

# New MulmoCast Markdown Features

MulmoCast now includes five powerful Markdown features:

1. **100 Preset Styles** - Apply beautiful designs easily
2. **Layout Features** - Support for 2-column, 4-grid, header, and sidebar layouts
3. **Mermaid Embedding** - Display diagrams alongside text
4. **Image Embedding** - Place external images within layouts
5. **Background Images** - Set background images with opacity and size control

This article explains each feature in a beginner-friendly way.

## Required Version

These features require **MulmoCast 2.1.30** or later.
The background image feature requires **MulmoCast 2.1.31** or later.

### Installation

```bash
npm install -g mulmocast
```

### Update

If already installed, update to the latest version with:

```bash
npm update -g mulmocast
```

Check version:

```bash
npx mulmocast --version
```

## 1. Style Feature

### What are Styles?

Simply specify the `style` property to apply beautiful designs to markdown or textSlide. 100 preset styles are available, covering various categories like business, tech, and Japanese styles.

### Usage

```json
{
  "type": "markdown",
  "markdown": [
    "# Title",
    "Content"
  ],
  "style": "corporate-blue"
}
```

That's all it takes to create a business-oriented slide with a blue gradient background.

### Style Example

Example with `corporate-blue` style:

![corporate-blue style](/images/mulmocast-markdown-en/style_corporate.png)

### Main Style Categories

| Category | Representative Styles | Features |
|---------|-----------------|------|
| business | corporate-blue, executive-gray | Business-oriented, calm colors |
| tech | cyber-neon, terminal-dark | Tech feel, neon colors |
| japanese | washi-paper, sakura-pink, zen-garden | Japanese design |
| dark | charcoal-elegant, midnight-blue | Dark mode support |
| minimalist | clean-white, nordic-light | Simple, readable |
| creative | artistic-splash, neon-glow | Bold, impressive |

### Works with textSlide Too

You can apply styles to textSlide as well:

```json
{
  "type": "textSlide",
  "slide": {
    "title": "Title",
    "subtitle": "Subtitle",
    "bullets": ["Item 1", "Item 2", "Item 3"]
  },
  "style": "cyber-neon"
}
```

`cyber-neon` style example:

![cyber-neon style](/images/mulmocast-markdown-en/style_cyber.png)

### How to Check Available Styles

To see all available style names:

```bash
npx mulmocast tool info --category markdown-styles
```

## 2. Layout Feature

### What are Layouts?

Regular markdown is single-column, but with the layout feature, you can display content in 2 columns or a 4-grid.

### 2-Column Layout (row-2)

Place different content side by side:

```json
{
  "type": "markdown",
  "markdown": {
    "row-2": [
      ["# Left Column", "Left side content"],
      ["# Right Column", "Right side content"]
    ]
  },
  "style": "soft-gray"
}
```

![2-column layout](/images/mulmocast-markdown-en/layout_row2.png)

### 4-Grid Layout (2x2)

Display in 4 sections:

```json
{
  "type": "markdown",
  "markdown": {
    "2x2": [
      "# Top Left",
      "# Top Right",
      "# Bottom Left",
      "# Bottom Right"
    ]
  },
  "style": "soft-gray"
}
```

![4-grid layout](/images/mulmocast-markdown-en/layout_2x2.png)

### Layout with Header

Add a header at the top:

```json
{
  "type": "markdown",
  "markdown": {
    "header": "# Page Title",
    "row-2": [
      "Left content",
      "Right content"
    ]
  },
  "style": "soft-gray"
}
```

![Layout with header](/images/mulmocast-markdown-en/layout_header.png)

### Layout with Sidebar

Place a sidebar (menu, etc.) on the left:

```json
{
  "type": "markdown",
  "markdown": {
    "sidebar-left": ["## Menu", "- Item 1", "- Item 2"],
    "content": "Main content"
  },
  "style": "soft-gray"
}
```

![Layout with sidebar](/images/mulmocast-markdown-en/layout_sidebar.png)

## 3. Mermaid Embedding

### What is Mermaid?

Mermaid is a notation for drawing flowcharts and sequence diagrams with text. MulmoCast allows you to embed Mermaid notation directly in markdown.

### Usage

Simply write a Mermaid code block within markdown:

```json
{
  "type": "markdown",
  "markdown": {
    "row-2": [
      ["```mermaid", "graph TD", "    A[Start] --> B[Process]", "    B --> C[End]", "```"],
      ["# Description", "This flow shows..."]
    ]
  }
}
```

Combined with the layout feature, you can create slides with diagrams on the left and descriptions on the right.

![Mermaid embedding](/images/mulmocast-markdown-en/layout_mermaid.png)

### Supported Mermaid Notations

- Flowcharts (graph TD, graph LR)
- Sequence diagrams
- Class diagrams
- Gantt charts
- All other Mermaid-supported notations

## 4. Image Embedding

### Embedding External Images

Embed external images within layouts using Markdown notation:

```json
{
  "type": "markdown",
  "markdown": {
    "row-2": [
      ["# Image Sample", "", "![Image](https://example.com/image.png)"],
      ["# Description", "", "You can place images on the left and text on the right."]
    ]
  },
  "style": "soft-gray"
}
```

![Image embedding](/images/mulmocast-markdown-en/layout_image.png)

External URL images are loaded automatically.

## 5. Background Images (backgroundImage)

### What are Background Images?

The `backgroundImage` property allows you to set a background image for slides. You can adjust opacity and size to create visually impressive slides while maintaining text readability.

### Basic Usage

```json
{
  "type": "textSlide",
  "slide": {
    "title": "Title",
    "subtitle": "Subtitle"
  },
  "backgroundImage": {
    "source": {
      "kind": "url",
      "url": "https://example.com/background.png"
    },
    "opacity": 0.3,
    "size": "cover"
  }
}
```

![textSlide with background image](/images/mulmocast-markdown-en/bg_textslide.png)

### Works with Markdown Too

You can set background images on markdown type as well:

```json
{
  "type": "markdown",
  "markdown": [
    "# Slide Title",
    "",
    "- Point 1",
    "- Point 2"
  ],
  "backgroundImage": {
    "source": {
      "kind": "url",
      "url": "https://example.com/background.png"
    },
    "opacity": 0.3,
    "size": "cover"
  }
}
```

### Size Options

Specify how the background image should be sized:

| size | Description |
|------|------|
| `cover` | Maintain aspect ratio while covering the entire screen (default) |
| `fill` | Stretch to 100% ignoring aspect ratio |
| `contain` | Maintain aspect ratio while fitting the entire image |
| `auto` | Display at original image size |

Example with `size: cover`:

![size: cover example](/images/mulmocast-markdown-en/bg_size_cover.png)

### Opacity Option

Use `opacity` to set the background image transparency from 0 to 1. Values between 0.2 and 0.5 are recommended to ensure text readability.

```json
{
  "backgroundImage": {
    "source": { "kind": "url", "url": "https://..." },
    "opacity": 0.3
  }
}
```

### Source Specification Methods

Background image sources can be specified in three ways:

**URL:**
```json
{
  "source": {
    "kind": "url",
    "url": "https://example.com/image.png"
  }
}
```

**Local File:**
```json
{
  "source": {
    "kind": "path",
    "path": "./images/background.png"
  }
}
```

**Base64:**
```json
{
  "source": {
    "kind": "base64",
    "base64": "data:image/png;base64,..."
  }
}
```

### Combining with Layouts

You can combine layout features (row-2, etc.) with background images:

```json
{
  "type": "markdown",
  "markdown": {
    "row-2": [
      ["## Left Column", "- Item 1", "- Item 2"],
      ["## Right Column", "- Item A", "- Item B"]
    ]
  },
  "backgroundImage": {
    "source": {
      "kind": "url",
      "url": "https://example.com/background.png"
    },
    "opacity": 0.2,
    "size": "cover"
  }
}
```

![Layout with background image](/images/mulmocast-markdown-en/bg_layout_row2.png)

### Global and Individual Settings

Set a global background image in `imageParams` and override it for individual beats:

```json
{
  "$mulmocast": { "version": "1.1" },
  "imageParams": {
    "backgroundImage": {
      "source": { "kind": "url", "url": "https://example.com/default-bg.png" },
      "opacity": 0.3
    }
  },
  "beats": [
    {
      "text": "Using default background",
      "image": {
        "type": "markdown",
        "markdown": ["# Slide 1"]
      }
    },
    {
      "text": "This slide has a different background",
      "image": {
        "type": "markdown",
        "markdown": ["# Slide 2"],
        "backgroundImage": {
          "source": { "kind": "url", "url": "https://example.com/special-bg.png" },
          "opacity": 0.5
        }
      }
    },
    {
      "text": "This slide has no background",
      "image": {
        "type": "markdown",
        "markdown": ["# Slide 3"],
        "backgroundImage": null
      }
    }
  ]
}
```

**Priority:** Beat-level setting > imageParams global setting > style background

Use `backgroundImage: null` to disable the global setting and use only the style background.

## Practical Example: Combining All Five Features

A practical example combining styles, layouts, and Mermaid:

![Practical example](/images/mulmocast-markdown-en/combined_example.png)

```json
{
  "$mulmocast": { "version": "1.1" },
  "lang": "en",
  "title": "Project Overview",
  "beats": [
    {
      "speaker": "Presenter",
      "text": "Here's the project flow diagram and explanation.",
      "image": {
        "type": "markdown",
        "markdown": {
          "header": "# Project Flow",
          "row-2": [
            ["```mermaid", "graph TD", "    A[Planning] --> B[Design]", "    B --> C[Development]", "    C --> D[Testing]", "    D --> E[Release]", "```"],
            ["## Phase Description", "", "1. **Planning**: Requirements definition", "2. **Design**: Architecture design", "3. **Development**: Implementation", "4. **Testing**: Quality assurance", "5. **Release**: Production deployment"]
          ]
        },
        "style": "corporate-blue"
      }
    }
  ]
}
```

## Summary

MulmoCast's new Markdown features enable more expressive presentations.

| Feature | Purpose |
|-----|------|
| Styles | Easily apply designs |
| Layouts | Multi-column, header, sidebar |
| Mermaid | Display diagrams alongside text |
| Image Embedding | Place external images in layouts |
| Background Images | Set slide backgrounds with opacity and size control |

Give it a try!

## References

- [MulmoCast GitHub](https://github.com/receptron/mulmocast-cli)
- [MulmoCast Documentation](https://github.com/receptron/mulmocast-cli/blob/main/docs/image.md)
