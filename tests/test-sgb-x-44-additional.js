#!/usr/bin/env node

/**
 * Additional focused searches for § 44 SGB X changes
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

async function testAdditionalSearches() {
  console.log('🔍 Additional Focused Searches for § 44 SGB X Changes');
  console.log('=' .repeat(60));

  const additionalTests = [
    {
      name: '8. Search for "SGB-IV-Änderungsgesetz" (without number)',
      tool: 'deutsche_gesetze_suchen',
      args: { searchTerm: 'SGB-IV-Änderungsgesetz', limit: 15 }
    },
    {
      name: '9. Search for legislation with "2021-01-01" effective date',
      tool: 'deutsche_gesetze_suchen',
      args: { 
        searchTerm: '2021-01-01',
        temporalCoverageFrom: '2020-01-01',
        temporalCoverageTo: '2021-12-31',
        limit: 20 
      }
    },
    {
      name: '10. Search for "Rücknahme" and "2020" (focusing on the legal concept)',
      tool: 'deutsche_gesetze_suchen',
      args: { 
        searchTerm: 'Rücknahme 2020',
        temporalCoverageFrom: '2020-01-01',
        limit: 15 
      }
    },
    {
      name: '11. All documents search for "2021-01-01"',
      tool: 'alle_rechtsdokumente_suchen',
      args: { 
        searchTerm: '2021-01-01',
        documentKind: 'legislation',
        dateFrom: '2020-01-01',
        dateTo: '2021-12-31',
        limit: 20 
      }
    },
    {
      name: '12. Search for "Inkrafttreten" + "2021"',
      tool: 'deutsche_gesetze_suchen',
      args: { 
        searchTerm: 'Inkrafttreten 2021',
        temporalCoverageFrom: '2020-01-01',
        limit: 15
      }
    }
  ];

  for (const testCase of additionalTests) {
    console.log(`\n📋 ${testCase.name}`);
    console.log('-'.repeat(50));
    
    try {
      const result = await runMCPTest(testCase.tool, testCase.args);
      
      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
      } else if (result.result && result.result.content) {
        const content = result.result.content[0].text;
        
        // Extract key statistics
        const foundCount = content.match(/Found (\d+)/);
        const paragraph44Refs = content.match(/§\s*44\s*SGB\s*X/gi);
        const dates2020_2021 = content.match(/202[01]/g);
        const sgbIVRefs = content.match(/SGB[\s-]*IV[\s-]*Änderungsgesetz/gi);
        const effectiveDateRefs = content.match(/2021-01-01|1\.\s*Januar\s*2021/gi);
        
        console.log(`✅ Results Summary:`);
        console.log(`📊 Documents found: ${foundCount ? foundCount[1] : 'Unknown'}`);
        if (paragraph44Refs) console.log(`🎯 § 44 SGB X references: ${paragraph44Refs.length}`);
        if (dates2020_2021) console.log(`📅 2020/2021 mentions: ${dates2020_2021.length}`);
        if (sgbIVRefs) console.log(`📜 SGB-IV-Änderungsgesetz mentions: ${sgbIVRefs.length}`);
        if (effectiveDateRefs) console.log(`🗓️ 2021-01-01 effective date mentions: ${effectiveDateRefs.length}`);
        
        // Show first few results for key matches
        if (sgbIVRefs || effectiveDateRefs || (paragraph44Refs && paragraph44Refs.length > 0)) {
          console.log('\n🔍 Key findings (first 10 lines):');
          const lines = content.split('\n');
          const importantLines = lines.filter(line => 
            line.includes('OFFICIAL LAW') || 
            line.includes('Law Type') ||
            line.includes('Date:') ||
            line.includes('SGB-IV') ||
            line.includes('2021-01-01') ||
            line.includes('§ 44')
          ).slice(0, 10);
          console.log(importantLines.join('\n'));
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
}

// Run the additional tests
testAdditionalSearches().catch(console.error);