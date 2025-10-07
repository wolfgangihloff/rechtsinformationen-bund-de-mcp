#!/usr/bin/env node
/**
 * Simple Agentic Evaluation Script
 *
 * Analyzes LibreChat conversation exports to evaluate agent performance
 *
 * Usage:
 *   node tests/eval-simple.js tests/recursion_limit.json
 *   node tests/eval-simple.js tests/*.json
 */

const fs = require('fs');
const path = require('path');

class SimpleAgentEvaluator {
  constructor() {
    this.results = [];
  }

  analyzeConversation(filePath) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 Analyzing: ${path.basename(filePath)}`);
    console.log(`${'='.repeat(80)}\n`);

    const conversation = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Extract user query
    const userMessage = conversation.messages.find(m => m.isCreatedByUser);
    if (!userMessage) {
      console.log('❌ No user message found');
      return null;
    }

    const query = userMessage.text;
    console.log(`🔍 Query: "${query}"\n`);

    // Extract agent response
    const agentMessage = conversation.messages.find(m => !m.isCreatedByUser);
    if (!agentMessage) {
      console.log('❌ No agent response found');
      return null;
    }

    // Analyze tool calls
    const toolCalls = this.extractToolCalls(agentMessage);
    const errors = this.extractErrors(agentMessage);
    const answerText = this.extractAnswerText(agentMessage);

    console.log(`📞 Tool Calls Analysis:\n`);
    console.log(`   Total calls: ${toolCalls.length}`);

    const successful = toolCalls.filter(t => t.success);
    const failed = toolCalls.filter(t => !t.success);
    const schemaErrors = failed.filter(t => t.error?.includes('schema'));
    const noResults = toolCalls.filter(t => t.output?.includes('No documents found'));
    const hasResults = toolCalls.filter(t => t.output?.includes('Found') && !t.output?.includes('No documents'));

    console.log(`   Successful: ${successful.length}`);
    console.log(`   Failed: ${failed.length}`);
    console.log(`   Schema errors: ${schemaErrors.length}`);
    console.log(`   No results: ${noResults.length}`);
    console.log(`   Has results: ${hasResults.length}\n`);

    // Tool call breakdown
    console.log(`📊 Tool Call Breakdown:\n`);
    toolCalls.forEach((call, idx) => {
      const emoji = call.success ? '✅' : '❌';
      const resultSummary = call.hasResults ? '(Found results)' :
                           call.noResults ? '(No results)' :
                           call.error ? `(Error: ${call.error.substring(0, 50)}...)` : '';

      console.log(`   ${idx + 1}. ${emoji} ${call.toolName} ${resultSummary}`);
    });

    // Check for recursion limit
    const hitRecursionLimit = errors.some(e => e.includes('Recursion limit'));
    if (hitRecursionLimit) {
      console.log(`\n⚠️  RECURSION LIMIT HIT at call #${toolCalls.length}`);
    }

    // Check for answer generation
    const hasAnswer = answerText && answerText.length > 50;
    console.log(`\n📝 Answer Generated: ${hasAnswer ? '✅ Yes' : '❌ No'}`);
    if (hasAnswer) {
      console.log(`   Length: ${answerText.length} chars`);
    }

    // Check for citations
    const hasCitations = answerText?.includes('Quellen:') || answerText?.includes('Sources:');
    const hasURLs = answerText?.match(/https:\/\/testphase\.rechtsinformationen\.bund\.de/g);
    console.log(`📚 Citations: ${hasCitations ? '✅ Yes' : '❌ No'}`);
    if (hasURLs) {
      console.log(`   URLs found: ${hasURLs.length}`);
    }

    // Calculate efficiency score
    const score = this.calculateScore({
      toolCallCount: toolCalls.length,
      successfulCalls: successful.length,
      hasResults: hasResults.length > 0,
      hasAnswer,
      hasCitations,
      hitRecursionLimit,
      schemaErrors: schemaErrors.length
    });

    console.log(`\n🎯 Overall Score: ${score.total}/100`);
    console.log(`   Tool Efficiency: ${score.toolEfficiency}/30`);
    console.log(`   Result Quality: ${score.resultQuality}/30`);
    console.log(`   Answer Quality: ${score.answerQuality}/25`);
    console.log(`   Citation Quality: ${score.citationQuality}/15`);

    // Recommendations
    console.log(`\n💡 Recommendations:\n`);
    const recommendations = this.generateRecommendations({
      toolCallCount: toolCalls.length,
      hasResults: hasResults.length > 0,
      hasAnswer,
      hasCitations,
      hitRecursionLimit,
      schemaErrors: schemaErrors.length,
      noResults: noResults.length
    });
    recommendations.forEach(rec => console.log(`   • ${rec}`));

    const result = {
      file: path.basename(filePath),
      query,
      toolCallCount: toolCalls.length,
      successful: successful.length,
      failed: failed.length,
      hasResults: hasResults.length > 0,
      hasAnswer,
      hasCitations,
      hitRecursionLimit,
      score: score.total,
      toolCalls: toolCalls.map(t => ({ tool: t.toolName, success: t.success }))
    };

    this.results.push(result);
    return result;
  }

  extractToolCalls(message) {
    const toolCalls = [];

    if (!message.children || message.children.length === 0) return toolCalls;

    const agentResponse = message.children[0];
    if (!agentResponse.content) return toolCalls;

    for (const item of agentResponse.content) {
      if (item.type === 'tool_call' && item.tool_call) {
        const tool = item.tool_call;
        const toolName = tool.name.replace('_mcp_rechtsinformationen-bund-de', '');

        const success = !tool.output?.includes('Error') &&
                       !tool.output?.includes('schema') &&
                       tool.output?.length > 0;

        const hasResults = tool.output?.includes('✅ Found') &&
                          !tool.output?.includes('No documents found');

        const noResults = tool.output?.includes('❌ No documents found');

        const error = tool.output?.includes('Error') ?
                     tool.output.substring(0, 100) : null;

        toolCalls.push({
          id: tool.id,
          toolName,
          args: tool.args,
          output: tool.output,
          success,
          hasResults,
          noResults,
          error
        });
      }
    }

    return toolCalls;
  }

  extractErrors(message) {
    const errors = [];

    if (!message.children || message.children.length === 0) return errors;

    const agentResponse = message.children[0];
    if (!agentResponse.content) return errors;

    for (const item of agentResponse.content) {
      if (item.type === 'error' && item.error) {
        errors.push(item.error);
      }
    }

    return errors;
  }

  extractAnswerText(message) {
    if (!message.children || message.children.length === 0) return '';

    const agentResponse = message.children[0];
    if (!agentResponse.content) return '';

    const textParts = agentResponse.content
      .filter(item => item.type === 'text' && item.text && item.text.trim())
      .map(item => item.text.trim())
      .filter(text => !text.match(/^call_[a-f0-9]+$/)); // Filter out tool call IDs

    return textParts.join('\n').trim();
  }

  calculateScore(metrics) {
    const score = {
      toolEfficiency: 0,
      resultQuality: 0,
      answerQuality: 0,
      citationQuality: 0,
      total: 0
    };

    // Tool Efficiency (30 points)
    if (metrics.toolCallCount <= 2) score.toolEfficiency = 30;
    else if (metrics.toolCallCount <= 3) score.toolEfficiency = 25;
    else if (metrics.toolCallCount <= 5) score.toolEfficiency = 20;
    else if (metrics.toolCallCount <= 8) score.toolEfficiency = 10;
    else score.toolEfficiency = 5;

    // Penalty for recursion limit
    if (metrics.hitRecursionLimit) score.toolEfficiency -= 15;

    // Penalty for schema errors
    score.toolEfficiency -= Math.min(metrics.schemaErrors * 3, 15);

    score.toolEfficiency = Math.max(0, score.toolEfficiency);

    // Result Quality (30 points)
    if (metrics.hasResults) {
      score.resultQuality = 30;
    } else if (metrics.successfulCalls > 0) {
      score.resultQuality = 10;
    }

    // Answer Quality (25 points)
    if (metrics.hasAnswer) {
      score.answerQuality = 25;
    } else if (!metrics.hitRecursionLimit) {
      score.answerQuality = 5; // Agent tried but failed
    }

    // Citation Quality (15 points)
    if (metrics.hasCitations) {
      score.citationQuality = 15;
    }

    score.total = score.toolEfficiency + score.resultQuality +
                  score.answerQuality + score.citationQuality;

    return score;
  }

  generateRecommendations(metrics) {
    const recommendations = [];

    if (metrics.toolCallCount > 5) {
      recommendations.push(`Reduce recursionLimit to 5 or lower (currently used ${metrics.toolCallCount} calls)`);
      recommendations.push('Add stronger STOP instructions in agent config');
    }

    if (metrics.schemaErrors > 0) {
      recommendations.push('Schema errors detected - type coercion should be working, check MCP server build');
    }

    if (metrics.hasResults && !metrics.hasAnswer) {
      recommendations.push('Agent found results but didn\'t generate answer - add instruction: "Generate answer immediately after finding results"');
    }

    if (metrics.hitRecursionLimit) {
      recommendations.push('❌ CRITICAL: Recursion limit hit - set recursionLimit: 5 in agent config');
      recommendations.push('Add instruction: "STOP after 2-3 tool calls and synthesize from available information"');
    }

    if (metrics.hasAnswer && !metrics.hasCitations) {
      recommendations.push('Missing citations - emphasize "MUST include ALL URLs in Quellen: section"');
    }

    if (metrics.noResults > 3) {
      recommendations.push('Multiple failed searches - agent needs better query refinement strategy');
      recommendations.push('Consider training agent to use law abbreviations (BEEG, BGB, etc.)');
    }

    if (!metrics.hasResults) {
      recommendations.push('No results found - check if query is answerable with rechtsinformationen.bund.de');
      recommendations.push('Agent should try multiple query variations: full name, abbreviation, § reference');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Performance looks good! Agent is working efficiently.');
    }

    return recommendations;
  }

  generateSummaryReport() {
    if (this.results.length === 0) {
      console.log('\n❌ No results to summarize\n');
      return;
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 SUMMARY REPORT - ${this.results.length} Conversations Analyzed`);
    console.log(`${'='.repeat(80)}\n`);

    const avgToolCalls = this.results.reduce((sum, r) => sum + r.toolCallCount, 0) / this.results.length;
    const avgScore = this.results.reduce((sum, r) => sum + r.score, 0) / this.results.length;
    const successRate = this.results.filter(r => r.hasAnswer).length / this.results.length;
    const citationRate = this.results.filter(r => r.hasCitations).length / this.results.length;
    const recursionHits = this.results.filter(r => r.hitRecursionLimit).length;

    console.log(`📈 Key Metrics:\n`);
    console.log(`   Average Tool Calls: ${avgToolCalls.toFixed(1)}`);
    console.log(`   Average Score: ${avgScore.toFixed(1)}/100`);
    console.log(`   Answer Success Rate: ${(successRate * 100).toFixed(1)}%`);
    console.log(`   Citation Rate: ${(citationRate * 100).toFixed(1)}%`);
    console.log(`   Recursion Limit Hits: ${recursionHits}/${this.results.length}\n`);

    console.log(`🎯 Score Distribution:\n`);
    const scoreRanges = {
      'Excellent (90-100)': this.results.filter(r => r.score >= 90).length,
      'Good (70-89)': this.results.filter(r => r.score >= 70 && r.score < 90).length,
      'Fair (50-69)': this.results.filter(r => r.score >= 50 && r.score < 70).length,
      'Poor (0-49)': this.results.filter(r => r.score < 50).length
    };

    Object.entries(scoreRanges).forEach(([range, count]) => {
      const percentage = (count / this.results.length * 100).toFixed(1);
      console.log(`   ${range}: ${count} (${percentage}%)`);
    });

    console.log(`\n⚡ Tool Efficiency:\n`);
    console.log(`   1-2 calls: ${this.results.filter(r => r.toolCallCount <= 2).length}`);
    console.log(`   3-5 calls: ${this.results.filter(r => r.toolCallCount >= 3 && r.toolCallCount <= 5).length}`);
    console.log(`   6-10 calls: ${this.results.filter(r => r.toolCallCount >= 6 && r.toolCallCount <= 10).length}`);
    console.log(`   >10 calls: ${this.results.filter(r => r.toolCallCount > 10).length}\n`);

    // Overall recommendations
    console.log(`💡 Overall Recommendations:\n`);
    if (avgToolCalls > 5) {
      console.log(`   ⚠️  Average tool calls too high (${avgToolCalls.toFixed(1)}) - reduce recursionLimit to 5`);
    }
    if (recursionHits > 0) {
      console.log(`   ❌ ${recursionHits} conversation(s) hit recursion limit - CRITICAL config issue`);
    }
    if (citationRate < 0.5) {
      console.log(`   📚 Citation rate low (${(citationRate * 100).toFixed(1)}%) - strengthen citation instructions`);
    }
    if (successRate < 0.7) {
      console.log(`   📝 Answer success rate low (${(successRate * 100).toFixed(1)}%) - improve agent stopping strategy`);
    }
    if (avgScore >= 80 && recursionHits === 0 && avgToolCalls <= 4) {
      console.log(`   ✅ Excellent performance! Agent is working well.`);
    }

    return {
      avgToolCalls,
      avgScore,
      successRate,
      citationRate,
      recursionHits,
      results: this.results
    };
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage:
  node tests/eval-simple.js <conversation-file.json> [file2.json ...]

Examples:
  node tests/eval-simple.js tests/recursion_limit.json
  node tests/eval-simple.js tests/Elternzeit*.json
  node tests/eval-simple.js tests/New_Chat.json tests/recursion_limit.json

The script analyzes LibreChat conversation exports and evaluates agent performance.
`);
    process.exit(1);
  }

  const evaluator = new SimpleAgentEvaluator();

  // Process all files
  for (const filePath of args) {
    if (!fs.existsSync(filePath)) {
      console.log(`\n❌ File not found: ${filePath}\n`);
      continue;
    }

    try {
      evaluator.analyzeConversation(filePath);
    } catch (error) {
      console.error(`\n❌ Error analyzing ${filePath}:`, error.message, '\n');
    }
  }

  // Generate summary if multiple files
  if (args.length > 1) {
    const summary = evaluator.generateSummaryReport();

    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const outputPath = `tests/eval-results-${timestamp}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    console.log(`\n💾 Results saved to: ${outputPath}\n`);
  }
}

main();
