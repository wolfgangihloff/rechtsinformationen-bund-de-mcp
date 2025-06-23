# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run build` - Compile TypeScript to JavaScript in dist/
- `npm run dev` - Run development server with tsx (TypeScript execution)
- `npm start` - Run production server from dist/index.js
- `npm test` - Run golden test cases (should show 100% success rate)
- `npm run setup` - Complete setup: install, build, and test

### Testing & Debugging
- `npm run test:api` - Test API connectivity to rechtsinformationen.bund.de
- `npm run verify` - Verify complete setup
- `npm run check-config` - Show Claude Desktop config file path

### Configuration
- `npm run claude-config` - Generate correct MCP server config for Claude Desktop
- `./quick-setup.sh` - Complete automated setup script

## Architecture Overview

This is an MCP (Model Context Protocol) server that provides access to the official German Federal Legal Information Portal (rechtsinformationen.bund.de). The server acts as a bridge between Claude Desktop and the German legal database.

### Core Architecture
- **MCP Server**: Built using @modelcontextprotocol/sdk
- **Communication**: stdio transport for Claude Desktop integration
- **API Client**: Axios-based client for rechtsinformationen.bund.de REST API
- **Semantic Search**: Fuse.js for fuzzy matching and semantic search capabilities

### Key Components

#### Main Server Class (`src/index.ts`)
- `RechtsinformationenBundDeMCPServer`: Main server class handling MCP protocol
- Tool registration and request handling
- API communication with German legal database

#### Six German Legal Search Tools (Usage Priority Order)

**PRIMARY TOOL (Use First):**
1. `semantische_rechtssuche` ⭐ - **ALWAYS USE FIRST for ANY German legal question** - Intelligent semantic search with misconception correction, legal concept mapping, and comprehensive rechtsinformationen.bund.de search. Handles date filtering properly and corrects common legal misconceptions automatically.

**SECONDARY TOOLS (Use for Follow-up):**
2. `deutsche_gesetze_suchen` - Federal legislation search (WARNING: Has date filtering limitations)
3. `rechtsprechung_suchen` - Court decisions search (Use only for specific court filtering)  
4. `alle_rechtsdokumente_suchen` - Comprehensive document search (WARNING: Has date filtering limitations)
5. `gesetz_per_eli_abrufen` - Specific law retrieval by ELI (Use only when you have specific ELI identifier)
6. `dokument_details_abrufen` - Detailed document retrieval (Use only when you have specific document ID)

### API Integration Details

#### Base URL
- Development/Test: `https://testphase.rechtsinformationen.bund.de/v1`
- Endpoints: `/legislation`, `/case-law`, `/document`

#### URL Handling
The codebase correctly implements semantic web principles:
- Work level URLs (abstract): `/v1/legislation/eli/bund/...` 
- Expression level URLs (concrete): Uses `workExample['@id']` for versioned documents
- Website URLs: Converts `/v1/legislation/` to `/norms/` for user-friendly links

### Data Structures

#### SearchResult Interface
- Handles both legislation and case law results
- Includes text matches for content highlighting
- Supports ECLI (European Case Law Identifier) and ELI (European Legislation Identifier)

### Development Notes

#### TypeScript Configuration
- Target: ES2022 with ESNext modules
- Strict mode enabled
- Output directory: `./dist`
- Source maps and declarations generated

#### Testing Infrastructure
- Golden test cases in `/tests/golden_case_tests.json`
- Test runner in `/tests/test-golden.js`
- API connectivity tests
- Debug utilities in `/debug` directory

## Important Search Limitations and Workarounds

### Date Filtering Issues
**Critical Limitation**: Temporal coverage filters don't work reliably and may exclude relevant results.

**Example Problem**: Searching for "§ 44 SGB X Änderung 2021" with date filter 2021 will miss the actual 7. SGB-IV-Änderungsgesetz from June 2020 that became effective January 1, 2021.

**Recommended Approach**:
- **Don't use date filters** - they often exclude relevant documents
- Search without temporal restrictions first
- Manually review results for dates and effective dates
- Search for both enactment year AND effective year (e.g., "2020" and "2021")

### Historical Version Access
**Limitation**: Only current versions of laws are easily accessible through ELI identifiers.

**Workarounds**:
- Search for "BGBl [year]" to find Federal Law Gazette entries
- Look for "Artikelgesetz" or specific amendment law names
- Search for effective dates like "2021-01-01" or "Inkrafttreten"

### Amendment Law Discovery
**Problem**: Amendment laws (like "7. SGB-IV-Änderungsgesetz") are poorly indexed.

**Better Search Terms**:
- Use broader terms like "SGB IV Änderung"
- Search for Federal Law Gazette references
- Look for omnibus bills that may contain the changes

## Tool Usage Strategy

### Tool Priority System
The MCP server tool descriptions are designed to guide Claude Desktop's tool selection:

1. **Primary Tool**: `semantische_rechtssuche` is marked as **PRIMARY TOOL** and includes "⭐ ALWAYS USE THIS FIRST" in the description
2. **Secondary Tools**: All other tools explicitly state "Use ONLY for follow-up searches after semantische_rechtssuche" or similar language
3. **Warnings**: Tools with known limitations include "WARNING: Has date filtering limitations"

### Why This Matters
- **semantische_rechtssuche** has intelligent misconception correction (e.g., maps "Überprüfungsantrag" to "Widerspruch")  
- **semantische_rechtssuche** handles date filtering properly
- **semantische_rechtssuche** provides legal concept mapping and comprehensive search
- Other tools may miss results due to date filtering or exact term matching

### Example Workflow
1. **Initial Query**: Use `semantische_rechtssuche` for "SGB X § 44 Überprüfungsantrag"
2. **Concept Correction**: Tool automatically corrects to search for "Rücknahme" and "Widerspruch"
3. **Follow-up**: If needed, use `deutsche_gesetze_suchen` for specific legislation details
4. **Document Details**: Use `dokument_details_abrufen` to get full text of specific documents

### English Query Support
The semantic search tool automatically detects and translates English legal queries:

**Example Translations:**
- "employee rights" → "Arbeitnehmerrechte"
- "company restructuring" → "Betriebsumstrukturierung" 
- "data protection" → "Datenschutz"
- "court decisions" → "Gericht Entscheidungen"
- "trademark infringement" → "Marke infringement"

**How it works:**
1. **Language Detection**: Detects English legal terms in queries
2. **Translation**: Maps English terms to German legal equivalents
3. **Search**: Uses translated terms for database search
4. **Display**: Shows both original and translated query to user

### Searching for Legislative Amendments
When looking for specific law changes (e.g., "Why was § 44 SGB X changed in 2021?"):
1. **Start with semantic search**: `semantische_rechtssuche` for "§ 44 SGB X Änderung 2021"
2. **Search for amendment laws**: Try "SGB X Änderungsgesetz 2021" or "Gesetz zur Änderung des SGB X"
3. **Look for Federal Law Gazette**: Search "BGBl 2021 SGB X" for official publication references
4. **Important**: Amendment information is often in separate amendment laws, not in the original provision text
5. **Exhaust all MCP tools** before considering external web search

## Common Development Patterns

### Adding New Search Tools
1. Add tool definition in `setupToolHandlers()` ListToolsRequestSchema handler
2. Add case in CallToolRequestSchema switch statement
3. Implement private method following naming pattern
4. Add formatting method for results

### API Error Handling
All API calls wrapped in try-catch with fallback error responses. Continue with other search terms if individual searches fail.

### Result Formatting
Consistent formatting across all tools with:
- Official source headers and citations
- Paragraph reference extraction (§ patterns)
- Human-readable URLs for end users
- Mandatory citation instructions for Claude

## File Structure

```
src/
├── index.ts           # Main MCP server implementation
├── index-updated.ts   # Alternative implementation (if exists)

tests/                 # Test files and debugging utilities
debug/                # Debug scripts for API testing
dist/                 # Compiled JavaScript output
```

## Integration Requirements

### Claude Desktop Configuration
This is a local MCP server requiring stdio configuration in Claude Desktop:
```json
{
  "mcpServers": {
    "rechtsinformationen-bund-de": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"]
    }
  }
}
```

### Dependencies
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `axios` - HTTP client for API requests
- `fuse.js` - Fuzzy search functionality

Always restart Claude Desktop completely after configuration changes.