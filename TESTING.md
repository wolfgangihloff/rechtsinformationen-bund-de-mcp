# Testing Guide for rechtsinformationen-bund-de-mcp

This document describes the testing infrastructure and how to run different types of tests.

## Test Suite Overview

We have four types of tests:

1. **Golden Tests** (`test`) - 17 real-world legal query scenarios
2. **Generic Tests** (`test:generic`) - Direct MCP protocol testing with 9 scenarios
3. **E2E Tests** (`test:e2e`) - End-to-end testing with mock AI agent (12 scenarios)
4. **API Tests** (`test:api`) - Direct API connectivity testing

## Quick Start

```bash
# Run all tests
npm run test:all

# Run individual test suites
npm test                # Golden tests (17 scenarios, ~30s)
npm run test:generic    # MCP protocol tests (9 scenarios, ~20s)
npm run test:e2e        # E2E mock agent tests (12 scenarios, ~60s)
npm run test:api        # API connectivity test

# Run tests with coverage
npm run test:coverage
```

## E2E Testing with Mock Agent

### What It Tests

The E2E test suite (`tests/e2e-mock-agent.test.js`) simulates real AI agent behavior:

- **Tool Selection**: Verifies agent always starts with `intelligente_rechtssuche`
- **Citation Quality**: Checks that responses include properly formatted markdown links
- **Answer Completeness**: Validates responses contain required legal references
- **URL Formatting**: Ensures URLs are user-friendly (not API endpoints)
- **Stopping Behavior**: Confirms recursion limits are respected (max 5 tool calls)

### Test Scenarios

12 scenarios covering:

- **Simple law lookups** (BGB, StGB) - Easy
- **Paragraph searches** (§ 242 StGB) - Medium
- **Complex legal questions** (Mieterhöhung, Kündigung) - Medium
- **Court decisions** (Dashcam ruling) - Medium
- **Social law** (SGB XII) - Medium
- **English translations** (Employee rights) - Medium
- **Multi-law queries** (Data protection) - Hard
- **Known limitations** (GG, SGB I) - Hard (tests graceful failure)

### Running E2E Tests

```bash
# Standard run
npm run test:e2e

# Verbose output (shows all console logs)
npm run test:e2e:verbose

# Watch mode (re-runs on file changes)
npm run test:e2e:watch

# Run single scenario
NODE_OPTIONS='--experimental-vm-modules' jest -t "simple_law_lookup_bgb"
```

### Understanding E2E Test Output

```
🤖 MockAgent processing query: "Was ist das BGB?"
   🔍 Phase 1: Primary search with intelligente_rechtssuche
   📞 Tool call 1: intelligente_rechtssuche({"query":"BGB","limit":5}...)
   ✅ Tool call 1 completed in 1234ms
   ✅ Primary search looks good (5 results) - no follow-up needed
✅ MockAgent completed in 1450ms with 1 tool calls

📊 Agent Statistics:
   Tool calls: 1
   Duration: 1450ms
   Stopped: complete
   Tools used: intelligente_rechtssuche

🧪 Assertion Results:
   Passed: ✅
   Errors: 0
   Warnings: 0
```

## Test Architecture

### Helper Classes

**MockMCPClient** (`tests/helpers/MockMCPClient.js`):
- Spawns MCP server as child process
- Handles stdio communication
- Provides clean async API for tool calls
- Reusable across test suites

**MockAgent** (`tests/helpers/MockAgent.js`):
- Simulates AI agent decision-making
- Rule-based tool selection (not ML)
- Follows agent instructions:
  - Always use `intelligente_rechtssuche` first
  - Max 5 tool calls (configurable)
  - Conservative vs aggressive modes

**Assertion Helpers** (`tests/helpers/assertions.js`):
- `assertToolSequence()` - Tool call validation
- `assertCitationQuality()` - Markdown link checking
- `assertAnswerCompleteness()` - Response validation
- `assertUrlFormatting()` - URL format verification
- `assertStoppingBehavior()` - Recursion limit checks

### Test Fixtures

**E2E Scenarios** (`tests/fixtures/e2e-scenarios.json`):
```json
{
  "id": "simple_law_lookup_bgb",
  "query": "Was ist das BGB?",
  "expected": {
    "max_tool_calls": 2,
    "must_use_tools": ["intelligente_rechtssuche"],
    "must_include_in_response": ["Bürgerliches Gesetzbuch", "BGB"],
    "must_have_citations": true,
    "min_citations": 1
  }
}
```

## Adding New Test Scenarios

1. Add scenario to `tests/fixtures/e2e-scenarios.json`:

```json
{
  "id": "your_scenario_id",
  "category": "simple|complex|case-law|etc",
  "difficulty": "easy|medium|hard",
  "query": "Your legal question here?",
  "expected": {
    "max_tool_calls": 3,
    "must_use_tools": ["intelligente_rechtssuche"],
    "optional_tools": ["deutsche_gesetze_suchen"],
    "must_include_in_response": ["Required", "Terms"],
    "should_include_in_response": ["Recommended", "Terms"],
    "must_have_citations": true,
    "min_citations": 1,
    "must_cite_sources": ["BGB", "StGB"]
  },
  "tags": ["your-tags"]
}
```

2. Run the test:
```bash
npm run test:e2e
```

## Environment Variables

For AI-powered tests (future feature), copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenRouter API key:

```env
OPEN_ROUTER_API=your-api-key-here
MODEL=google/gemini-2.5-flash
```

**Note**: Current E2E tests use a mock agent (no API key required).

## Test Configuration

### Jest Configuration (`jest.config.js`)

- **Environment**: Node.js
- **Timeout**: 30 seconds per test
- **Coverage**: Optional (run with `--coverage`)
- **ES Modules**: Enabled via `NODE_OPTIONS`

### Customizing Mock Agent

```javascript
import { MockAgent } from './helpers/MockAgent.js';

// Conservative agent (fewer tool calls)
const agent = new MockAgent(client, {
  maxToolCalls: 3,
  temperature: 0.1, // Very conservative
});

// Aggressive agent (more thorough searching)
const agent = new MockAgent(client, {
  maxToolCalls: 5,
  temperature: 0.7, // More exploratory
});
```

## Debugging Tests

### Verbose Logging

```bash
# E2E tests with full output
npm run test:e2e:verbose

# Jest debugging
NODE_OPTIONS='--experimental-vm-modules --inspect-brk' jest
```

### Common Issues

**Issue**: `Cannot find module 'X'`
- **Solution**: Ensure you're using `NODE_OPTIONS='--experimental-vm-modules'`

**Issue**: Tests timeout
- **Solution**: Increase timeout in test file: `test(..., 60000)` (60 seconds)

**Issue**: MCP server doesn't start
- **Solution**: Run `npm run build` first to compile TypeScript

**Issue**: API errors (500)
- **Solution**: rechtsinformationen.bund.de API may be rate limiting or down

## Coverage Reports

Generate coverage report:

```bash
npm run test:coverage
```

View HTML report:
```bash
open coverage/index.html
```

Coverage thresholds (aspirational):
- Branches: 50%
- Functions: 50%
- Lines: 50%
- Statements: 50%

## Continuous Integration

Currently no CI/CD pipeline. To add GitHub Actions:

1. Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run build
      - run: npm test
      - run: npm run test:generic
      - run: npm run test:e2e
```

## Performance Benchmarks

Typical test run times (on M1 Mac):

- **Golden Tests**: ~30 seconds (17 scenarios)
- **Generic Tests**: ~20 seconds (9 scenarios)
- **E2E Tests**: ~60 seconds (12 scenarios)
- **All Tests**: ~2 minutes

Tool call latency:
- Local API: 500-2000ms per call
- 500ms rate limiting delay between calls

## Best Practices

1. **Always run tests before committing**: `npm run test:all`
2. **Add tests for new features**: Update `e2e-scenarios.json`
3. **Check coverage**: Run `npm run test:coverage` periodically
4. **Update expected results**: When database coverage changes
5. **Document known limitations**: Use `note` field in scenarios

## Troubleshooting

### Test Failures

If E2E tests fail:

1. Check if MCP server built: `npm run build`
2. Verify API connectivity: `npm run test:api`
3. Check for database changes: Some laws may have been added/removed
4. Review scenario expectations: May need updating

### Performance Issues

If tests are slow:

1. Check internet connection (API calls)
2. Reduce number of scenarios: Comment out in `e2e-scenarios.json`
3. Increase rate limit delay: May be hitting API limits
4. Run specific tests: `jest -t "scenario_name"`

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io)
- [rechtsinformationen.bund.de API](https://docs.rechtsinformationen.bund.de)

## Contributing

When adding tests:

1. Follow existing naming conventions
2. Add descriptive `tags` to scenarios
3. Include `note` field for known limitations
4. Update this documentation if adding new test types
5. Ensure all tests pass before PR

## Support

For issues or questions:

- Check existing tests for examples
- Review helper class documentation
- Open an issue with failing test output
- Include environment details (Node version, OS)
