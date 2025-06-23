#!/usr/bin/env node

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { spawn } from 'child_process';

async function testMCPServer() {
  console.log('🧪 Testing MCP Server with Fixed Tool Names');
  console.log('='.repeat(50));
  
  try {
    // Start the MCP server process
    const serverProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Create transport and client
    const transport = new StdioClientTransport({
      reader: serverProcess.stdout,
      writer: serverProcess.stdin
    });
    
    const client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    // Connect to server
    await client.connect(transport);
    console.log('✅ Connected to MCP server');
    
    // List available tools
    const tools = await client.listTools();
    console.log(`\n📋 Available tools (${tools.tools.length}):`);
    
    tools.tools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}`);
      console.log(`   Description: ${tool.description.substring(0, 100)}...`);
    });
    
    // Test a simple tool call
    console.log('\n🔍 Testing tool call: deutsche_gesetze_suchen');
    
    try {
      const result = await client.callTool('deutsche_gesetze_suchen', {
        searchTerm: 'Grundgesetz',
        limit: 3
      });
      
      console.log('✅ Tool call successful');
      console.log(`Response length: ${result.content[0].text.length} characters`);
      console.log(`First 200 chars: ${result.content[0].text.substring(0, 200)}...`);
      
    } catch (toolError) {
      console.error('❌ Tool call failed:', toolError.message);
    }
    
    // Clean up
    await client.close();
    serverProcess.kill();
    
    console.log('\n✅ MCP server test completed successfully');
    
  } catch (error) {
    console.error('❌ MCP server test failed:', error.message);
    process.exit(1);
  }
}

testMCPServer().catch(console.error);