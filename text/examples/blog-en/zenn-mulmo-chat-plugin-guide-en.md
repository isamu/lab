---
title: "Build Game Plugins for MulmoChat - Using Akinator as an Example"
emoji: "🔮"
type: "tech"
topics: ["vue", "react", "typescript", "llm", "ai"]
published: true
publication_name: "singularity"
---

# Introduction

Chatting with LLMs (Large Language Models) is fun, but don't you sometimes feel limited by text-only interactions?

"I want the AI to give me quizzes," "I want to play games together," "I want to display graphical results"

**[MulmoChat](https://github.com/receptron/MulmoChat)** and **[GUIChatPluginTemplate](https://github.com/receptron/GUIChatPluginTemplate)** make these wishes come true.

## The Appeal of Plugin Development

With **GUIChatPluginTemplate**, you can easily create GUI plugins for MulmoChat's voice chat.

```
Copy the template
    ↓
Auto-generate with Claude Code (includes CLAUDE.md)
    ↓
Debug with text chat (yarn dev)
    ↓
yarn build → Distribute via GitHub/npm
    ↓
Voice chat ready in MulmoChat!
```

**Features:**

| Development Phase | Environment | Input Method |
|-------------------|-------------|--------------|
| Development/Debug | Template (yarn dev) | Text |
| Production | MulmoChat | Text + **Voice** |

- **Includes CLAUDE.md**: Just tell Claude Code "create a XX plugin" to auto-generate the plugin
- **Built-in Debug Environment**: No API key needed with Mock Mode, one-click testing with Quick Samples
- **Ready to Distribute**: Just `yarn build` → push to GitHub/npm
- **Voice Support**: Develop efficiently with text, enjoy natural voice experience in production

This article explains how MulmoChat works and walks through creating an [Akinator game plugin](https://github.com/isamu/AkinatorGame) to demonstrate plugin development.

# What is MulmoChat?

**[MulmoChat](https://github.com/receptron/MulmoChat)** is a chat application that combines LLM responses with GUI components.

Features:
- **GUI Plugins**: Display rich UI when LLM calls tools
- **Voice Input Support**: Chat with AI using voice, not just text
- **Multimodal**: Combined experience of text, voice, and GUI

In typical chat apps, LLM responses are text-only. But in MulmoChat, LLMs can display rich UIs by calling "tools."

```
Typical Chat:
User: Give me a quiz
AI: Here's a question. What is the capital of Japan?
    A) Osaka  B) Tokyo  C) Kyoto  D) Nagoya

MulmoChat:
User: Give me a quiz
AI: [Quiz UI component is displayed]
    ┌─────────────────────────────┐
    │ Question: Capital of Japan? │
    │ [A) Osaka] [B) Tokyo]       │
    │ [C) Kyoto] [D) Nagoya]      │
    └─────────────────────────────┘
```

## MulmoChat Architecture

MulmoChat works as follows:

```
User Message
       ↓
   LLM (OpenAI, etc.)
       ↓
  Response includes tool_calls?
       ↓
┌──────┴──────┐
│Yes          │No
↓             ↓
Execute       Display text
plugin's      response as-is
execute()
↓
Return ToolResult
↓
Display GUI in
View component
```

The key point is that the LLM decides "when to use a tool." If a user says "give me a quiz," the LLM calls the quiz tool.

# What is GUIChatPluginTemplate?

**[GUIChatPluginTemplate](https://github.com/receptron/GUIChatPluginTemplate)** is a template for easily creating MulmoChat plugins.

:::message alert
**Important**: MulmoChat is built with Vue. Plugins for MulmoChat must be implemented in **Vue**.

The template also includes a React version, and you can test the React version with `yarn dev:react`, but React plugins won't work in MulmoChat.
:::

Features:
- **Integrated Chat Demo**: Test your plugin in an actual chat interface
- **TypeScript**: Type-safe development
- **Includes CLAUDE.md**: Auto-generate plugins with Claude Code

## Documentation

The template comes with detailed documentation:

| Document | Content | Target |
|----------|---------|--------|
| [Getting Started](https://github.com/receptron/GUIChatPluginTemplate/blob/main/docs/getting-started.md) | First plugin creation tutorial | Beginners |
| [Plugin Development Guide](https://github.com/receptron/GUIChatPluginTemplate/blob/main/docs/plugin-development-guide.md) | Detailed development reference | All developers |
| [AI Development Guide](https://github.com/receptron/GUIChatPluginTemplate/blob/main/docs/ai-development-guide.md) | Optimized guide for Claude Code | AI + Developers |
| [Advanced Features](https://github.com/receptron/GUIChatPluginTemplate/blob/main/docs/advanced-features.md) | Advanced features like sendTextMessage, viewState | Intermediate+ |
| [npm Publishing Guide](https://github.com/receptron/GUIChatPluginTemplate/blob/main/docs/npm-publishing-guide.md) | npm publishing and MulmoChat integration | All developers |

Japanese versions available: [Getting Started (Japanese)](https://github.com/receptron/GUIChatPluginTemplate/blob/main/docs/getting-started.ja.md), [Advanced Features (Japanese)](https://github.com/receptron/GUIChatPluginTemplate/blob/main/docs/advanced-features.ja.md)

## Plugin Structure

```
src/
├── core/                 # Framework-agnostic (shared by Vue/React)
│   ├── definition.ts     # Tool definition (description for LLM)
│   ├── types.ts          # Type definitions
│   ├── plugin.ts         # execute function (main logic)
│   └── samples.ts        # Test data
├── vue/
│   ├── View.vue          # Main display component
│   └── Preview.vue       # Sidebar thumbnail
└── react/
    ├── View.tsx
    └── Preview.tsx
```

# Let's Build an Akinator Plugin

## What is Akinator?

**Akinator** is a popular guessing game that originated in France in 2007.

The AI guesses the character or famous person you're thinking of by asking a series of yes/no questions. A character called the "Genie" asks questions and amazingly guesses the answer correctly, which made it famous worldwide.

```
You: (Think of Mickey Mouse)

Akinator: "Is your character from an American production?"
You: "Yes"

Akinator: "Is it an animated character?"
You: "Yes"

Akinator: "Does it have round ears?"
You: "Yes"

Akinator: "Is it... Mickey Mouse?"
You: "Correct!"
```

Let's implement this game as a MulmoChat plugin. It will provide a natural interface where you can play just by saying "yes" or "no" with your voice.

## Creating a Plugin with Claude Code

GUIChatPluginTemplate includes **CLAUDE.md**, so you can auto-generate plugins just by instructing Claude Code.

### Step 1: Copy the Template

```bash
# Copy the template
git clone https://github.com/receptron/GUIChatPluginTemplate AkinatorGame
cd AkinatorGame
yarn install
```

### Step 2: Instruct Claude Code

Launch Claude Code and give instructions like this:

```
Create an Akinator game plugin.

- AI asks yes/no questions to the user
- AI guesses the answer based on user's responses
- Categories: character, person, animal, object, place
- Answer buttons: Yes, No, Probably Yes, Probably No, Don't Know
- Maximum 20 questions to guess
- Show score
```

Claude Code reads **CLAUDE.md**, understands the plugin structure, and auto-generates the necessary files.

### Step 3: Debug

Set the OpenAI API Key as an environment variable and start the development server.

```bash
# Create .env file
echo "VITE_OPENAI_API_KEY=sk-your-api-key" > .env

# Start development server
yarn dev  # http://localhost:5173
```

Type "Let's play Akinator" in the chat to debug while seeing actual LLM responses. You can also use Quick Samples buttons to test individual game phases.

### Step 4: Build and Distribute

```bash
# Run type check and lint
yarn typecheck
yarn lint

# Build
yarn build

# Push to GitHub
git add -f dist/
git commit -m "Build Akinator plugin"
git push
```

Once type check and lint pass, you can build and distribute. Your MulmoChat plugin is complete!

:::message
**Completed project here**: [AkinatorGame Repository](https://github.com/isamu/AkinatorGame)

Below, we explain the key points of the code generated by Claude Code.
:::

## Generated Code Explanation

Claude Code generates code like the following. However, the generated code may vary significantly depending on the prompt content and how you give instructions. Here we explain each file's role as an example. Use this for customization and troubleshooting.

### Game Flow

1. User chooses a category (character, person, animal, etc.)
2. User thinks of something
3. AI asks yes/no questions
4. User answers with buttons
5. AI guesses the answer

### Type Definitions ([types.ts](https://github.com/isamu/AkinatorGame/blob/main/src/core/types.ts))

Data structures needed for the game.

```typescript
// Answer types
export type AnswerType = "yes" | "no" | "probably_yes" | "probably_no" | "unknown";

// Question and answer history
export interface QAEntry {
  question: string;
  answer: AnswerType;
}

// Game phases
export type GamePhase = "intro" | "questioning" | "guessing" | "result";

// Categories
export type Category = "character" | "person" | "animal" | "object" | "place";

// Game state
export interface AkinatorState {
  phase: GamePhase;
  category?: Category;
  questionCount: number;
  maxQuestions: number;
  qaHistory: QAEntry[];
  guess?: string;
  isCorrect?: boolean;
  score?: number;
  message: string;
}
```

Consolidating game state into a single `AkinatorState` makes View-side display easier.

### Tool Definition ([definition.ts](https://github.com/isamu/AkinatorGame/blob/main/src/core/definition.ts))

Definition that tells the LLM "what this tool can do."

```typescript
import type { ToolDefinition } from "gui-chat-protocol";

export const TOOL_NAME = "akinator_game";

export const TOOL_DEFINITION: ToolDefinition = {
  type: "function",
  name: TOOL_NAME,
  description:
    "Play an Akinator-style guessing game. Ask yes/no questions to guess what the user is thinking of.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["start", "answer", "guess", "reveal"],
        description: "Game action",
      },
      category: {
        type: "string",
        enum: ["character", "person", "animal", "object", "place"],
        description: "Category of thing to guess (required for 'start')",
      },
      answer: {
        type: "string",
        enum: ["yes", "no", "probably_yes", "probably_no", "unknown"],
        description: "User's answer to your question",
      },
      guess: {
        type: "string",
        description: "Your guess of what the user is thinking",
      },
      wasCorrect: {
        type: "boolean",
        description: "Whether your guess was correct",
      },
    },
    required: ["action"],
  },
};
```

**Key Points:**

- Write `description` so the LLM can understand it
- Use `enum` to limit choices and prevent LLM errors
- Control game progression with `action`

### Execute Function ([plugin.ts](https://github.com/isamu/AkinatorGame/blob/main/src/core/plugin.ts))

Main processing executed when the LLM calls the tool.

```typescript
export const executeAkinator = async (
  context: ToolContext,
  args: AkinatorArgs,
): Promise<ToolResult<AkinatorData, AkinatorJsonData>> => {
  const { action, category, answer, guess, wasCorrect, actualAnswer } = args;

  // Get previous state
  const currentResult = context.currentResult as ToolResult<AkinatorData, AkinatorJsonData> | null;
  const prevState = currentResult?.data?.state;

  let state: AkinatorState;
  let instructions: string;

  switch (action) {
    case "start": {
      // Start game
      state = createInitialState(category);
      instructions = "Game started! Ask your first yes/no question.";
      break;
    }

    case "answer": {
      // Record user's answer
      state = {
        ...prevState,
        questionCount: prevState.questionCount + 1,
        qaHistory: [...prevState.qaHistory, { question: prevState.currentQuestion, answer }],
      };
      instructions = "Analyze answers and ask another question or make a guess.";
      break;
    }

    case "guess": {
      // AI's guess
      state = {
        ...prevState,
        phase: "guessing",
        guess,
        message: `My guess is... "${guess}"!`,
      };
      instructions = "Wait for user to confirm if correct.";
      break;
    }

    case "reveal": {
      // Show result
      const score = calculateScore(prevState.questionCount, wasCorrect);
      state = {
        ...prevState,
        phase: "result",
        isCorrect: wasCorrect,
        score,
      };
      break;
    }
  }

  return {
    toolName: TOOL_NAME,
    data: { state, message: state.message },      // For View
    jsonData: { state, availableActions },         // For LLM
    message: state.message,
    instructions,                                  // Next instruction for LLM
    updating: action !== "start",                  // Update existing result
  };
};
```

**Important ToolResult Fields:**

| Field | Purpose |
|-------|---------|
| `data` | For View component (invisible to LLM) |
| `jsonData` | Data to show to LLM |
| `instructions` | Next action instruction for LLM |
| `updating` | If true, update existing result instead of adding new |

### View Component ([View.vue](https://github.com/isamu/AkinatorGame/blob/main/src/vue/View.vue))

Vue component that displays the game UI.

```vue
<template>
  <div class="p-8 bg-gradient-to-br from-purple-900 to-blue-900">
    <!-- Header -->
    <div class="text-center mb-8">
      <div class="text-6xl mb-4">🔮</div>
      <h2 class="text-white text-3xl font-bold">Akinator</h2>
    </div>

    <!-- Message -->
    <div class="bg-white/10 rounded-xl p-6 mb-6">
      <p class="text-white text-xl text-center">
        {{ gameData.state.message }}
      </p>
    </div>

    <!-- Answer buttons (questioning phase) -->
    <div v-if="gameData.state.phase === 'questioning'" class="grid grid-cols-2 gap-3">
      <button
        v-for="answer in answerOptions"
        :key="answer.value"
        @click="sendAnswer(answer.value)"
        class="py-4 rounded-xl font-bold"
        :class="answer.class"
      >
        {{ answer.label }}
      </button>
    </div>

    <!-- Confirm guess (guessing phase) -->
    <div v-if="gameData.state.phase === 'guessing'" class="grid grid-cols-2 gap-4">
      <button @click="confirmGuess(true)" class="bg-green-500 text-white">
        🎉 Correct!
      </button>
      <button @click="confirmGuess(false)" class="bg-red-500 text-white">
        😅 Wrong
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  selectedResult: ToolResult;
  sendTextMessage: (text?: string) => void;  // Send message to chat
}>();

const gameData = ref<AkinatorData | null>(null);

// Update data when result changes
watch(
  () => props.selectedResult,
  (newResult) => {
    if (newResult?.toolName === TOOL_NAME && newResult.data) {
      gameData.value = newResult.data as AkinatorData;
    }
  },
  { immediate: true }
);

// Send answer
function sendAnswer(answer: string) {
  const label = { yes: "Yes", no: "No", ... }[answer];
  props.sendTextMessage(label);  // Send as text to chat
}

// Send guess confirmation
function confirmGuess(wasCorrect: boolean) {
  if (wasCorrect) {
    props.sendTextMessage("Correct! You got it!");
  }
}
</script>
```

**Key Points:**

- Use `sendTextMessage` to send user actions to chat
- LLM interprets that text and decides the next action
- Button click → Text send → LLM process → Tool call → View update

## Game Flow Diagram

```
[User] "Let's play Akinator"
      ↓
[LLM] akinator_game(action="start", category="character")
      ↓
[View] "I'll guess a character! Think of something."
      ↓
[LLM] "Is it a Japanese character?"
      ↓
[View] Show buttons [Yes] [No] [Probably...] [Don't Know]
      ↓
[User] Click "Yes" button
      ↓
[View] sendTextMessage("Yes")
      ↓
[LLM] akinator_game(action="answer", answer="yes")
      ↓
[LLM] "Is it an anime character?"
      ↓
   ... repeat ...
      ↓
[LLM] akinator_game(action="guess", guess="Doraemon")
      ↓
[View] "My guess is... Doraemon!" [Correct!] [Wrong]
      ↓
[User] Click "Correct!"
      ↓
[View] "🎉 Correct! Guessed in 8 questions! Score: 80 points"
```

# Plugin Distribution

Here's how to make your developed plugin available in MulmoChat.

## Build and Register to GitHub

Once your plugin is complete, distribute it with these steps:

```bash
# 1. Build
yarn build

# 2. Add dist directory to git
git add -f dist/
git commit -m "Build plugin"
git push
```

**Note**: Normally `dist/` is in `.gitignore`, but when installing directly from GitHub, you need to include the built files in the repository.

## Installing in MulmoChat

Adding a plugin to MulmoChat requires 3 steps.

### 1. Install Package

When installing directly from GitHub:

```bash
yarn add github:username/AkinatorGame
```

If published to npm:

```bash
yarn add guichat-plugin-akinator
```

### 2. src/main.ts - Import CSS

Load the plugin's styles:

```typescript
// Add after existing imports
import "guichat-plugin-akinator/style.css";

createApp(App).use(router).mount("#app");
```

**Important**: If you don't import the CSS, plugin styles won't be applied.

### 3. src/tools/index.ts - Register Plugin

Import the plugin and add it to the list:

```typescript
// Add import
import AkinatorPlugin from "guichat-plugin-akinator/vue";

const pluginList = [
  // Existing plugins...
  OthelloPlugin,
  TicTacToePlugin,
  // Add new plugin
  AkinatorPlugin,
];

export const getPluginList = () => pluginList;
```

### Summary: 3 Steps

| File | Change |
|------|--------|
| `package.json` | Add dependency |
| `src/main.ts` | Import CSS |
| `src/tools/index.ts` | Import plugin & add to list |

```bash
# Actual commands
yarn add github:username/AkinatorGame
# Then edit main.ts and tools/index.ts
yarn dev  # Verify it works
```

## Development Environment vs MulmoChat

| Feature | Dev Environment (yarn dev) | MulmoChat |
|---------|---------------------------|-----------|
| Input Method | Text only | Text + **Voice** |
| API Mode | Mock / Real API | Real API |
| Plugins | Single plugin testing | Multiple plugin integration |

The development environment is text input only, but **MulmoChat supports voice input**.

For Akinator, just say "Let's play Akinator" to start the game, and answer "yes" or "no" by voice. A more natural experience is possible by combining button operations with voice.

```
Development Environment:
[Text Input] → [LLM] → [GUI Display]

MulmoChat:
[Text or Voice] → [LLM] → [GUI Display + Voice Response]
```

# Summary

With MulmoChat and GUIChatPluginTemplate, you can easily create applications that combine LLMs with interactive GUIs.

- **MulmoChat**: Chat app with LLM + GUI plugins
- **GUIChatPluginTemplate**: Plugin development template
- **Akinator**: Actual game implementation example

Try creating your own plugin!

## Links

- [MulmoChat](https://github.com/receptron/MulmoChat) - Chat app with GUI plugin support
- [GUIChatPluginTemplate](https://github.com/receptron/GUIChatPluginTemplate) - Plugin development template
- [AkinatorGame](https://github.com/isamu/AkinatorGame) - Plugin created in this article

---

If you have questions or feedback, we're waiting in the Issues of each repository!
