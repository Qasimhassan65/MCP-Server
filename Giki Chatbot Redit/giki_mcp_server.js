#!/usr/bin/env node
import { stdin, stdout, stderr } from 'process';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let buf = Buffer.alloc(0);
let pythonProcess = null;
let isInitialized = false;
let pendingRequests = new Map();
let requestId = 0;

function send(obj) {
    // Send with HTTP-style framing like the main server expects
    const json = Buffer.from(JSON.stringify(obj), 'utf8');
    const head = Buffer.from(`Content-Length: ${json.length}\r\n\r\n`, 'utf8');
    stdout.write(Buffer.concat([head, json]));
}

// Start persistent Python process
function startPythonProcess() {
    if (pythonProcess) return pythonProcess;
    
    const pythonScript = `
import sys
import os
import json
import traceback
import time
import warnings

# Suppress all warnings to avoid interfering with JSON output
warnings.filterwarnings("ignore")
os.environ['PYTHONWARNINGS'] = 'ignore'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

# Add the current directory to Python path
sys.path.append('/Users/abdulmajeed/Downloads/Giki Chatbot Redit')

# Redirect stderr to devnull to suppress warnings
old_stderr = sys.stderr
sys.stderr = open(os.devnull, 'w')

try:
    from chatbot import GIKIbot
    
    # Restore stderr for our own messages
    sys.stderr.close()
    sys.stderr = old_stderr
    
    # Initialize the bot once
    print("Initializing GIKI Bot...", file=sys.stderr)
    bot = GIKIbot()
    init_result = bot.initialize_system()
    
    if "❌" in init_result:
        print(json.dumps({"ok": False, "error": init_result}), file=sys.stderr)
        sys.exit(1)
    else:
        print("GIKI Bot initialized successfully!", file=sys.stderr)
    
    # Keep the process alive and handle requests
    while True:
        try:
            line = input()
            if not line.strip():
                continue
                
            data = json.loads(line)
            request_id = data.get('id')
            operation = data.get('operation')
            question_data = data.get('data', {})
            
            try:
                if operation == 'ask_giki':
                    question = question_data.get('question', '')
                    if not question:
                        result = {"ok": False, "error": "No question provided"}
                    else:
                        # Suppress all output during question processing
                        old_stdout = sys.stdout
                        old_stderr = sys.stderr
                        sys.stdout = open(os.devnull, 'w')
                        sys.stderr = open(os.devnull, 'w')
                        try:
                            answer = bot.ask_question(question)
                        finally:
                            sys.stdout.close()
                            sys.stderr.close()
                            sys.stdout = old_stdout
                            sys.stderr = old_stderr
                        result = {"ok": True, "answer": answer}
                        
                elif operation == 'health':
                    result = {
                        "ok": True, 
                        "status": "ready",
                        "initialized": True,
                        "faiss_exists": os.path.exists('faiss_index'),
                        "note": "Bot is ready and initialized"
                    }
                else:
                    result = {"ok": False, "error": "Unknown operation"}
                
                response = {"id": request_id, "result": result}
                print(json.dumps(response))
                
            except Exception as e:
                error_response = {"id": request_id, "error": f"Error: {str(e)}"}
                print(json.dumps(error_response))
            
        except EOFError:
            break
        except Exception as e:
            print(json.dumps({"error": f"Error: {str(e)}"}))
            
except ImportError as e:
    # Restore stderr for error reporting
    sys.stderr.close()
    sys.stderr = old_stderr
    print(json.dumps({"ok": False, "error": f"Import error: {str(e)}. Please install required dependencies."}), file=sys.stderr)
    sys.exit(1)
except Exception as e:
    # Restore stderr for error reporting
    sys.stderr.close()
    sys.stderr = old_stderr
    print(json.dumps({"ok": False, "error": f"Error: {str(e)}\\nTraceback: {traceback.format_exc()}"}), file=sys.stderr)
    sys.exit(1)
`;

    const tempScriptPath = '/tmp/giki_persistent_script.py';
    fs.writeFileSync(tempScriptPath, pythonScript);

    const env = {
        ...process.env,
        PYTHONPATH: '/Users/abdulmajeed/Downloads/Giki Chatbot Redit',
        PYTHONWARNINGS: 'ignore',
        TOKENIZERS_PARALLELISM: 'false'
    };

    pythonProcess = spawn('/Users/abdulmajeed/Downloads/Attendance/venv/bin/python', [tempScriptPath], {
        cwd: '/Users/abdulmajeed/Downloads/Giki Chatbot Redit',
        env: env,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    pythonProcess.stderr.on('data', (data) => {
        stderr.write(`[Python] ${data}`);
    });

    pythonProcess.on('close', (code) => {
        stderr.write(`Python process closed with code ${code}\n`);
        pythonProcess = null;
        isInitialized = false;
    });

    pythonProcess.on('error', (err) => {
        stderr.write(`Python process error: ${err.message}\n`);
        pythonProcess = null;
        isInitialized = false;
    });

    return pythonProcess;
}

async function callPythonGIKI(operation, data) {
    return new Promise((resolve, reject) => {
        if (!pythonProcess) {
            pythonProcess = startPythonProcess();
        }

        const currentRequestId = ++requestId;
        const request = {
            id: currentRequestId,
            operation: operation,
            data: data
        };

        // Store the promise resolvers
        pendingRequests.set(currentRequestId, { resolve, reject });

                       const timeout = setTimeout(() => {
                   pendingRequests.delete(currentRequestId);
                   reject(new Error('Python process timeout'));
               }, 90000); // 90 second timeout

        // Override the resolvers to clear timeout
        const originalResolve = resolve;
        const originalReject = reject;
        
        pendingRequests.set(currentRequestId, { 
            resolve: (result) => {
                clearTimeout(timeout);
                pendingRequests.delete(currentRequestId);
                originalResolve(result);
            }, 
            reject: (error) => {
                clearTimeout(timeout);
                pendingRequests.delete(currentRequestId);
                originalReject(error);
            }
        });

        pythonProcess.stdin.write(JSON.stringify(request) + '\n');
    });
}

// Handle responses from Python process
function handlePythonResponse(data) {
    try {
        const lines = data.toString().split('\n');
        
        // Find the last valid JSON line
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line && line.startsWith('{') && line.endsWith('}')) {
                try {
                    const response = JSON.parse(line);
                    const requestId = response.id;
                    
                    if (requestId && pendingRequests.has(requestId)) {
                        const { resolve, reject } = pendingRequests.get(requestId);
                        if (response.error) {
                            reject(new Error(response.error));
                        } else {
                            resolve(response.result);
                        }
                    }
                    return;
                } catch (e) {
                    // Continue to next line
                }
            }
        }
        
        // If no valid JSON found, log the raw data for debugging
        stderr.write(`No valid JSON found in response: ${data.toString()}\n`);
    } catch (e) {
        stderr.write(`Error parsing Python response: ${e.message}\n`);
        stderr.write(`Raw data: ${data.toString()}\n`);
    }
}

stdin.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    
    // Handle HTTP-style framing with Content-Length headers
    while (true) {
        const sep = buf.indexOf('\r\n\r\n');
        if (sep === -1) return;
        
        const header = buf.slice(0, sep).toString('utf8');
        const m = header.match(/Content-Length:\s*(\d+)/i);
        if (!m) { 
            buf = buf.slice(sep + 4); 
            continue; 
        }
        
        const len = parseInt(m[1], 10);
        const total = sep + 4 + len;
        if (buf.length < total) return;
        
        const body = buf.slice(sep + 4, total).toString('utf8');
        buf = buf.slice(total);
        
        try {
            const msg = JSON.parse(body);
            handle(msg);
        } catch (e) {
            stderr.write(`Error parsing JSON: ${e.message}\n`);
            stderr.write(`Received body: ${body}\n`);
        }
    }
});

function handle(msg) {
    if (msg.method === 'initialize') {
        // Start Python process during initialization
        if (!pythonProcess) {
            pythonProcess = startPythonProcess();
            
            // Set up response handler
            pythonProcess.stdout.on('data', handlePythonResponse);
        }
        return send({ jsonrpc: '2.0', id: msg.id, result: {} });
    }

    if (msg.method === 'tools/listTools') {
        return send({
            jsonrpc: '2.0',
            id: msg.id,
            result: {
                tools: [
                    {
                        name: 'ask_giki',
                        description: 'Ask questions about GIKI university using document knowledge and Reddit integration. First searches official documents, then falls back to Reddit discussions if needed.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                question: {
                                    type: 'string',
                                    description: 'The question to ask about GIKI university, courses, policies, admission requirements, fees, or any related information'
                                }
                            },
                            required: ['question']
                        }
                    },
                    {
                        name: 'rebuild_index',
                        description: 'Admin tool: rebuild the FAISS index from the GIKI documentation files in the data folder',
                        inputSchema: {
                            type: 'object',
                            properties: {}
                        }
                    },
                    {
                        name: 'health',
                        description: 'Check the health status of the GIKI Chatbot system including initialization status and FAISS index',
                        inputSchema: {
                            type: 'object',
                            properties: {}
                        }
                    }
                ]
            }
        });
    }

    if (msg.method === 'tools/callTool') {
        const { name, arguments: args } = msg.params;
        
        callPythonGIKI(name, args)
            .then(result => {
                send({
                    jsonrpc: '2.0',
                    id: msg.id,
                    result: {
                        content: [{ type: 'text', text: JSON.stringify(result) }]
                    }
                });
            })
            .catch(error => {
                send({
                    jsonrpc: '2.0',
                    id: msg.id,
                    error: {
                        code: -32603,
                        message: error.message
                    }
                });
            });
        return;
    }

    if (msg.id) {
        send({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: -32601, message: 'Method not found' }
        });
    }
}
