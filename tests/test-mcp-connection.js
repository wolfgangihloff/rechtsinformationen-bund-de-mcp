#!/usr/bin/env node

// Test script to simulate what Claude Desktop does
import { spawn } from 'child_process';
import path from 'path';

console.log('🔄 Testing MCP Server Connection (simulating Claude Desktop)');
console.log('=' .repeat(60));

const serverPath = path.join(process.cwd(), 'dist/index.js');

console.log(`Starting MCP server: ${serverPath}`);

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send MCP initialization
const initMessage = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "test-client",
      version: "1.0.0"
    }
  }
};

console.log('\n📤 Sending initialization message...');
server.stdin.write(JSON.stringify(initMessage) + '\n');

// Listen for responses
server.stdout.on('data', (data) => {
  console.log('\n📥 Server response:');
  console.log(data.toString());
});

server.stderr.on('data', (data) => {
  console.log('\n❌ Server error:');
  console.log(data.toString());
});

server.on('close', (code) => {
  console.log(`\n🔚 Server process exited with code ${code}`);
});

// Send list tools request after a moment
setTimeout(() => {
  const toolsMessage = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list"
  };
  
  console.log('\n📤 Requesting available tools...');
  server.stdin.write(JSON.stringify(toolsMessage) + '\n');
}, 1000);

// Clean shutdown after 5 seconds
setTimeout(() => {
  console.log('\n🏁 Test complete - terminating server');
  server.kill();
}, 5000);