#!/usr/bin/env node

/**
 * E2E Tests with Mock Agent
 *
 * End-to-end testing of the MCP server using a mock AI agent that simulates
 * real agent behavior following the agent instructions.
 *
 * Run with: npm run test:e2e
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MockMCPClient } from './helpers/MockMCPClient.js';
import { MockAgent } from './helpers/MockAgent.js';
import { assertScenario } from './helpers/assertions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test scenarios
const scenariosPath = path.join(__dirname, 'fixtures', 'e2e-scenarios.json');
const scenariosData = JSON.parse(fs.readFileSync(scenariosPath, 'utf-8'));
const scenarios = scenariosData.scenarios;

describe('E2E Tests with Mock Agent', () => {
  let client;
  let agent;

  beforeAll(async () => {
    // Start MCP server
    client = new MockMCPClient();
    await client.start();

    // Create mock agent with conservative settings
    agent = new MockAgent(client, {
      maxToolCalls: 5,
      temperature: 0.3, // Conservative
    });
  });

  afterAll(async () => {
    // Stop MCP server
    if (client) {
      await client.stop();
    }
  });

  // Test each scenario
  for (const scenario of scenarios) {
    const testName = `${scenario.id} - ${scenario.query}`;

    test(testName, async () => {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📋 Scenario: ${scenario.id}`);
      console.log(`❓ Query: ${scenario.query}`);
      console.log(`🎯 Difficulty: ${scenario.difficulty}`);
      console.log(`${'='.repeat(80)}\n`);

      // Reset agent for new query
      agent.reset();

      // Process query with mock agent
      const result = await agent.processQuery(scenario.query);

      console.log(`\n📊 Agent Statistics:`);
      console.log(`   Tool calls: ${result.toolCalls.length}`);
      console.log(`   Duration: ${result.duration}ms`);
      console.log(`   Stopped: ${result.stopped}`);
      console.log(`   Tools used: ${[...new Set(result.toolCalls.map(c => c.tool))].join(', ')}`);

      // Run assertions
      const assertions = assertScenario(result, scenario.expected);

      console.log(`\n🧪 Assertion Results:`);
      console.log(`   Passed: ${assertions.passed ? '✅' : '❌'}`);
      console.log(`   Errors: ${assertions.errors.length}`);
      console.log(`   Warnings: ${assertions.warnings.length}`);

      if (assertions.errors.length > 0) {
        console.log(`\n❌ Errors:`);
        assertions.errors.forEach(err => console.log(`   - ${err}`));
      }

      if (assertions.warnings.length > 0) {
        console.log(`\n⚠️ Warnings:`);
        assertions.warnings.forEach(warn => console.log(`   - ${warn}`));
      }

      // Detailed assertion results
      console.log(`\n📋 Detailed Assertions:`);
      console.log(`   Tool sequence: ${assertions.assertions.tool_sequence.passed ? '✅' : '❌'}`);
      console.log(`   Citation quality: ${assertions.assertions.citation_quality.passed ? '✅' : '❌'} (${assertions.assertions.citation_quality.citation_count} citations)`);
      console.log(`   Answer completeness: ${assertions.assertions.answer_completeness.passed ? '✅' : '❌'} (${assertions.assertions.answer_completeness.length} chars)`);
      console.log(`   URL formatting: ${assertions.assertions.url_formatting.passed ? '✅' : '❌'}`);
      console.log(`   Stopping behavior: ${assertions.assertions.stopping_behavior.passed ? '✅' : '❌'}`);

      // Handle scenarios with known limitations
      if (scenario.expected.note) {
        console.log(`\n📝 Note: ${scenario.expected.note}`);

        if (scenario.expected.expected_outcome === 'partial_success_or_no_results') {
          // For known database gaps, we accept either no results or partial results
          // Just warn, don't fail the test
          console.log(`   ⚠️ This scenario tests handling of database limitations`);

          // Check that agent handled gracefully (no errors, stopped properly)
          expect(result.toolCalls.length).toBeLessThanOrEqual(scenario.expected.max_tool_calls);
          expect(assertions.assertions.stopping_behavior.passed).toBe(true);

          return; // Skip other assertions for known limitations
        }
      }

      // Standard assertions for normal scenarios
      expect(assertions.passed).toBe(true);

      // Tool sequence assertions
      expect(assertions.assertions.tool_sequence.passed).toBe(true);

      // Citation quality assertions (if required)
      if (scenario.expected.must_have_citations) {
        expect(assertions.assertions.citation_quality.passed).toBe(true);
        expect(assertions.assertions.citation_quality.citation_count).toBeGreaterThanOrEqual(
          scenario.expected.min_citations || 1
        );
      }

      // Answer completeness assertions
      expect(assertions.assertions.answer_completeness.passed).toBe(true);

      // URL formatting assertions
      expect(assertions.assertions.url_formatting.passed).toBe(true);

      // Stopping behavior assertions
      expect(assertions.assertions.stopping_behavior.passed).toBe(true);
      expect(result.toolCalls.length).toBeLessThanOrEqual(scenario.expected.max_tool_calls);
    }, 60000); // 60 second timeout per test
  }

  // Summary test to report overall statistics
  test('E2E Test Suite Summary', () => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 E2E TEST SUITE SUMMARY`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(`Total scenarios: ${scenarios.length}`);
    console.log(`Categories: ${scenariosData.metadata.category_distribution}`);
    console.log(`Difficulty: ${scenariosData.metadata.difficulty_distribution}`);
    console.log(`\nNotes: ${scenariosData.metadata.notes}`);
    console.log(`\n${'='.repeat(80)}\n`);

    // This test always passes - it's just for reporting
    expect(scenarios.length).toBeGreaterThan(0);
  });
});

describe('Mock Agent Unit Tests', () => {
  let client;
  let agent;

  beforeAll(async () => {
    client = new MockMCPClient();
    await client.start();
    agent = new MockAgent(client);
  });

  afterAll(async () => {
    if (client) {
      await client.stop();
    }
  });

  test('Agent respects max tool calls limit', async () => {
    agent.maxToolCalls = 2;
    const result = await agent.processQuery('Was ist das BGB?');

    expect(result.toolCalls.length).toBeLessThanOrEqual(2);
  });

  test('Agent always starts with intelligente_rechtssuche', async () => {
    const result = await agent.processQuery('Zeige mir das StGB');

    expect(result.toolCalls.length).toBeGreaterThan(0);
    expect(result.toolCalls[0].tool).toBe('intelligente_rechtssuche');
  });

  test('Agent extracts law abbreviations correctly', () => {
    expect(agent.extractLawAbbreviation('Was ist das BGB?')).toBe('BGB');
    expect(agent.extractLawAbbreviation('Zeige mir SGB II')).toBe('SGB II');
    expect(agent.extractLawAbbreviation('Was regelt § 242 StGB?')).toBe('§ 242 StGB');
    expect(agent.extractLawAbbreviation('Tell me about rental law')).toBeNull();
  });

  test('Agent synthesizes response with citations', async () => {
    const result = await agent.processQuery('Was ist das BGB?');

    expect(result.response).toBeTruthy();
    expect(result.response.length).toBeGreaterThan(100);
    expect(result.response).toMatch(/\[.*?\]\(https?:\/\/.*?\)/); // Has markdown links
  });

  test('Agent tracks tool call history', async () => {
    agent.reset();
    const result = await agent.processQuery('Was regelt § 242 StGB?');

    expect(agent.toolCallHistory.length).toBe(result.toolCalls.length);
    expect(agent.toolCallHistory[0]).toHaveProperty('tool');
    expect(agent.toolCallHistory[0]).toHaveProperty('args');
    expect(agent.toolCallHistory[0]).toHaveProperty('result');
    expect(agent.toolCallHistory[0]).toHaveProperty('duration');
  });

  test('Agent provides statistics', async () => {
    agent.reset();
    await agent.processQuery('Welche Rechte habe ich bei Kündigung?');

    const stats = agent.getStats();
    expect(stats).toHaveProperty('total_calls');
    expect(stats).toHaveProperty('tools_used');
    expect(stats).toHaveProperty('total_duration');
    expect(stats).toHaveProperty('average_duration');
    expect(stats.total_calls).toBeGreaterThan(0);
  });
});

describe('MockMCPClient Unit Tests', () => {
  let client;

  beforeAll(async () => {
    client = new MockMCPClient();
    await client.start();
  });

  afterAll(async () => {
    if (client) {
      await client.stop();
    }
  });

  test('Client initializes successfully', () => {
    expect(client.isReady()).toBe(true);
  });

  test('Client can list tools', async () => {
    const toolNames = await client.getToolNames();

    expect(toolNames).toContain('intelligente_rechtssuche');
    expect(toolNames).toContain('deutsche_gesetze_suchen');
    expect(toolNames).toContain('rechtsprechung_suchen');
    expect(toolNames).toContain('dokument_details_abrufen');
    expect(toolNames).toContain('gesetz_per_abkuerzung_abrufen');
    expect(toolNames.length).toBe(5); // After tool cleanup in v1.3.0
  });

  test('Client can get tool definition', async () => {
    const tool = await client.getToolDefinition('intelligente_rechtssuche');

    expect(tool).toHaveProperty('name', 'intelligente_rechtssuche');
    expect(tool).toHaveProperty('description');
    expect(tool).toHaveProperty('inputSchema');
    expect(tool.description).toContain('PRIMARY TOOL');
    expect(tool.description).toContain('ALWAYS USE THIS FIRST');
  });

  test('Client can call a tool', async () => {
    const result = await client.callTool('intelligente_rechtssuche', {
      query: 'BGB',
      limit: 2,
    });

    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0]).toHaveProperty('text');
  });
});
