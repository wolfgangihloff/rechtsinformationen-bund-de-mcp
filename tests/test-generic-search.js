#!/usr/bin/env node

/**
 * Direct MCP Tool Testing Suite
 *
 * Tests MCP tools directly without AI agent involvement.
 * Validates tool accuracy, URL formatting, and abbreviation matching.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class MCPClient {
  constructor() {
    this.process = null;
    this.requestId = 1;
    this.responseHandlers = new Map();
    this.buffer = '';
  }

  async start() {
    return new Promise((resolve, reject) => {
      const serverPath = path.join(__dirname, '..', 'dist', 'index.js');

      console.log(`${colors.cyan}🚀 Starting MCP server: ${serverPath}${colors.reset}`);

      this.process = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout.on('data', (data) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.process.stderr.on('data', (data) => {
        console.error(`${colors.red}Server stderr: ${data.toString()}${colors.reset}`);
      });

      this.process.on('error', (error) => {
        console.error(`${colors.red}Failed to start server: ${error}${colors.reset}`);
        reject(error);
      });

      // Send initialize request
      setTimeout(async () => {
        try {
          await this.sendRequest('initialize', {
            protocolVersion: '0.1.0',
            capabilities: {},
            clientInfo: {
              name: 'test-generic-search',
              version: '1.0.0',
            },
          });

          // Send initialized notification
          await this.sendNotification('notifications/initialized');

          console.log(`${colors.green}✅ MCP server initialized${colors.reset}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      }, 500);
    });
  }

  processBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);

        if (message.id && this.responseHandlers.has(message.id)) {
          const handler = this.responseHandlers.get(message.id);
          this.responseHandlers.delete(message.id);

          if (message.error) {
            handler.reject(new Error(message.error.message || 'Unknown error'));
          } else {
            handler.resolve(message.result);
          }
        }
      } catch (error) {
        // Ignore parse errors for partial messages
      }
    }
  }

  async sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = this.requestId++;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.responseHandlers.set(id, { resolve, reject });

      this.process.stdin.write(JSON.stringify(request) + '\n');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.responseHandlers.has(id)) {
          this.responseHandlers.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  async sendNotification(method, params = {}) {
    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };
    this.process.stdin.write(JSON.stringify(notification) + '\n');
  }

  async callTool(toolName, args) {
    return await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args,
    });
  }

  async stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

// Test suite definition
const testSuite = [
  {
    name: 'GG Abbreviation Lookup',
    tool: 'gesetz_per_abkuerzung_abrufen',
    args: { abbreviation: 'GG' },
    validate: (result) => {
      const text = result.content[0].text;
      const checks = {
        'Contains "Grundgesetz"': text.includes('Grundgesetz'),
        'Abbreviation matches GG': text.includes('GG'),
        'Has markdown link': text.match(/\[.*?\]\(https?:\/\/.*?\)/),
        'NOT wrong law': !text.includes('VersMedV') && !text.includes('SGB'),
      };
      return checks;
    },
  },
  {
    name: 'SGB I Abbreviation Lookup (Bug Validation)',
    tool: 'gesetz_per_abkuerzung_abrufen',
    args: { abbreviation: 'SGB I' },
    validate: (result) => {
      const text = result.content[0].text;
      const checks = {
        'Contains "Sozialgesetzbuch"': text.includes('Sozialgesetzbuch'),
        'Contains "Erstes Buch"': text.includes('Erstes Buch') || text.includes('I'),
        'Abbreviation is SGB I': text.includes('SGB I'),
        'NOT VersMedV': !text.includes('VersMedV'),
        'NOT other SGB books': !text.includes('SGB II') && !text.includes('SGB IX'),
        'Has markdown link': text.match(/\[.*?\]\(https?:\/\/.*?\)/),
      };
      return checks;
    },
  },
  {
    name: 'BGB Abbreviation Lookup',
    tool: 'gesetz_per_abkuerzung_abrufen',
    args: { abbreviation: 'BGB' },
    validate: (result) => {
      const text = result.content[0].text;
      const checks = {
        'Contains "Bürgerliches Gesetzbuch"': text.includes('Bürgerliches Gesetzbuch') || text.includes('BGB'),
        'Abbreviation matches BGB': text.includes('BGB'),
        'Has markdown link': text.match(/\[.*?\]\(https?:\/\/.*?\)/),
        'NOT other laws': !text.includes('SGB') && !text.includes('StGB'),
      };
      return checks;
    },
  },
  {
    name: 'StGB Abbreviation Lookup',
    tool: 'gesetz_per_abkuerzung_abrufen',
    args: { abbreviation: 'StGB' },
    validate: (result) => {
      const text = result.content[0].text;
      const checks = {
        'Contains "Strafgesetzbuch"': text.includes('Strafgesetzbuch') || text.includes('StGB'),
        'Abbreviation matches StGB': text.includes('StGB'),
        'Has markdown link': text.match(/\[.*?\]\(https?:\/\/.*?\)/),
        'NOT other laws': !text.includes('SGB') && !text.includes('BGB'),
      };
      return checks;
    },
  },
  {
    name: 'SGB II Abbreviation Lookup',
    tool: 'gesetz_per_abkuerzung_abrufen',
    args: { abbreviation: 'SGB II' },
    validate: (result) => {
      const text = result.content[0].text;
      const checks = {
        'Contains "Sozialgesetzbuch"': text.includes('Sozialgesetzbuch'),
        'Contains "Zweites Buch" or II': text.includes('Zweites Buch') || text.includes('II'),
        'Abbreviation is SGB II': text.includes('SGB II'),
        'NOT SGB I': !text.includes('SGB I') || text.includes('SGB II'),
        'Has markdown link': text.match(/\[.*?\]\(https?:\/\/.*?\)/),
      };
      return checks;
    },
  },
  {
    name: 'GG Article 1 Search via intelligente_rechtssuche',
    tool: 'intelligente_rechtssuche',
    args: { query: 'Grundgesetz Artikel 1', limit: 10 },
    validate: (result) => {
      const text = result.content[0].text;
      const checks = {
        'Contains "Grundgesetz"': text.includes('Grundgesetz'),
        'Contains "Artikel 1" or "Art. 1"': text.includes('Artikel 1') || text.includes('Art. 1') || text.includes('Art 1'),
        'Has markdown links': (text.match(/\[.*?\]\(https?:\/\/.*?\)/g) || []).length > 0,
        'Multiple results': (text.match(/\[.*?\]\(https?:\/\/.*?\)/g) || []).length >= 1,
      };
      return checks;
    },
  },
  {
    name: 'SGB Collection Search',
    tool: 'deutsche_gesetze_suchen',
    args: { searchTerm: 'Sozialgesetzbuch', limit: 20 },
    validate: (result) => {
      const text = result.content[0].text;
      const links = text.match(/\[.*?\]\(https?:\/\/.*?\)/g) || [];
      const checks = {
        'Contains "Sozialgesetzbuch"': text.includes('Sozialgesetzbuch'),
        'Has multiple markdown links': links.length >= 5,
        'Links have document names': links.some(link => link.includes('Sozialgesetzbuch')),
        'NOT just API URLs': !text.includes('/v1/legislation/eli/') || text.includes('['),
      };
      return checks;
    },
  },
  {
    name: '§ 242 StGB Paragraph Search',
    tool: 'intelligente_rechtssuche',
    args: { query: '§ 242 StGB Diebstahl', limit: 10 },
    validate: (result) => {
      const text = result.content[0].text;
      const checks = {
        'Contains "StGB"': text.includes('StGB'),
        'Contains "242" or "§ 242"': text.includes('242') || text.includes('§ 242'),
        'Has markdown links': text.match(/\[.*?\]\(https?:\/\/.*?\)/),
        'Results related to theft': text.toLowerCase().includes('diebstahl') || text.toLowerCase().includes('theft'),
      };
      return checks;
    },
  },
  {
    name: 'URL Format Validation - Legislation',
    tool: 'deutsche_gesetze_suchen',
    args: { searchTerm: 'Bundeselterngeld', limit: 5 },
    validate: (result) => {
      const text = result.content[0].text;
      const markdownLinks = text.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
      const checks = {
        'Has markdown links': markdownLinks.length > 0,
        'Links have descriptive text': markdownLinks.some(link => {
          const match = link.match(/\[([^\]]+)\]/);
          return match && match[1].length > 10; // Link text is meaningful
        }),
        'URLs are not raw API endpoints': !text.includes('[https://testphase.rechtsinformationen.bund.de/v1/'),
        'Footer has "REQUIRED: COPY THESE LINKS"': text.includes('REQUIRED: COPY THESE LINKS') || text.includes('QUELLEN'),
      };
      return checks;
    },
  },
];

async function runTests() {
  console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║     Direct MCP Tool Testing Suite - Generic Search Tests      ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  const client = new MCPClient();

  try {
    await client.start();

    const results = [];
    let totalTests = 0;
    let passedTests = 0;

    for (const test of testSuite) {
      totalTests++;
      console.log(`\n${colors.bright}${colors.blue}📋 Test ${totalTests}: ${test.name}${colors.reset}`);
      console.log(`${colors.cyan}   Tool: ${test.tool}${colors.reset}`);
      console.log(`${colors.cyan}   Args: ${JSON.stringify(test.args)}${colors.reset}`);

      try {
        const result = await client.callTool(test.tool, test.args);

        if (!result || !result.content || !result.content[0]) {
          throw new Error('Invalid response format');
        }

        const validations = test.validate(result);
        const allPassed = Object.values(validations).every(v => v);

        if (allPassed) {
          passedTests++;
          console.log(`${colors.green}   ✅ PASSED${colors.reset}`);
        } else {
          console.log(`${colors.red}   ❌ FAILED${colors.reset}`);
        }

        // Show validation details
        for (const [check, passed] of Object.entries(validations)) {
          const icon = passed ? '✓' : '✗';
          const color = passed ? colors.green : colors.red;
          console.log(`${color}      ${icon} ${check}${colors.reset}`);
        }

        // Show response preview
        const preview = result.content[0].text.substring(0, 200).replace(/\n/g, ' ');
        console.log(`${colors.yellow}   Preview: ${preview}...${colors.reset}`);

        results.push({
          test: test.name,
          tool: test.tool,
          passed: allPassed,
          validations,
        });

      } catch (error) {
        console.log(`${colors.red}   ❌ ERROR: ${error.message}${colors.reset}`);
        results.push({
          test: test.name,
          tool: test.tool,
          passed: false,
          error: error.message,
        });
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log(`\n${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}📊 TEST SUMMARY${colors.reset}`);
    console.log(`${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
    console.log(`${colors.red}Failed: ${totalTests - passedTests}${colors.reset}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    // Detailed results
    console.log(`\n${colors.bright}📋 DETAILED RESULTS:${colors.reset}\n`);

    const byTool = results.reduce((acc, result) => {
      if (!acc[result.tool]) acc[result.tool] = [];
      acc[result.tool].push(result);
      return acc;
    }, {});

    for (const [tool, toolResults] of Object.entries(byTool)) {
      const passed = toolResults.filter(r => r.passed).length;
      const total = toolResults.length;
      console.log(`\n${colors.bright}🔧 ${tool}: ${passed}/${total} passed${colors.reset}`);

      for (const result of toolResults) {
        const icon = result.passed ? '✅' : '❌';
        console.log(`   ${icon} ${result.test}`);

        if (result.error) {
          console.log(`${colors.red}      Error: ${result.error}${colors.reset}`);
        } else if (!result.passed && result.validations) {
          const failed = Object.entries(result.validations)
            .filter(([_, v]) => !v)
            .map(([k]) => k);
          console.log(`${colors.yellow}      Failed checks: ${failed.join(', ')}${colors.reset}`);
        }
      }
    }

    console.log(`\n${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}\n`);

    // Exit with appropriate code
    process.exit(passedTests === totalTests ? 0 : 1);

  } catch (error) {
    console.error(`${colors.red}Fatal error: ${error}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.stop();
  }
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Unhandled error: ${error}${colors.reset}`);
  console.error(error.stack);
  process.exit(1);
});
