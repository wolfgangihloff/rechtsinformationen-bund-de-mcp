#!/usr/bin/env node

/**
 * Get detailed information about the SGB X document found in our searches
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

async function getDocumentDetails() {
  console.log('📄 Getting Detailed Information about SGB X Document');
  console.log('=' .repeat(60));

  // The URL we found from our previous searches
  const sgbXUrl = 'https://testphase.rechtsinformationen.bund.de/norms/eli/bund/bgbl-1/1980/s1469/2024-07-19/3/deu/regelungstext-1';
  
  // Try to get detailed information about this document
  const tests = [
    {
      name: 'Get SGB X document details (current version)',
      tool: 'dokument_details_abrufen',
      args: { documentId: sgbXUrl, format: 'json' }
    },
    {
      name: 'Search for ELI specifically',
      tool: 'gesetz_per_eli_abrufen',
      args: { eli: 'eli/bund/bgbl-1/1980/s1469/2024-07-19/3/deu/regelungstext-1' }
    },
    {
      name: 'Search for any SGB X versions',
      tool: 'deutsche_gesetze_suchen',
      args: { searchTerm: 'eli/bund/bgbl-1/1980/s1469', limit: 20 }
    }
  ];

  for (const test of tests) {
    console.log(`\n📋 ${test.name}`);
    console.log('-'.repeat(50));
    
    try {
      const result = await runMCPTest(test.tool, test.args);
      
      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
      } else if (result.result && result.result.content) {
        const content = result.result.content[0].text;
        
        // Look for specific information about changes
        const paragraph44Content = content.match(/§\s*44[^§]*/gi);
        const versionInfo = content.match(/2024-07-19|2021-01-01|2020/gi);
        const changeInfo = content.match(/Änderung|geändert|novelliert|überarbeitet/gi);
        
        console.log(`✅ Document retrieved successfully`);
        
        if (versionInfo) {
          console.log(`📅 Version/Date information: ${versionInfo.join(', ')}`);
        }
        
        if (changeInfo) {
          console.log(`🔄 Change indicators: ${changeInfo.join(', ')}`);
        }
        
        if (paragraph44Content) {
          console.log(`\n📜 § 44 Content Preview:`);
          paragraph44Content.slice(0, 2).forEach(content => {
            console.log(`   ${content.substring(0, 200)}...`);
          });
        }
        
        // Look for specific change information
        const lines = content.split('\n');
        const relevantLines = lines.filter(line => 
          line.includes('2024-07-19') ||
          line.includes('2021-01-01') ||
          line.includes('2020') ||
          line.includes('Änderung') ||
          line.includes('§ 44')
        );
        
        if (relevantLines.length > 0) {
          console.log(`\n🔍 Relevant information found:`);
          relevantLines.slice(0, 10).forEach(line => {
            console.log(`   ${line.trim()}`);
          });
        }
        
      } else {
        console.log(`❓ Unexpected response format`);
      }
    } catch (error) {
      console.log(`❌ Test failed:`, error.error || error.message || 'Unknown error');
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 DOCUMENT ANALYSIS SUMMARY');
  console.log('='.repeat(60));
  console.log(`
The key findings from our document analysis:

1. The current SGB X version appears to be from 2024-07-19
2. This suggests the document may have been updated after the 2020 changes
3. We need to look for historical versions or change logs to find the 2020 modifications

Recommendations for finding the 2020 changes:
- Look for historical versions of the ELI identifier
- Search for legislative amendments or change documents
- Check for "Artikelgesetz" or "Änderungsgesetz" that modified SGB X
- Search for BGBl (Bundesgesetzblatt) entries from 2020 mentioning SGB X
`);
}

// Run the document analysis
getDocumentDetails().catch(console.error);