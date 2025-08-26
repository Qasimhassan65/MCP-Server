#!/usr/bin/env node
import { stdin, stdout, stderr } from 'process';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let buf = Buffer.alloc(0);

function send(obj) {
    try {
        const json = Buffer.from(JSON.stringify(obj));
        const head = Buffer.from(`Content-Length: ${json.length}\r\n\r\n`);
        stdout.write(Buffer.concat([head, json]));
    } catch (e) {
        console.error('[ERROR] Failed to send response:', e);
    }
}

// --- Listen to incoming messages ---
stdin.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
        const sep = buf.indexOf('\r\n\r\n');
        if (sep === -1) return;
        const m = /Content-Length:\s*(\d+)/i.exec(buf.slice(0, sep).toString());
        if (!m) { buf = buf.slice(sep + 4); continue; }
        const len = parseInt(m[1]);
        const total = sep + 4 + len;
        if (buf.length < total) return;
        const body = buf.slice(sep + 4, total).toString();
        buf = buf.slice(total);
        try {
            const msg = JSON.parse(body);
            handle(msg);
        } catch (e) {
            console.error('[ERROR] Failed to parse message:', e);
        }
    }
});

// --- Call Python MCP tool ---
async function callPythonSummarizer(operation, data) {
    return new Promise((resolve, reject) => {
        const pythonScript = `
import os, sys, json
sys.path.append('${process.cwd()}')
from summarizer_tool import extract_audio, transcribe_audio, summarize_transcript

data = json.loads(os.environ.get('SUMMARIZER_DATA', '{}'))

try:
    if '${operation}' == 'extract_audio':
        result = {"audio_file": extract_audio(data['input_file'])}
    elif '${operation}' == 'transcribe_audio':
        result = {"transcript": transcribe_audio(data['audio_file'])}
    elif '${operation}' == 'summarize_video':
        transcript = transcribe_audio(data['audio_file'])
        result = json.loads(summarize_transcript(transcript, filename=data.get('input_file')))
    else:
        result = {"ok": False, "error": "Unknown operation"}
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
`;

        const tempScriptPath = path.join(process.cwd(), `summarizer_temp_${Date.now()}.py`);
        fs.writeFileSync(tempScriptPath, pythonScript);

        const env = { ...process.env, SUMMARIZER_DATA: JSON.stringify(data) };

        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        const pyProcess = spawn(pythonCmd, [tempScriptPath], { env });

        let output = '', error = '';

        pyProcess.stdout.on('data', d => output += d.toString());
        pyProcess.stderr.on('data', d => error += d.toString());

        pyProcess.on('close', code => {
            try { fs.unlinkSync(tempScriptPath); } catch (e) { console.error('[WARN] Temp script cleanup failed', e); }
            if (code !== 0) return reject(new Error(`Python process failed: ${error}`));
            try { resolve(JSON.parse(output.trim())); }
            catch (e) { reject(new Error(`Failed to parse Python output: ${output}`)); }
        });
    });
}

// --- Handle MCP messages ---
function handle(msg) {
    try {
        if (msg.method === 'initialize') {
            return send({ jsonrpc: '2.0', id: msg.id, result: {} });
        }

        if (msg.method === 'tools/listTools') {
            return send({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                    tools: [
                        { name: 'extract_audio', description: 'Extract audio from a video file', inputSchema: { type: 'object', properties: { input_file: { type: 'string' } }, required: ['input_file'] } },
                        { name: 'transcribe_audio', description: 'Transcribe an audio file', inputSchema: { type: 'object', properties: { audio_file: { type: 'string' } }, required: ['audio_file'] } },
                        { name: 'summarize_video', description: 'Summarize a video file', inputSchema: { type: 'object', properties: { input_file: { type: 'string' } }, required: ['input_file'] } }
                    ]
                }
            });
        }
        

        if (msg.method === 'tools/callTool') {
            const { name, arguments: args } = msg.params || {};
            (async () => {
                try {
                    if (name === 'extract_audio') {
                        if (!args?.input_file) return send({ jsonrpc:'2.0', id: msg.id, error:{ code:-32000, message:'Missing input_file' } });
                        const result = await callPythonSummarizer('extract_audio', { input_file: args.input_file });
                        return send({ jsonrpc: '2.0', id: msg.id, result: result });
                    }
                    if (name === 'transcribe_audio') {
                        if (!args?.audio_file) return send({ jsonrpc:'2.0', id: msg.id, error:{ code:-32000, message:'Missing audio_file' } });
                        const result = await callPythonSummarizer('transcribe_audio', { audio_file: args.audio_file });
                        return send({ jsonrpc: '2.0', id: msg.id, result: result });
                    }
                    if (name === 'summarize_video') {
                        if (!args?.input_file) return send({ jsonrpc:'2.0', id: msg.id, error:{ code:-32000, message:'Missing input_file' } });
                        const result = await callPythonSummarizer('summarize_video', { input_file: args.input_file });
                        return send({ jsonrpc: '2.0', id: msg.id, result: result });
                    }
                    send({ jsonrpc:'2.0', id: msg.id, error:{ code:-32601, message:'Method not found' } });
                } catch (e) {
                    console.error('[ERROR] callTool failed:', e);
                    send({ jsonrpc:'2.0', id: msg.id, error:{ code:-32000, message: String(e) } });
                }
            })();
            return;
        }

        if (msg.id) {
            send({ jsonrpc:'2.0', id: msg.id, error:{ code:-32601, message:'Method not found' } });
        }
    } catch (e) {
        console.error('[ERROR] handle failed:', e);
    }
}

console.error('[INFO] Summarizer MCP server running...');
