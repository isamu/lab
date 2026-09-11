---
title: "GraphAI - About anyInput"
emoji: "🤖"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: [agent, AI, LLM, Tech, GraphAI]
published: true
publication_name: "singularity"
---

# About anyInput

`anyInput` is an option that allows the agent to execute **as soon as one of the multiple inputs defined in `inputs` arrives**.

Normally, processing begins only after all inputs are available. However, with `anyInput`, processing can begin **as soon as the first input is available**.  
This is useful in cases where responsiveness is prioritized, or when partial data is sufficient for processing.


```
inputs: {
  a: ":anode.data",
  b: ":bnode.data",
  c: ":cnode.data",
}
```

In a case like the above, if `bnode` finishes execution first, the input will become:

```
inputs: {
  b: ":bnode.data",
}
```

# When using with arrays

```
inputs: {
  array: [
    ":anode.data",
    ":bnode.data",
    ":cnode.data",
  ]
}
```

In a typical case, this would become:

```
inputs: {
 array: [
   undefined,
   ":bnode.data",
   undefined,
 ]
}
```

Since this is inconvenient, GraphAI filters it to:

```
inputs: {
 array: [
   ":bnode.data",
 ]
}
```
In cases like:

```
inputs: {
 array: [
   ":bnode.array",
 ]
}
```

where an array is selected (commonly used in LLM messages), you may end up with an array within an array, which is inconvenient. In such cases, it's better to use `arrayFlatAgent`.

# Usually used with if / unless

Typically, you use a node with `if` / `unless` to branch the data before using this.

# Usage Example (Implementation Sample)


https://github.com/receptron/graphai/blob/841ded91c9ef8b07ff67447988e44d85ed2f4010/llm_agents/tools_agent/src/tools_agent.ts#L107

https://github.com/receptron/graphai/blob/841ded91c9ef8b07ff67447988e44d85ed2f4010/packages/samples/src/llm/research.ts#L143

https://github.com/receptron/graphai/blob/841ded91c9ef8b07ff67447988e44d85ed2f4010/packages/samples/graph_data/ollama/weather.yaml#L104

https://github.com/receptron/graphai/blob/841ded91c9ef8b07ff67447988e44d85ed2f4010/agents/vanilla_agents/src/string_agents/string_update_text_agent.ts#L29