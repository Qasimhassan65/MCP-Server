# GIKI Chatbot MCP Server (Node.js)

This is a Node.js-based MCP (Model Context Protocol) server for the GIKI chatbot, converted from the original Python implementation.

## Features

- Document processing (PDF, DOCX, TXT, JSON)
- RAG (Retrieval-Augmented Generation) with OpenRouter API
- Answer quality assessment
- Reddit fallback search
- MCP protocol support for Claude Desktop

## Setup

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the project root with:
   ```
   OPENROUTER_API_KEY=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
   OPENAI_API_KEY=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
   OPENAI_API_BASE=https://openrouter.ai/api/v1
   ```

3. **Data Files:**
   Place your GIKI documents (PDF, DOCX, TXT, JSON) in the `data/` folder.

## Usage

### Direct Usage
```bash
node server.js
```

### MCP Client Integration
Use the wrapper script `giki-mcp-wrapper.sh` in your MCP client configuration:

```json
{
  "mcpServers": {
    "giki-chatbot": {
      "command": "bash",
      "args": ["path/to/giki-mcp-wrapper.sh"]
    }
  }
}
```

## Available Tools

- `ask_giki`: Ask questions about GIKI
- `rebuild_index`: Rebuild the document index
- `health`: Check server health status

## Architecture

- `server.js`: Main MCP server implementation
- `chatbot.js`: Core chatbot logic with document processing and RAG
- `package.json`: Node.js dependencies
- `giki-mcp-wrapper.sh`: Shell wrapper for MCP client integration

## Differences from Python Version

- Uses Node.js MCP SDK instead of Python FastMCP
- Simplified vector store implementation (JSON-based)
- Async/await pattern throughout
- Node.js-specific error handling
- Simplified Reddit integration (mock data for demonstration)

## Troubleshooting

1. **Node.js not found**: Ensure Node.js is installed and in PATH
2. **Dependencies missing**: Run `npm install`
3. **API errors**: Check your OpenRouter API key in `.env`
4. **Document processing errors**: Ensure documents are in supported formats

## Logs

Server logs are written to `giki_mcp.log` in the project directory.
