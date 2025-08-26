#!/usr/bin/env node
import fetch from 'node-fetch';
const { stdin, stdout, stderr } = process;
let buf = Buffer.alloc(0);
function send(obj){ const json=Buffer.from(JSON.stringify(obj)); const head=Buffer.from(`Content-Length: ${json.length}\r\n\r\n`); stdout.write(Buffer.concat([head,json])); }
stdin.on('data', chunk=> { buf=Buffer.concat([buf,chunk]); while(true){ const i=buf.indexOf('\r\n\r\n'); if(i===-1) return; const m=/Content-Length:\s*(\d+)/i.exec(buf.slice(0,i).toString()); if(!m){ buf=buf.slice(i+4); continue;} const len=parseInt(m[1]); const total=i+4+len; if(buf.length<total) return; const body=buf.slice(i+4,total).toString(); buf=buf.slice(total); try{ handle(JSON.parse(body)); }catch(e){ stderr.write(String(e)+'\n'); } } });


function handle(msg){
if (msg.method==='initialize') return send({ jsonrpc:'2.0', id: msg.id, result: { } });
if (msg.method==='tools/listTools') return send({ jsonrpc:'2.0', id: msg.id, result: { tools: [
{ name:'http_get', description:'HTTP GET and return status, title, textSnippet', inputSchema:{ type:'object', properties:{ url:{ type:'string' } }, required:['url'] } }
] } });
if (msg.method==='tools/callTool'){
const { name, arguments:args } = msg.params||{};
if (name==='http_get') return httpGet(msg.id, args);
}
if (msg.id) send({ jsonrpc:'2.0', id: msg.id, error:{ code:-32601, message:'Method not found' } });
}


async function httpGet(id, { url }){
try {
const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'mcp-webfetch/0.1' }});
const html = await r.text();
const title = /<title>([^<]+)<\/title>/i.exec(html)?.[1] || '';
const text = html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,400);
send({ jsonrpc:'2.0', id, result: { status: r.status, title, textSnippet: text } });
} catch(e){
send({ jsonrpc:'2.0', id, error: { code:-32000, message: String(e) } });
}
}