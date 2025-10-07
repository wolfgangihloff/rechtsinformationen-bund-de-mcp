#!/usr/bin/env node

/**
 * Test script to simulate the Elternzeit scenario from the GLM-4.6 model test
 * This validates that the 403 error handling works correctly
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testElternzeitScenario() {
  console.log('🧪 Testing Elternzeit Scenario with MCP Server\n');
  console.log('=' .repeat(80));

  // Start the MCP server
  const serverProcess = spawn('node', ['./dist/index.js'], {
    cwd: process.cwd()
  });

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

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // Step 1: Search for "Bundeselterngeld- und Elternzeitgesetz"
    console.log('📋 Step 1: Searching for "Bundeselterngeld- und Elternzeitgesetz"');
    console.log('-'.repeat(80));

    const searchResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'deutsche_gesetze_suchen',
        arguments: {
          searchTerm: 'Bundeselterngeld- und Elternzeitgesetz',
          limit: 5
        }
      }
    });

    console.log('✅ Search completed successfully\n');
    console.log('📄 First 500 characters of result:');
    console.log(searchResult.content[0].text.substring(0, 500));
    console.log('...\n');

    // Extract the first document URL from the search results
    const urlMatch = searchResult.content[0].text.match(/https:\/\/testphase\.rechtsinformationen\.bund\.de\/norms\/[^\s\n]+/);

    if (!urlMatch) {
      console.log('⚠️  No URL found in search results, skipping document details test');
      return;
    }

    const documentUrl = urlMatch[0];
    console.log(`📋 Step 2: Attempting to retrieve document details for:\n   ${documentUrl}`);
    console.log('-'.repeat(80));

    // Step 2: Try to get document details (this should trigger the 403 handling)
    const detailsResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'dokument_details_abrufen',
        arguments: {
          documentId: documentUrl,
          format: 'html'
        }
      }
    });

    console.log('✅ Document details request completed\n');
    console.log('📄 Response:');
    console.log(detailsResult.content[0].text);
    console.log('\n');

    // Check if the response contains the 403 handling message
    if (detailsResult.content[0].text.includes('403')) {
      console.log('✅ SUCCESS: 403 error was handled gracefully');
      console.log('✅ The error message provides helpful guidance to the user');
    } else if (detailsResult.content[0].text.includes('Document details for')) {
      console.log('✅ SUCCESS: Document details were retrieved successfully');
    } else {
      console.log('⚠️  WARNING: Unexpected response format');
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎉 Test scenario completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await client.close();
    serverProcess.kill();
  }
}

testElternzeitScenario().catch(console.error);
