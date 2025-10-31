#!/usr/bin/env node

/**
 * Test Assertion Helpers
 *
 * Provides reusable assertion functions for E2E testing:
 * - Tool sequence validation
 * - Citation quality checks
 * - Answer completeness validation
 * - URL formatting verification
 * - Stopping behavior validation
 */

/**
 * Assert that the tool call sequence matches expectations
 */
export function assertToolSequence(actual, expected) {
  const errors = [];

  // Check must-use tools
  if (expected.must_use_tools) {
    for (const tool of expected.must_use_tools) {
      const used = actual.some(call => call.tool === tool);
      if (!used) {
        errors.push(`Missing required tool: ${tool}`);
      }
    }
  }

  // Check tool call count
  if (expected.max_tool_calls && actual.length > expected.max_tool_calls) {
    errors.push(`Too many tool calls: ${actual.length} > ${expected.max_tool_calls}`);
  }

  // Check if first tool is intelligente_rechtssuche (as per agent instructions)
  if (actual.length > 0 && actual[0].tool !== 'intelligente_rechtssuche') {
    errors.push(`First tool should be intelligente_rechtssuche, got: ${actual[0].tool}`);
  }

  return {
    passed: errors.length === 0,
    errors,
    actual_sequence: actual.map(c => c.tool),
  };
}

/**
 * Assert citation quality in response
 */
export function assertCitationQuality(response, expected) {
  const errors = [];

  // Extract markdown links
  const markdownLinks = response.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
  const rawUrls = response.match(/https?:\/\/[^\s)]+/g) || [];

  // Check if citations are required
  if (expected.must_have_citations) {
    if (markdownLinks.length === 0 && rawUrls.length === 0) {
      errors.push('No citations found in response');
    }

    // Check minimum citation count
    if (expected.min_citations && markdownLinks.length < expected.min_citations) {
      errors.push(`Too few citations: ${markdownLinks.length} < ${expected.min_citations}`);
    }

    // Check citation format (should be markdown, not raw URLs)
    if (expected.citation_format === 'markdown_link') {
      const rawUrlsInText = response.match(/(?<!\()(https?:\/\/testphase\.rechtsinformationen\.bund\.de[^\s)]*)/g) || [];
      if (rawUrlsInText.length > 0) {
        errors.push(`Found ${rawUrlsInText.length} raw URLs - should be markdown links`);
      }
    }

    // Check that links have descriptive text (not just URLs)
    for (const link of markdownLinks) {
      const match = link.match(/\[([^\]]+)\]/);
      if (match) {
        const linkText = match[1];
        // Link text should not be the URL itself
        if (linkText.startsWith('http://') || linkText.startsWith('https://')) {
          errors.push(`Link has URL as text instead of document name: ${linkText}`);
        }
        // Link text should be meaningful (>10 chars or known abbreviations)
        if (linkText.length < 3 && !linkText.match(/^(BGB|StGB|GG|ZPO|SGB)$/)) {
          errors.push(`Link text too short: "${linkText}"`);
        }
      }
    }
  }

  // Check if specific sources are cited
  if (expected.must_cite_sources) {
    for (const source of expected.must_cite_sources) {
      const cited = response.includes(source);
      if (!cited) {
        errors.push(`Required source not cited: ${source}`);
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    citation_count: markdownLinks.length,
    raw_url_count: rawUrls.length,
    citations: markdownLinks,
  };
}

/**
 * Assert answer completeness
 */
export function assertAnswerCompleteness(response, expected) {
  const errors = [];

  // Check required content
  if (expected.must_include_in_response) {
    for (const content of expected.must_include_in_response) {
      if (!response.includes(content)) {
        errors.push(`Missing required content: "${content}"`);
      }
    }
  }

  // Check recommended content (warnings, not errors)
  const warnings = [];
  if (expected.should_include_in_response) {
    for (const content of expected.should_include_in_response) {
      if (!response.includes(content)) {
        warnings.push(`Missing recommended content: "${content}"`);
      }
    }
  }

  // Check response length (should be substantive)
  if (response.length < 100) {
    errors.push(`Response too short: ${response.length} chars`);
  }

  // Check if response has structure (headings, paragraphs)
  const hasHeadings = response.includes('#');
  const hasParagraphs = response.split('\n\n').length > 1;
  if (!hasHeadings && !hasParagraphs) {
    warnings.push('Response lacks structure (no headings or paragraphs)');
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    length: response.length,
    has_structure: hasHeadings || hasParagraphs,
  };
}

/**
 * Assert URL formatting
 */
export function assertUrlFormatting(response) {
  const errors = [];
  const warnings = [];

  // Find all URLs
  const urls = response.match(/https?:\/\/[^\s)]+/g) || [];

  for (const url of urls) {
    // Check if it's an API URL (should be converted to HTML)
    if (url.includes('/v1/legislation/') && !url.includes('[')) {
      errors.push(`API URL found outside markdown link: ${url.substring(0, 80)}...`);
    }

    // Check if URL is for rechtsinformationen.bund.de
    if (url.includes('testphase.rechtsinformationen.bund.de')) {
      // Should use /norms/ for HTML, not /v1/ API endpoints
      if (url.includes('/v1/legislation/')) {
        warnings.push(`URL uses API endpoint instead of HTML viewer: ${url.substring(0, 80)}...`);
      }
    }
  }

  // Extract markdown links
  const markdownLinks = response.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];

  for (const link of markdownLinks) {
    const urlMatch = link.match(/\(([^)]+)\)/);
    if (urlMatch) {
      const url = urlMatch[1];

      // Check if it's a rechtsinformationen.bund.de link
      if (url.includes('testphase.rechtsinformationen.bund.de')) {
        // Should use /norms/ or /ecli/ for user-facing links
        if (!url.includes('/norms/') && !url.includes('/ecli/') && !url.includes('/case-law/')) {
          warnings.push(`Link might not be user-accessible: ${url.substring(0, 80)}...`);
        }
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    total_urls: urls.length,
    markdown_links: markdownLinks.length,
  };
}

/**
 * Assert stopping behavior (recursion limits)
 */
export function assertStoppingBehavior(toolCalls, maxCalls = 5) {
  const errors = [];

  // Check if max calls limit was respected
  if (toolCalls.length > maxCalls) {
    errors.push(`Exceeded max tool calls: ${toolCalls.length} > ${maxCalls}`);
  }

  // Check if there's a pattern of infinite loops
  const toolSequence = toolCalls.map(c => c.tool).join(',');
  const repeatingPattern = /(.+?)\1{2,}/.test(toolSequence); // Same pattern 3+ times
  if (repeatingPattern) {
    errors.push('Detected repeating tool call pattern - possible infinite loop');
  }

  // Check if same tool with same args was called multiple times
  const callSignatures = toolCalls.map(c => `${c.tool}:${JSON.stringify(c.args)}`);
  const uniqueSignatures = new Set(callSignatures);
  if (uniqueSignatures.size < callSignatures.length) {
    const duplicateCount = callSignatures.length - uniqueSignatures.size;
    errors.push(`Found ${duplicateCount} duplicate tool call(s) with identical parameters`);
  }

  return {
    passed: errors.length === 0,
    errors,
    tool_call_count: toolCalls.length,
    unique_calls: uniqueSignatures.size,
  };
}

/**
 * Run all assertions for a test scenario
 */
export function assertScenario(result, expected) {
  const assertions = {
    tool_sequence: assertToolSequence(result.toolCalls, expected),
    citation_quality: assertCitationQuality(result.response, expected),
    answer_completeness: assertAnswerCompleteness(result.response, expected),
    url_formatting: assertUrlFormatting(result.response),
    stopping_behavior: assertStoppingBehavior(result.toolCalls, expected.max_tool_calls),
  };

  const allPassed = Object.values(assertions).every(a => a.passed);
  const allErrors = Object.values(assertions).flatMap(a => a.errors || []);
  const allWarnings = Object.values(assertions).flatMap(a => a.warnings || []);

  return {
    passed: allPassed,
    errors: allErrors,
    warnings: allWarnings,
    assertions,
  };
}

export default {
  assertToolSequence,
  assertCitationQuality,
  assertAnswerCompleteness,
  assertUrlFormatting,
  assertStoppingBehavior,
  assertScenario,
};
