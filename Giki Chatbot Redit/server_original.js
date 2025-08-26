import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GIKIbot } from './chatbot.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure working directory is project root
process.chdir(__dirname);

// Setup logging
const logFile = 'giki_mcp.log';

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} [INFO] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
}

// Create MCP server
const server = new Server({
    name: 'GIKI-RAG-MCP',
    version: '1.0.0'
});

// Initialize GIKIbot singleton
let bot;
let initMsg;

async function initializeBot() {
    log('Starting GIKI MCP server — initializing GIKIbot...');
    bot = new GIKIbot();
    initMsg = await bot.initializeSystem();
    log(`System initialized: ${initMsg}`);
}

// Tools exposed to the LLM client (Claude)
server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'ask_giki':
                const question = args.question;
                if (!question || !question.trim()) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ error: 'empty question' }) }]
                    };
                }

                const raw = await bot.askQuestion(question);
                const parts = raw.split('\n\nSources:\n', 1);
                const answerText = parts[0].trim();
                const sources = parts.length > 1 ? parts[1].split('\n').filter(s => s.trim()) : [];

                return {
                    content: [{ 
                        type: 'text', 
                        text: JSON.stringify({ answer: answerText, sources: sources }) 
                    }]
                };

            case 'rebuild_index':
                const result = await bot.rebuildIndex();
                return {
                    content: [{ type: 'text', text: JSON.stringify({ result }) }]
                };

            case 'health':
                const healthStatus = {
                    status: 'ok',
                    initialized: bot.isInitialized(),
                    faissExists: await fs.pathExists('faiss_index')
                };
                return {
                    content: [{ type: 'text', text: JSON.stringify(healthStatus) }]
                };

            default:
                return {
                    content: [{ 
                        type: 'text', 
                        text: JSON.stringify({ error: `Unknown tool: ${name}` }) 
                    }]
                };
        }
    } catch (error) {
        log(`Error in tool ${name}: ${error.message}`);
        return {
            content: [{ 
                type: 'text', 
                text: JSON.stringify({ error: error.message }) 
            }]
        };
    }
});

// Tool definitions
server.setRequestHandler('tools/list', async () => {
    return {
        tools: [
            {
                name: 'ask_giki',
                description: 'Ask a question against the GIKI docs.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        question: {
                            type: 'string',
                            description: 'The question to ask about GIKI'
                        }
                    },
                    required: ['question']
                }
            },
            {
                name: 'rebuild_index',
                description: 'Admin tool: delete saved FAISS index and rebuild from files.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'health',
                description: 'Simple health check for monitoring.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            }
        ]
    };
});

// Run the server
async function main() {
    await initializeBot();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log('GIKI MCP server connected and ready');
}

main().catch((error) => {
    log(`Fatal error: ${error.message}`);
    process.exit(1);
});
