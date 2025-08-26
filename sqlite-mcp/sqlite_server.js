#!/usr/bin/env node
const { stdin, stdout, stderr } = process;
const sqlite3 = require('sqlite3').verbose();
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

// Database path
const DB_PATH = '/Users/abdulmajeed/Downloads/project/mini_lms.db';

function getDatabase() {
    return new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
        }
    });
}

async function executeQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        const db = getDatabase();
        
        // Determine if it's a SELECT query or other operation
        const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
        
        if (isSelect) {
            db.all(sql, params, (err, rows) => {
                db.close();
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        ok: true,
                        type: 'query',
                        rows: rows,
                        count: rows.length
                    });
                }
            });
        } else {
            db.run(sql, params, function(err) {
                db.close();
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        ok: true,
                        type: 'update',
                        changes: this.changes,
                        lastID: this.lastID
                    });
                }
            });
        }
    });
}

async function getTableSchema(tableName) {
    return new Promise((resolve, reject) => {
        const db = getDatabase();
        db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
            db.close();
            if (err) {
                reject(err);
            } else {
                resolve({
                    ok: true,
                    table: tableName,
                    columns: rows
                });
            }
        });
    });
}

async function listTables() {
    return new Promise((resolve, reject) => {
        const db = getDatabase();
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
            db.close();
            if (err) {
                reject(err);
            } else {
                resolve({
                    ok: true,
                    tables: rows.map(row => row.name)
                });
            }
        });
    });
}

function handle(msg){
    if (msg.method==='initialize') return send({ jsonrpc:'2.0', id: msg.id, result: { } });
    
    if (msg.method==='tools/listTools') return send({ jsonrpc:'2.0', id: msg.id, result: { tools: [
        { 
            name:'query_database', 
            description:'Execute a SQL query to fetch data from the database', 
            inputSchema:{
                type:'object', 
                properties:{
                    sql:{ type:'string', description:'SQL query to execute' },
                    params:{ type:'array', description:'Parameters for the query (optional)', items:{ type:'string' } }
                }, 
                required:['sql'] 
            } 
        },
        { 
            name:'update_database', 
            description:'Execute a SQL update/insert/delete statement', 
            inputSchema:{
                type:'object', 
                properties:{
                    sql:{ type:'string', description:'SQL update statement to execute' },
                    params:{ type:'array', description:'Parameters for the statement (optional)', items:{ type:'string' } }
                }, 
                required:['sql'] 
            } 
        },
        { 
            name:'get_table_schema', 
            description:'Get the schema of a specific table', 
            inputSchema:{
                type:'object', 
                properties:{
                    table_name:{ type:'string', description:'Name of the table' }
                }, 
                required:['table_name'] 
            } 
        },
        { 
            name:'list_tables', 
            description:'List all tables in the database', 
            inputSchema:{
                type:'object', 
                properties:{}
            } 
        }
    ] } });
    
    if (msg.method==='tools/callTool'){
        const { name, arguments:args } = msg.params||{};
        
        if (name==='query_database'){
            (async () => {
                try {
                    const { sql, params = [] } = args;
                    if (!sql) {
                        return send({ jsonrpc:'2.0', id: msg.id, error: { code:-32000, message:'Missing SQL query' } });
                    }
                    
                    const result = await executeQuery(sql, params);
                    return send({ jsonrpc:'2.0', id: msg.id, result: { result } });
                } catch(e){
                    return send({ jsonrpc:'2.0', id: msg.id, error: { code:-32000, message:String(e) } });
                }
            })();
            return;
        }
        
        if (name==='update_database'){
            (async () => {
                try {
                    const { sql, params = [] } = args;
                    if (!sql) {
                        return send({ jsonrpc:'2.0', id: msg.id, error: { code:-32000, message:'Missing SQL statement' } });
                    }
                    
                    const result = await executeQuery(sql, params);
                    return send({ jsonrpc:'2.0', id: msg.id, result: { result } });
                } catch(e){
                    return send({ jsonrpc:'2.0', id: msg.id, error: { code:-32000, message:String(e) } });
                }
            })();
            return;
        }
        
        if (name==='get_table_schema'){
            (async () => {
                try {
                    const { table_name } = args;
                    if (!table_name) {
                        return send({ jsonrpc:'2.0', id: msg.id, error: { code:-32000, message:'Missing table name' } });
                    }
                    
                    const result = await getTableSchema(table_name);
                    return send({ jsonrpc:'2.0', id: msg.id, result: { result } });
                } catch(e){
                    return send({ jsonrpc:'2.0', id: msg.id, error: { code:-32000, message:String(e) } });
                }
            })();
            return;
        }
        
        if (name==='list_tables'){
            (async () => {
                try {
                    const result = await listTables();
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
