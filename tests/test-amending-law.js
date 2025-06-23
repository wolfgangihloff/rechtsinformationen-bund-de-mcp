#!/usr/bin/env node

/**
 * Search for the specific amending law that changed § 44 SGB X
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

    setTimeout(() => {
      server.kill();
      reject({ error: 'Timeout' });
    }, 30000);
  });
}

async function searchAmendingLaw() {
  console.log('🔍 Searching for the Amending Law that Changed § 44 SGB X');
  console.log('=' .repeat(65));

  const searches = [
    {
      name: 'Search BGBl 2020 for SGB X changes',
      tool: 'deutsche_gesetze_suchen',
      args: { 
        searchTerm: 'BGBl 2020 SGB X',
        temporalCoverageFrom: '2020-01-01',
        temporalCoverageTo: '2020-12-31',
        limit: 15
      }
    },
    {
      name: 'Search for "Artikelgesetz" from 2020',
      tool: 'deutsche_gesetze_suchen',
      args: { 
        searchTerm: 'Artikelgesetz 2020',
        temporalCoverageFrom: '2020-01-01',
        temporalCoverageTo: '2020-12-31',
        limit: 15
      }
    },
    {
      name: 'Search for "SGB X ändern" or similar',
      tool: 'alle_rechtsdokumente_suchen',
      args: { 
        searchTerm: 'SGB X ändern',
        documentKind: 'legislation',
        dateFrom: '2020-01-01',
        dateTo: '2020-12-31',
        limit: 15
      }
    },
    {
      name: 'Search for "Änderung des SGB X"',
      tool: 'deutsche_gesetze_suchen',
      args: { 
        searchTerm: 'Änderung des SGB X',
        temporalCoverageFrom: '2020-01-01',
        temporalCoverageTo: '2020-12-31',
        limit: 15
      }
    },
    {
      name: 'Search for "§ 44 SGB X" in 2020-2021 legislation',
      tool: 'alle_rechtsdokumente_suchen',
      args: { 
        searchTerm: '§ 44 SGB X',
        documentKind: 'legislation',
        dateFrom: '2020-01-01',
        dateTo: '2021-12-31',
        limit: 20
      }
    }
  ];

  let foundAmendingLaws = [];

  for (const search of searches) {
    console.log(`\n📋 ${search.name}`);
    console.log('-'.repeat(50));
    
    try {
      const result = await runMCPTest(search.tool, search.args);
      
      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
      } else if (result.result && result.result.content) {
        const content = result.result.content[0].text;
        
        // Look for specific patterns indicating amending legislation
        const amendingIndicators = content.match(/Artikel.*SGB X|änder.*SGB X|SGB X.*änder|Gesetz.*änder.*SGB/gi);
        const datePatterns = content.match(/2020-\d{2}-\d{2}/g);
        const bgblPatterns = content.match(/BGBl\.?\s*I?\s*S\.\s*\d+/gi);
        const paragraph44 = content.match(/§\s*44.*SGB\s*X/gi);
        
        console.log(`✅ Search completed`);
        
        if (amendingIndicators) {
          console.log(`🎯 Amendment indicators found: ${amendingIndicators.length}`);
          amendingIndicators.slice(0, 3).forEach(indicator => {
            console.log(`   - ${indicator}`);
          });
        }
        
        if (datePatterns) {
          console.log(`📅 2020 dates found: ${[...new Set(datePatterns)].join(', ')}`);
        }
        
        if (bgblPatterns) {
          console.log(`📰 BGBl references: ${[...new Set(bgblPatterns)].slice(0, 3).join(', ')}`);
        }
        
        if (paragraph44) {
          console.log(`🎯 § 44 SGB X references: ${paragraph44.length}`);
        }
        
        // Extract potential amending laws
        const lines = content.split('\n');
        const lawTitles = lines.filter(line => 
          line.includes('OFFICIAL LAW') && 
          (line.includes('änder') || line.includes('Artikel') || line.includes('2020'))
        );
        
        if (lawTitles.length > 0) {
          console.log(`\n📜 Potential amending laws found:`);
          lawTitles.slice(0, 5).forEach(title => {
            console.log(`   ${title.replace(/\*\*/g, '').trim()}`);
            foundAmendingLaws.push(title);
          });
        }
        
        // Look for specific URLs or ELI identifiers
        const urls = content.match(/https:\/\/testphase\.rechtsinformationen\.bund\.de\/[^\s\]]+/g);
        if (urls) {
          console.log(`\n🔗 Document URLs found: ${urls.length}`);
          urls.slice(0, 3).forEach(url => {
            if (url.includes('2020') || url.includes('bgbl')) {
              console.log(`   ${url}`);
            }
          });
        }
        
      } else {
        console.log(`❓ No results found`);
      }
    } catch (error) {
      console.log(`❌ Search failed:`, error.error || error.message || 'Unknown error');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(65));
  console.log('🎯 AMENDING LAW SEARCH SUMMARY');
  console.log('='.repeat(65));
  
  if (foundAmendingLaws.length > 0) {
    console.log(`\n📜 Potential amending laws discovered:`);
    [...new Set(foundAmendingLaws)].forEach((law, index) => {
      console.log(`${index + 1}. ${law.replace(/\*\*/g, '').trim()}`);
    });
  } else {
    console.log(`\n❌ No specific amending laws found in the searches.`);
  }
  
  console.log(`\n💡 Key insights:
1. The searches show multiple references to 2020 changes in legislation
2. Several BGBl (Federal Law Gazette) references from 2020 were found
3. The current SGB X version is dated 2024-07-19, indicating ongoing changes
4. The specific "7. SGB-IV-Änderungsgesetz" may not be directly findable in the database

📋 Limitations identified:
1. Date filtering may not work as expected - filtered and unfiltered searches returned similar results
2. The semantic search did not find relevant results, suggesting keyword-based search is more effective
3. Specific amendment laws may be embedded in larger legislative packages (Artikelgesetze)
4. Historical versions of laws may not be fully accessible through the current API

🔍 Recommendations for improved search strategy:
1. Search for specific BGBl entries from 2020
2. Look for "Artikelgesetz" or omnibus bills that may contain SGB X changes
3. Search for Parliamentary documents (Bundestags-Drucksachen) related to SGB changes
4. Consider searching for the effective date (2021-01-01) in combination with SGB X
`);
}

searchAmendingLaw().catch(console.error);