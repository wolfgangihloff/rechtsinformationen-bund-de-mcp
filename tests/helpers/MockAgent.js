#!/usr/bin/env node

/**
 * MockAgent - Simulates AI Agent Decision-Making for Testing
 *
 * Implements rule-based tool selection following agent instructions:
 * - ALWAYS use intelligente_rechtssuche first
 * - Use specialized tools for follow-up only
 * - Respect recursion limits (max 5 tool calls)
 * - Stop when answer is complete or max calls reached
 *
 * This is NOT ML-based - it uses heuristics to simulate agent behavior.
 */

export class MockAgent {
  constructor(mcpClient, options = {}) {
    this.client = mcpClient;
    this.maxToolCalls = options.maxToolCalls || 5;
    this.temperature = options.temperature || 0.3; // Lower = more conservative
    this.toolCallHistory = [];
  }

  /**
   * Process a user query and return the complete response with tool calls
   */
  async processQuery(query, options = {}) {
    const startTime = Date.now();
    this.toolCallHistory = [];

    console.log(`\n🤖 MockAgent processing query: "${query}"`);

    try {
      // Phase 1: Primary search
      const primaryResult = await this.runPrimarySearch(query);

      // Phase 2: Decide if follow-up needed
      const needsFollowUp = this.shouldDoFollowUp(primaryResult, query);

      let followUpResults = [];
      if (needsFollowUp && this.toolCallHistory.length < this.maxToolCalls) {
        followUpResults = await this.runFollowUpSearches(query, primaryResult);
      }

      // Phase 3: Synthesize final answer
      const response = this.synthesizeResponse(query, primaryResult, followUpResults);

      const duration = Date.now() - startTime;
      console.log(`✅ MockAgent completed in ${duration}ms with ${this.toolCallHistory.length} tool calls`);

      return {
        query,
        response,
        toolCalls: this.toolCallHistory,
        duration,
        stopped: this.toolCallHistory.length >= this.maxToolCalls ? 'max_calls' : 'complete',
      };
    } catch (error) {
      console.error(`❌ MockAgent error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Phase 1: Always start with intelligente_rechtssuche
   */
  async runPrimarySearch(query) {
    console.log(`   🔍 Phase 1: Primary search with intelligente_rechtssuche`);

    const args = {
      query: this.extractSearchQuery(query),
      limit: 5,
    };

    const result = await this.callTool('intelligente_rechtssuche', args);
    return result;
  }

  /**
   * Decide if follow-up searches are needed
   */
  shouldDoFollowUp(primaryResult, query) {
    // Check if primary search returned results
    if (!primaryResult || !primaryResult.content || !primaryResult.content[0]) {
      console.log(`   ⚠️ No results from primary search - follow-up needed`);
      return true;
    }

    const text = primaryResult.content[0].text;

    // If query asks for specific law by abbreviation, verify we found it
    const abbr = this.extractLawAbbreviation(query);
    if (abbr && !text.includes(abbr)) {
      console.log(`   ⚠️ Looking for ${abbr}, not found - follow-up needed`);
      return true;
    }

    // If very few results, might need follow-up
    const linkCount = (text.match(/\[.*?\]\(https?:\/\/.*?\)/g) || []).length;
    if (linkCount < 2) {
      console.log(`   ⚠️ Only ${linkCount} results - follow-up might help`);
      return this.temperature > 0.5; // Conservative agents skip this
    }

    console.log(`   ✅ Primary search looks good (${linkCount} results) - no follow-up needed`);
    return false;
  }

  /**
   * Phase 2: Run follow-up searches if needed
   */
  async runFollowUpSearches(query, primaryResult) {
    console.log(`   🔍 Phase 2: Follow-up searches`);

    const followUpResults = [];

    // Try abbreviation lookup if query contains one
    const abbr = this.extractLawAbbreviation(query);
    if (abbr && this.toolCallHistory.length < this.maxToolCalls) {
      try {
        const result = await this.callTool('gesetz_per_abkuerzung_abrufen', { abbreviation: abbr });
        followUpResults.push(result);
      } catch (error) {
        console.log(`   ⚠️ Abbreviation lookup failed: ${error.message}`);
      }
    }

    // Try legislation-only search if primary had mixed results
    if (this.shouldSearchLegislation(query, primaryResult) && this.toolCallHistory.length < this.maxToolCalls) {
      try {
        const searchTerm = this.extractSearchQuery(query);
        const result = await this.callTool('deutsche_gesetze_suchen', { searchTerm, limit: 5 });
        followUpResults.push(result);
      } catch (error) {
        console.log(`   ⚠️ Legislation search failed: ${error.message}`);
      }
    }

    return followUpResults;
  }

  /**
   * Call a tool and record it in history
   */
  async callTool(toolName, args) {
    const callNumber = this.toolCallHistory.length + 1;
    console.log(`   📞 Tool call ${callNumber}: ${toolName}(${JSON.stringify(args).substring(0, 80)}...)`);

    if (this.toolCallHistory.length >= this.maxToolCalls) {
      throw new Error(`Max tool calls (${this.maxToolCalls}) reached`);
    }

    const startTime = Date.now();
    const result = await this.client.callTool(toolName, args);
    const duration = Date.now() - startTime;

    this.toolCallHistory.push({
      call_number: callNumber,
      tool: toolName,
      args,
      result,
      duration,
      timestamp: new Date().toISOString(),
    });

    console.log(`   ✅ Tool call ${callNumber} completed in ${duration}ms`);
    return result;
  }

  /**
   * Synthesize final response from all tool results
   */
  synthesizeResponse(query, primaryResult, followUpResults) {
    let response = '';

    // Add header
    response += `# Antwort auf: ${query}\n\n`;

    // Add primary results
    if (primaryResult && primaryResult.content && primaryResult.content[0]) {
      response += primaryResult.content[0].text + '\n\n';
    }

    // Add follow-up results if they provided new information
    for (const result of followUpResults) {
      if (result && result.content && result.content[0]) {
        const text = result.content[0].text;
        // Only add if it's not duplicate information
        if (!response.includes(text.substring(0, 100))) {
          response += '---\n\n';
          response += text + '\n\n';
        }
      }
    }

    // Add footer with tool call summary
    response += '---\n\n';
    response += `_Generiert mit ${this.toolCallHistory.length} Tool-Aufrufen_\n`;

    return response;
  }

  /**
   * Extract search query from user question
   */
  extractSearchQuery(query) {
    // Remove common question words
    let searchQuery = query
      .replace(/^(was|wie|wann|wo|wer|warum|welche|welches|welcher)\s+/i, '')
      .replace(/\?$/,  '')
      .trim();

    // If query is just an abbreviation, return it
    const abbr = this.extractLawAbbreviation(query);
    if (abbr && searchQuery.length < 20) {
      return abbr;
    }

    return searchQuery;
  }

  /**
   * Extract law abbreviation from query (BGB, StGB, GG, etc.)
   */
  extractLawAbbreviation(query) {
    // Common German law abbreviations
    // Order matters: check for paragraph patterns first, then SGB, then others
    const patterns = [
      /§\s*\d+[a-z]?\s+[A-Z][A-Za-z]+/gi, // § 242 StGB (check first!)
      /\b(SGB\s*[IVX]+)\b/gi, // SGB I, SGB II, etc.
      /\b(BGB|StGB|GG|ZPO|StPO|AO|HGB|UrhG|PatG|MarkenG|GmbHG|AktG|BetrVG|KSchG|BUrlG|ArbZG|TzBfG|AGG|BDSG|TMG|TKG|UWG|GWB|VwGO|VwVfG|FGO|SGG|AufenthG|AsylG|StAG|EStG|UStG|KStG|ErbStG|GrStG|GewStG|AO|InsO|ZVG|WEG|MietrechtsreformG|BEEG|EGBG)\b/gi,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        // Normalize spacing (ensure single space)
        let result = match[0].trim();
        result = result.replace(/SGB\s+/, 'SGB ');
        result = result.replace(/§\s+/, '§ ');
        return result;
      }
    }

    return null;
  }

  /**
   * Decide if we should do a legislation-only search
   */
  shouldSearchLegislation(query, primaryResult) {
    // If query explicitly asks for laws/legislation
    if (query.match(/gesetz|verordnung|rechtsvorschrift|bgb|stgb/i)) {
      return true;
    }

    // If primary result had case law, might want pure legislation
    if (primaryResult && primaryResult.content && primaryResult.content[0]) {
      const text = primaryResult.content[0].text;
      if (text.match(/gericht|urteil|beschluss|ecli/i)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Reset agent state for new query
   */
  reset() {
    this.toolCallHistory = [];
  }

  /**
   * Get tool call statistics
   */
  getStats() {
    return {
      total_calls: this.toolCallHistory.length,
      tools_used: [...new Set(this.toolCallHistory.map(c => c.tool))],
      total_duration: this.toolCallHistory.reduce((sum, c) => sum + c.duration, 0),
      average_duration: this.toolCallHistory.length > 0
        ? this.toolCallHistory.reduce((sum, c) => sum + c.duration, 0) / this.toolCallHistory.length
        : 0,
    };
  }
}

export default MockAgent;
