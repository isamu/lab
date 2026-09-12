---
title: "GraphAI - Calling GraphAI from an OpenAI-Compatible Client"
emoji: "🤖"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: [agent, AI, LLM, Tech, GraphAI]
published: true
publication_name: "singularity"
---


# GraphAI - Calling GraphAI from an OpenAI-Compatible Client 🤖

In `@receptron/graphai_express@1.0.2`, we’ve added middleware that lets you call GraphAI as an OpenAI-compatible `completions` API.

What this means is that you can now invoke a GraphAI workflow using OpenAI libraries like `openai.chat.completions.create` or `openai.beta.chat.completions.stream`—whether you're using the npm or Python SDK. While there are some limitations (which we'll cover below), this makes it much easier to plug GraphAI into existing LLM tools and workflows.

## Sample Express Implementation

```TypeScript
import {
  completionRunner,
} from "@receptron/graphai_express";
import * as agents from "@graphai/agents";

const agentDictionary: AgentFunctionInfoDictionary = agents;

const model2graphData = (__model: string) => {
  const graphData = {
    version: 0.5,
    nodes: {
      messages: {
        value: [],
      },
      llm: {
        agent: "openAIAgent",
        params: {
          stream: true,
          isResult: true,
        },
        inputs: {
          messages: ":messages",
        },
        isResult: true,
      },
    },
  };
  return graphData;
};

const onLogCallback = (log: TransactionLog, __isUpdate: boolean) => {
  console.log(log);
};

app.post("/api/chat/completions", completionRunner(agentDictionary, model2graphData, [], onLogCallback));

```

## How It Works

All you need to do is add `completionRunner` as middleware.  
- `agentDictionary` is a dictionary of your agent implementations.  
- `model2graphData` is a function that maps a given model name to the corresponding `GraphData`.  
  In this sample, it's hardcoded for simplicity, but in a real application, it should return `GraphData` appropriate to the `model` string.

Note: In GraphAI, the model for the LLM is defined inside the `GraphData` itself.  
So, the `model` field (which is required by OpenAI’s API) is used here to determine which `GraphData` to load.

## Example (OpenAI SDK in TypeScript)

```TypeScript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:8085/api",
  apiKey: "dummy",
});

const messages = [
  {
    role: "user",
    content: [
      {
        type: "text",
        text: "How can I travel to Mars?",
      },
    ],
  },
] as any;
async function main() {
  const stream = await openai.beta.chat.completions.stream({
    model: "gpt-4o",
    messages,
  });

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content;
    if (token) process.stdout.write(token);
  }
  console.log("\n--- done ---");
  const chatCompletion = await stream.finalChatCompletion();
  console.log(JSON.stringify(chatCompletion, null, 2));

}

main().catch(console.error);
```

## Limitations

Since this is designed to work with OpenAI-compatible clients, there are some important constraints:

- You POST `messages` and receive a single assistant `message` as the result.
- The `messages` sent via POST are injected into the `messages` node in the GraphData, so a static `messages` node is required.
  - Since the client can only send `messages`, that’s the only input you can work with.
- Complex logic can be defined in `GraphData`, but only one final `message` can be returned to the client.
- Streaming is supported, but due to limitations of OpenAI client libraries, **only the result from a single LLM (Agent)** can be streamed properly:
  - If multiple agents stream in parallel, their outputs will be mixed and potentially unreadable.
  - If agents stream sequentially, you’ll likely get their results concatenated into a single stream.
- If you want to implement loop-like behavior, you can simply re-POST a new `messages` array containing:
  - The previous messages
  - The result from the last `assistant` message
  - The next user prompt

