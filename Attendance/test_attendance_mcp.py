#!/usr/bin/env python3
import json
import subprocess
import time
import sys

def test_attendance_mcp():
    print("Testing Attendance MCP server...")
    
    # Start the MCP server
    proc = subprocess.Popen(
        ['python', 'attendance_mcp_server.py'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd='/Users/abdulmajeed/Downloads/Attendance'
    )
    
    try:
        # Send initialization request
        init_request = {
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'initialize',
            'params': {
                'protocolVersion': '2024-11-05',
                'capabilities': {'tools': {'listChanged': True}},
                'clientInfo': {'name': 'test', 'version': '0.1.0'}
            }
        }
        
        # Format as MCP message
        message = json.dumps(init_request)
        header = f'Content-Length: {len(message)}\r\n\r\n'
        full_message = header + message
        
        print(f"Sending: {full_message}")
        proc.stdin.write(full_message.encode())
        proc.stdin.flush()
        
        # Wait for response
        time.sleep(3)
        
        # Read response
        response = proc.stdout.read()
        print(f"Response: {response.decode()}")
        
        # Send list tools request
        list_request = {
            'jsonrpc': '2.0',
            'id': 2,
            'method': 'tools/listTools',
            'params': {}
        }
        
        message = json.dumps(list_request)
        header = f'Content-Length: {len(message)}\r\n\r\n'
        full_message = header + message
        
        print(f"Sending: {full_message}")
        proc.stdin.write(full_message.encode())
        proc.stdin.flush()
        
        # Wait for response
        time.sleep(3)
        
        # Read response
        response = proc.stdout.read()
        print(f"Response: {response.decode()}")
        
    finally:
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    test_attendance_mcp()
