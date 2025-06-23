#!/usr/bin/env node

/**
 * Test script for § 44 SGB X searches with different approaches
 * Tests both with and without date filtering
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMCPTest(toolName, args) {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
    const server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let error = '';

    server.stdout.on('data', (data) => {
      output += data.toString();
    });

    server.stderr.on('data', (data) => {
      error += data.toString();
    });

    // Send the MCP request
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    server.stdin.write(JSON.stringify(request) + '\n');
    server.stdin.end();

    server.on('close', (code) => {
      if (code === 0 && output) {
        try {
          // Parse the last JSON response
          const lines = output.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const response = JSON.parse(lastLine);
          resolve(response);
        } catch (e) {
          resolve({ error: 'Failed to parse response', output, error });
        }
      } else {
        reject({ code, output, error });
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      server.kill();
      reject({ error: 'Timeout' });
    }, 30000);
  });
}

async function testSGBX44Searches() {
  console.log('🧪 Testing § 44 SGB X Searches with Different Approaches');
  console.log('=' .repeat(80));

  const testCases = [
    {
      name: '1. Search for "§ 44 SGB X" without date filters',
      tool: 'deutsche_gesetze_suchen',
      args: { searchTerm: '§ 44 SGB X', limit: 10 }
    },
    {
      name: '2. Search for "§ 44 SGB X" with date filter from 2020',
      tool: 'deutsche_gesetze_suchen',
      args: { 
        searchTerm: '§ 44 SGB X', 
        temporalCoverageFrom: '2020-01-01',
        limit: 10 
      }
    },
    {
      name: '3. Search for "7. SGB-IV-Änderungsgesetz"',
      tool: 'deutsche_gesetze_suchen',
      args: { searchTerm: '7. SGB-IV-Änderungsgesetz', limit: 10 }
    },
    {
      name: '4. Search for "SGB X Änderung 2020"',
      tool: 'deutsche_gesetze_suchen',
      args: { searchTerm: 'SGB X Änderung 2020', limit: 10 }
    },
    {
      name: '5. Alternative: Search all documents for "§ 44 SGB X"',
      tool: 'alle_rechtsdokumente_suchen',
      args: { 
        searchTerm: '§ 44 SGB X',
        documentKind: 'legislation',
        limit: 10 
      }
    },
    {
      name: '6. Alternative: Search all documents with date filter',
      tool: 'alle_rechtsdokumente_suchen',
      args: { 
        searchTerm: '§ 44 SGB X',
        documentKind: 'legislation',
        dateFrom: '2020-01-01',
        dateTo: '2021-12-31',
        limit: 10 
      }
    },
    {
      name: '7. Semantic search for "§ 44 SGB X Änderung 2020"',
      tool: 'semantische_rechtssuche',
      args: { 
        query: '§ 44 SGB X Änderung 2020 7. SGB-IV-Änderungsgesetz',
        limit: 10 
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 ${testCase.name}`);
    console.log('-'.repeat(50));
    
    try {
      const result = await runMCPTest(testCase.tool, testCase.args);
      
      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
        if (result.output) console.log(`Output: ${result.output.substring(0, 500)}...`);
      } else if (result.result && result.result.content) {
        const content = result.result.content[0].text;
        const lines = content.split('\n');
        const relevantLines = lines.slice(0, 20); // First 20 lines for summary
        
        console.log(`✅ Results found:`);
        console.log(relevantLines.join('\n'));
        
        // Extract key information
        const foundCount = content.match(/Found (\d+)/);
        if (foundCount) {
          console.log(`\n📊 Documents found: ${foundCount[1]}`);
        }
        
        // Look for specific § 44 SGB X references
        const paragraph44Refs = content.match(/§\s*44\s*SGB\s*X/gi);
        if (paragraph44Refs) {
          console.log(`🎯 § 44 SGB X references: ${paragraph44Refs.length}`);
        }
        
        // Look for 2020/2021 dates
        const dates2020_2021 = content.match(/202[01]/g);
        if (dates2020_2021) {
          console.log(`📅 2020/2021 date mentions: ${dates2020_2021.length}`);
        }
      } else {
        console.log(`❓ Unexpected response format:`, JSON.stringify(result, null, 2).substring(0, 500));
      }
    } catch (error) {
      console.log(`❌ Test failed:`, error.error || error.message || error);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎯 ANALYSIS SUMMARY');
  console.log('='.repeat(80));
  console.log(`
Key findings to look for:
1. Does date filtering (2020+) return different results than no date filter?
2. Are we finding the specific 2020 legislation that changed § 44 SGB X?
3. Does the "7. SGB-IV-Änderungsgesetz" search find relevant results?
4. Do semantic searches provide better context for the 2020 changes?
5. Are we getting the actual legal text that became effective January 1, 2021?

Next steps:
- Compare result counts between filtered and unfiltered searches
- Check if any results mention "7. SGB-IV-Änderungsgesetz" or similar
- Look for references to the January 1, 2021 effective date
- Identify any limitations in the current search approach
`);
}

// Run the tests
testSGBX44Searches().catch(console.error);