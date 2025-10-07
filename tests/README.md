# Test Scripts

This folder contains test scripts for the German Legal MCP Server.

## Available Tests

### Golden Test Cases
- **`test-golden.js`** - Comprehensive test suite with key German legal scenarios
  - Tests search functionality across different legal domains
  - Validates expected legal references (§ sections) are found
  - Runs against live API endpoints
  - Usage: `node test-golden.js`

### Connection Tests  
- **`test-mcp-connection.js`** - Tests MCP server connectivity
- **`test-mcp-direct.js`** - Direct MCP server testing
- **`test-new-names.js`** - Tests German tool names

### Functional Tests
- **`test-enhanced-jobcenter.js`** - Jobcenter-specific legal queries
- **`test-semantic-search.js`** - Semantic search functionality
- **`test-url-generation.js`** - URL generation and validation

## Running Tests

From the project root:
```bash
# Run golden test cases
node tests/test-golden.js

# Run specific test
node tests/test-mcp-connection.js
```

## Test Documentation
- **`test-rerun-instructions.md`** - Instructions for re-running tests

## Agentic Evaluation

To evaluate AI agent performance with this MCP server:

### Quick Evaluation
Test these key metrics with any AI model:
- ✅ **Tool selection**: Does agent use `semantische_rechtssuche` first?
- ✅ **Tool efficiency**: 2-3 calls maximum (not 10+)?
- ✅ **Answer quality**: Generates answer after finding results?
- ✅ **Citations**: Includes URLs in "Quellen" section?
- ✅ **No recursion limit**: Stops before hitting limit?

### Test Query
```
"Wie lange kann ich in Elternzeit gehen?"
```

**Expected:**
1. 1-2 tool calls to find BEEG
2. Answer: up to 3 years per child
3. Cites § 15 BEEG
4. Includes URLs

### Evaluation Script
```bash
# Analyze LibreChat conversation exports
node tests/eval-simple.js tests/conversation.json
```

**Outputs:**
- Tool call count
- Document accuracy (found correct ECLI/ELI)
- Citation completeness
- Answer quality score

### Model Comparison
Track performance across different models:

| Model | Avg Calls | Citations | Score |
|-------|-----------|-----------|-------|
| Qwen 2.5-72B | 2-3 | ✅ | 85/100 |
| DeepSeek-R1 | 3-4 | ⚠️ | 75/100 |
| LLaMA 3.3 | 2-3 | ✅ | 80/100 |

See [../AGENTIC_EVAL_GUIDE.md](../AGENTIC_EVAL_GUIDE.md) for comprehensive evaluation framework.