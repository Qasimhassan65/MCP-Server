#!/usr/bin/env node
const { spawn } = require('child_process');

async function testSQLiteMCP() {
    const sqliteProcess = spawn('node', ['sqlite_server.js'], {
        cwd: '/Users/abdulmajeed/Downloads/sqlite-mcp',
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let error = '';

    sqliteProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log('STDOUT:', data.toString());
    });

    sqliteProcess.stderr.on('data', (data) => {
        error += data.toString();
        console.log('STDERR:', data.toString());
    });

    // Test initialization
    const initMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
    };

    const initRequest = `Content-Length: ${JSON.stringify(initMessage).length}\r\n\r\n${JSON.stringify(initMessage)}`;
    sqliteProcess.stdin.write(initRequest);

    // Wait a bit, then test tool listing
    setTimeout(() => {
        const listMessage = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/listTools',
            params: {}
        };

        const listRequest = `Content-Length: ${JSON.stringify(listMessage).length}\r\n\r\n${JSON.stringify(listMessage)}`;
        sqliteProcess.stdin.write(listRequest);
    }, 1000);

    // Wait a bit more, then test database query
    setTimeout(() => {
        const queryMessage = {
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/callTool',
            params: {
                name: 'list_tables',
                arguments: {}
            }
        };

        const queryRequest = `Content-Length: ${JSON.stringify(queryMessage).length}\r\n\r\n${JSON.stringify(queryMessage)}`;
        sqliteProcess.stdin.write(queryRequest);
    }, 2000);

    // Wait for results and close
    setTimeout(() => {
        sqliteProcess.kill();
        console.log('\n=== FINAL OUTPUT ===');
        console.log(output);
        console.log('\n=== ERRORS ===');
        console.log(error);
    }, 5000);
}

testSQLiteMCP().catch(console.error);
