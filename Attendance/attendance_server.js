#!/usr/bin/env node
const { stdin, stdout, stderr } = process;
const { spawn } = require('child_process');
const path = require('path');

let buf = Buffer.alloc(0);
function send(obj){
    const json = Buffer.from(JSON.stringify(obj));
    const head = Buffer.from(`Content-Length: ${json.length}\r\n\r\n`);
    stdout.write(Buffer.concat([head,json]));
}

stdin.on('data', chunk=> {
    buf = Buffer.concat([buf, chunk]);
    while(true){
        const sep = buf.indexOf('\r\n\r\n');
        if (sep===-1) return;
        const m = /Content-Length:\s*(\d+)/i.exec(buf.slice(0,sep).toString());
        if(!m) { buf = buf.slice(sep+4); continue; }
        const len = parseInt(m[1]);
        const total = sep+4+len;
        if (buf.length < total) return;
        const body = buf.slice(sep+4,total).toString();
        buf = buf.slice(total);
        try { handle(JSON.parse(body)); } catch(e){ stderr.write(String(e)+'\n'); }
    }
});

async function callPythonAttendance(image_path, write_csv) {
    return new Promise((resolve, reject) => {
        const pythonScript = `
import sys
import os
sys.path.append('/Users/abdulmajeed/Downloads/Attendance')
from simple_recog_utils import mark_attendance_from_image_path
import json

try:
    result = mark_attendance_from_image_path('${image_path}', ${write_csv ? 'True' : 'False'})
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
`;

        const pythonProcess = spawn('/Users/abdulmajeed/Downloads/Attendance/venv/bin/python', ['-c', pythonScript], {
            cwd: '/Users/abdulmajeed/Downloads/Attendance',
            env: { ...process.env, PYTHONPATH: '/Users/abdulmajeed/Downloads/Attendance' }
        });

        let output = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python process failed: ${error}`));
                return;
            }
            try {
                const result = JSON.parse(output.trim());
                resolve(result);
            } catch (e) {
                reject(new Error(`Failed to parse Python output: ${output}`));
            }
        });
    });
}

function handle(msg){
    if (msg.method==='initialize') return send({ jsonrpc:'2.0', id: msg.id, result: { } });
    if (msg.method==='tools/listTools') return send({ jsonrpc:'2.0', id: msg.id, result: { tools: [
        { name:'mark_attendance', description:'Identify faces in a single image and (optionally) append to today\'s CSV.', inputSchema:{ type:'object', properties:{ image_path:{ type:'string' }, write_csv:{ type:'boolean', default: true } }, required:['image_path'] } }
    ] } });
    if (msg.method==='tools/callTool'){
        const { name, arguments:args } = msg.params||{};
        if (name==='mark_attendance'){
            (async () => {
                try {
                    const { image_path, write_csv = true } = args;
                    
                    if (!image_path) {
                        return send({ jsonrpc:'2.0', id: msg.id, error: { code:-32000, message:'Missing image_path parameter' } });
                    }

                    // Call the real Python implementation
                    const result = await callPythonAttendance(image_path, write_csv);
                    
                    return send({ jsonrpc:'2.0', id: msg.id, result: { result } });
                } catch(e){
                    return send({ jsonrpc:'2.0', id: msg.id, error: { code:-32000, message:String(e) } });
                }
            })();
            return;
        }
    }
    if (msg.id) send({ jsonrpc:'2.0', id: msg.id, error:{ code:-32601, message:'Method not found' } });
}
