#!/usr/bin/env node

// Test script to verify the new German tool names work
import { spawn } from 'child_process';
import path from 'path';

console.log('🇩🇪 Testing New German Tool Names');
console.log('=' .repeat(50));

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

console.log('\n📤 Sending initialization...');
server.stdin.write(JSON.stringify(initMessage) + '\n');

// Listen for responses
server.stdout.on('data', (data) => {
  const responses = data.toString().trim().split('\n');
  for (const response of responses) {
    if (response.trim()) {
      try {
        const parsed = JSON.parse(response);
        if (parsed.result && parsed.result.tools) {
          console.log('\n🎯 New German Tool Names:');
          parsed.result.tools.forEach((tool, index) => {
            console.log(`${index + 1}. ${tool.name}`);
            console.log(`   ${tool.description}`);
            console.log('');
          });
        } else if (parsed.result && parsed.result.protocolVersion) {
          console.log('\n✅ Server initialized successfully');
        }
      } catch (e) {
        console.log('\n📥 Server response:', response);
      }
    }
  }
});

server.stderr.on('data', (data) => {
  const msg = data.toString();
  if (msg.includes('German Legal MCP server running')) {
    console.log('✅ Server started successfully');
  } else {
    console.log('\n❌ Server error:', msg);
  }
});

// Send list tools request
setTimeout(() => {
  const toolsMessage = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list"
  };
  
  console.log('\n📤 Requesting tool list...');
  server.stdin.write(JSON.stringify(toolsMessage) + '\n');
}, 1000);

// Clean shutdown
setTimeout(() => {
  console.log('\n🏁 Test complete');
  server.kill();
}, 3000);