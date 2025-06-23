#!/usr/bin/env node

// Test the enhanced search for Jobcenter question
import { spawn } from 'child_process';
import path from 'path';

console.log('🎯 Testing Enhanced Jobcenter Search');
console.log('=' .repeat(50));

const serverPath = path.join(process.cwd(), 'dist/index.js');

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

console.log('📤 Initializing server...');
server.stdin.write(JSON.stringify(initMessage) + '\n');

// Listen for responses
let initialized = false;

server.stdout.on('data', (data) => {
  const responses = data.toString().trim().split('\n');
  for (const response of responses) {
    if (response.trim()) {
      try {
        const parsed = JSON.parse(response);
        
        if (parsed.result && parsed.result.protocolVersion && !initialized) {
          console.log('✅ Server initialized');
          initialized = true;
          
          // Now test the Jobcenter search
          setTimeout(() => {
            const searchMessage = {
              jsonrpc: "2.0",
              id: 3,
              method: "tools/call",
              params: {
                name: "alle_rechtsdokumente_suchen",
                arguments: {
                  searchTerm: "Was passiert wenn ich einen Termin beim Jobcenter verpasse",
                  limit: 5
                }
              }
            };
            
            console.log('\n🔍 Testing enhanced search for Jobcenter question...');
            server.stdin.write(JSON.stringify(searchMessage) + '\n');
          }, 500);
        }
        
        if (parsed.result && parsed.result.content) {
          console.log('\n📥 Search Results:');
          console.log(parsed.result.content[0].text);
          
          // Check if § 32 SGB II is mentioned
          const text = parsed.result.content[0].text;
          if (text.includes('§ 32') && text.includes('SGB II')) {
            console.log('\n🎯 SUCCESS: § 32 SGB II reference found!');
          } else if (text.includes('Meldeversäumnis')) {
            console.log('\n✅ GOOD: Meldeversäumnis found, but check for § 32 SGB II');
          } else {
            console.log('\n❌ ISSUE: No specific legal reference found');
          }
          
          server.kill();
        }
        
      } catch (e) {
        // Ignore parsing errors
      }
    }
  }
});

server.stderr.on('data', (data) => {
  const msg = data.toString();
  if (msg.includes('German Legal MCP server running')) {
    console.log('✅ Server started');
  }
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('\n⏰ Test timeout');
  server.kill();
}, 10000);