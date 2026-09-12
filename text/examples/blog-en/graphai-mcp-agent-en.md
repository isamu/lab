---
title: "GraphAI - MCP(Model Context Protocol) Agnet"
emoji: "🤖"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: [agent, AI, LLM, Tech, GraphAI]
published: true
publication_name: "singularity"
---

GraphAI now supports MCP (Model Context Protocol).

There are two ways to invoke an MCP server: via network or through inter-process communication. In this implementation, we focus only on inter-process communication using the `command` configuration.

While MCP provides various methods like `init` and `resources`, this implementation only makes use of `tools/list` and `tools/call`. These two methods are sufficient to interact with most MCP servers.

Unlike other GraphAI agents, MCP requires an initial connection to the server before it can be used. This involves executing a command on the host machine to start the server. Therefore, the MCP initialization process must occur before GraphAI is initialized.

GraphAI example is here.

https://github.com/receptron/graphai-agents/blob/main/protocol/mcp-agent/tests/run_graph.ts

npm is

https://www.npmjs.com/package/@graphai/mcp_agent


### 1. Configuring each service via `mcpConfig`

Each service is defined as a pair of `command` and `args`. This pattern can be extended to other applications as well.

The `mcpConfig` uses unique service names (in this example, `filesystem` and `filesystem2`) as `keys`, and specifies configuration values as `values`. The following example demonstrates this using the [server-filesystem](https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem) MCP server, which operates on the local file system.

The `filesystem` configuration shows how to run the npm package directly via `npx`, while `filesystem2` specifies the executable file after installing the npm package. Both methods function the same way, and typically, you only need to specify one of them. However, both are shown here as examples of different configuration approaches.


```TypeScript
export const mcpConfig = {
  filesystem: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", path],
  },
  filesystem2: {
    command: __dirname + "/../../../node_modules/@modelcontextprotocol/server-filesystem/dist/index.js",
    args: [path],
  },
};
```

### 2. Initializing MCP and connecting to the server

MCP must be started before running GraphAI. Since the startup time may vary, it’s recommended to include a waiting period to ensure the server is ready. If GraphAI is run before MCP finishes initializing, the list of tools might be returned as empty.

The function that initializes MCP returns mcpClients. Since mcpClients is required when calling MCP, it is passed as a config to the GraphAI instance.
It is also needed when closing the connection to the MCP server.

```TypeScript
  const mcpClients = await mcpInit(mcpConfig)
  await setTimeout(2000);
```

### 3. Running GraphAI

When creating a GraphAI instance, mcpClients is passed via the config.
Since MCP is divided into multiple agents, mcpClients is provided globally (although it's also possible to pass it individually).

After defining the graph data and registering the necessary agents, GraphAI can be executed.

The `mcpToolsListAgent` returns a merged list of tools from all services defined in the configuration. Tool names are prefixed with the service name to handle namespace collisions. The tools are provided in both raw format and OpenAI-compatible format.

The `mcpToolsCallAgent` executes the selected tool via `tools/call`, using the namespaced tool name as-is.

```TypeScript
  const graphData = {
    version: 0.5,
    nodes: {
      list: {
        agent: "mcpToolsListAgent",
        isResult: true,
        console: true,
      },
      llm: {
        agent: "openAIAgent",
        inputs: {
          tools: ":list.llmTools",
          prompt: "get all file list on " + path
        },
      },
      call: {
        console: {before: true, after: true},
        agent: "mcpToolsCallAgent",
        inputs: {
          tools: ":llm.tool"
        },
      },
    },
  };
  const graphai = new GraphAI(graphData, {...vanilla,  mcpToolsListAgent, mcpToolsCallAgent, openAIAgent }, { config: { global: { mcpClients } } });
  const result = await graphai.run();
  
```  

Result is

```TypeScript
{
  "response": {
    "content": [
      {
        "type": "text",
        "text": "[FILE] 1.txt\n[FILE] 2.txt"
      }
    ]
  }
}
```

### 4. Disconnecting from the MCP server

Be sure to explicitly disconnect from the MCP server when your batch job or server (e.g., Express) shuts down.
mcpClients is also passed when disconnecting.

```TypeScript
  await setTimeout(500);
  mcpClose(mcpClients);
```

