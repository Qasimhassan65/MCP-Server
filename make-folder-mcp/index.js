#!/usr/bin/env node
import { stdin, stdout, stderr } from 'node:process';
import fs from 'node:fs';

let buf = Buffer.alloc(0);

function send(obj) {
  const json = Buffer.from(JSON.stringify(obj));
  const head = Buffer.from(`Content-Length: ${json.length}\r\n\r\n`);
  stdout.write(Buffer.concat([head, json]));
}

stdin.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  while (true) {
    const sep = buf.indexOf('\r\n\r\n');
    if (sep === -1) return;
    const m = /Content-Length:\s*(\d+)/i.exec(buf.slice(0, sep).toString());
    if (!m) { buf = buf.slice(sep + 4); continue; }
    const len = parseInt(m[1], 10);
    const total = sep + 4 + len;
    if (buf.length < total) return;
    const body = buf.slice(sep + 4, total).toString();
    buf = buf.slice(total);
    try { handle(JSON.parse(body)); } catch (e) { stderr.write(String(e) + '\n'); }
  }
});

function handle(msg) {
  if (msg.method === 'initialize')
    return send({ jsonrpc: '2.0', id: msg.id, result: {} });

  if (msg.method === 'tools/listTools')
    return send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        tools: [
          {
            name: 'make_folder',
            description: 'Create a local folder',
            inputSchema: {
              type: 'object',
              properties: { path: { type: 'string' } },
              required: ['path']
            }
          }
        ]
      }
    });

  if (msg.method === 'tools/callTool') {
    const { name, arguments: args } = msg.params || {};
    if (name === 'make_folder') {
      try {
        fs.mkdirSync(args.path, { recursive: true });
        return send({ jsonrpc: '2.0', id: msg.id, result: { ok: true, path: args.path } });
      } catch (e) {
        return send({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: String(e) } });
      }
    }
  }

  if (msg.id) send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } });
}
