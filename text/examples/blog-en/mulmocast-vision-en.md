---
title: "MulmoCast Vision - Create Slides with mcp"
emoji: "🤖"
type: "tech"
topics: [ AI, MCP, Tech, mulmocast, GraphAI]
published: true
publication_name: "singularity"
---

# What is MulmoCast Vision?

MulmoCast Vision is a tool for creating slides using mcp.

- Easy setup
- Instantly generate slides in PDF format
- Automatically create business slides such as proposals, reports, and analysis documents by simply giving instructions
- Over 80 templates useful for business scenes
- HTML-based, allowing for detailed adjustments afterwards
- Easily apply various designs by changing the HTML template

You can create documents like these in just a few minutes.

[Sample AI Company Analysis Slide (PDF)](https://github.com/isamu/slide_example/blob/master/pdf/AI_Companies_Corporate_Analysis_2025.pdf)

## Setup

Here is an example for Claude desktop. Add the following to your `claude_desktop_config.json`.  
You can use similar settings for other MCPs.

```json
// claude_desktop_config.json
"mulmocast-vision": {
  "command": "npx",
  "args": [
    "mulmocast-vision@latest"
  ],
  "transport": {
    "stdio": true
  }
}
```

That's all for the setup.  
If the path to `npx` is not set, specify the full path.  
If `npx` is not installed, please install it in advance.

## How to Use

Just give an instruction like "Compare corporate analysis of AI companies such as OpenAi Anthropic Replicate. About 20 slides." and the slides will be generated.  
That's all you need to do.

![](https://storage.googleapis.com/zenn-user-upload/b0489a29a3f7-20250913.png)

Example of generated PDF:

[Sample AI Company Analysis Slide (PDF)](https://github.com/isamu/slide_example/blob/master/pdf/AI_Companies_Corporate_Analysis_2025.pdf)

PDFs are created under `Documents/mulmocast-vision/{date}`.

Currently available features include creating slides for each page, updating specified slides, generating a PDF of all slides, and generating a PDF for specified slides.  
You can instruct these actions via prompts.

## For Developers

MulmoCast Vision is open source, so you can apply various designs by modifying the HTML.  
For adding styles, please refer to [Style.ja.md](https://github.com/receptron/mulmocast-vision/blob/main/Style.ja.md).


### Official Repository & Package

- [GitHub: receptron/mulmocast-vision](https://github.com/receptron/mulmocast-vision)
- [npm: mulmocast-vision](https://www.npmjs.com/package/mulmocast-vision)