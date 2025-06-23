#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';

async function testMCPServer() {
  console.log('🧪 Testing MCP Server Directly');
  console.log('=' .repeat(50));

  // Start the MCP server
  const server = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  const readline = createInterface({
    input: server.stdout,
    output: process.stdout,
    terminal: false
  });

  // Test: List available tools
  console.log('\n📋 Testing: List Tools');
  const listToolsRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  };

  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');

  // Wait for response
  await new Promise(resolve => {
    readline.once('line', (line) => {
      try {
        const response = JSON.parse(line);
        console.log('✅ Available tools:', response.result?.tools?.map(t => t.name) || []);
        resolve();
      } catch (e) {
        console.log('📄 Response:', line);
        resolve();
      }
    });
  });

  // Test: Search for German legal documents
  console.log('\n🔍 Testing: Search for Meldeversäumnis');
  const searchRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "alle_rechtsdokumente_suchen",
      arguments: {
        searchTerm: "Meldeversäumnis SGB II",
        limit: 3
      }
    }
  };

  server.stdin.write(JSON.stringify(searchRequest) + '\n');

  // Wait for response
  await new Promise(resolve => {
    readline.once('line', (line) => {
      try {
        const response = JSON.parse(line);
        const content = response.result?.content?.[0]?.text || 'No content';
        console.log('✅ Search results preview:', content.substring(0, 200) + '...');
        
        // Check for URLs in the response
        const urls = content.match(/https:\/\/testphase\.rechtsinformationen\.bund\.de[^\s]*/g);
        if (urls) {
          console.log('🔗 Found URLs:', urls.slice(0, 3));
        }
        resolve();
      } catch (e) {
        console.log('📄 Response:', line.substring(0, 300) + '...');
        resolve();
      }
    });
  });

  // Test: Document details
  console.log('\n📄 Testing: Document Details with URL');
  const detailsRequest = {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "dokument_details_abrufen",
      arguments: {
        documentId: "https://testphase.rechtsinformationen.bund.de/case-law/KSRE176501505"
      }
    }
  };

  server.stdin.write(JSON.stringify(detailsRequest) + '\n');

  // Wait for response
  await new Promise(resolve => {
    readline.once('line', (line) => {
      try {
        const response = JSON.parse(line);
        if (response.error) {
          console.log('❌ Error:', response.error.message);
        } else {
          console.log('✅ Document details retrieved successfully');
        }
        resolve();
      } catch (e) {
        console.log('📄 Response:', line.substring(0, 200) + '...');
        resolve();
      }
    });
  });

  // Close the server
  server.kill();
  console.log('\n✅ Testing completed!');
}

testMCPServer().catch(console.error);