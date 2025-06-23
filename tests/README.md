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