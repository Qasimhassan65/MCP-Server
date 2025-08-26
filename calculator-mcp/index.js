#!/usr/bin/env node
const { stdin, stdout, stderr } = process;


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


function handle(msg){
if (msg.method==='initialize') return send({ jsonrpc:'2.0', id: msg.id, result: { } });
if (msg.method==='tools/listTools') return send({ jsonrpc:'2.0', id: msg.id, result: { tools: [
{ name:'calc', description:'Evaluate a math expression', inputSchema:{ type:'object', properties:{ expression:{ type:'string' } }, required:['expression'] } }
] } });
if (msg.method==='tools/callTool'){
const { name, arguments:args } = msg.params||{};
if (name==='calc'){
try {
// very naive eval – replace with a safe evaluator in production
const result = Function(`'use strict'; return (${args.expression});`)();
return send({ jsonrpc:'2.0', id: msg.id, result: { result } });
} catch(e){
return send({ jsonrpc:'2.0', id: msg.id, error: { code:-32000, message:String(e) } });
}
}
}
if (msg.id) send({ jsonrpc:'2.0', id: msg.id, error:{ code:-32601, message:'Method not found' } });
}