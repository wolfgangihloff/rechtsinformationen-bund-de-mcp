# Rechtsinformationen Bund DE MCP Server

An MCP (Model Context Protocol) server that provides access to the official German Federal Legal Information Portal (rechtsinformationen.bund.de). **Claude Desktop will automatically use this server for ANY German legal question** to provide authoritative, fact-based answers with proper legal citations from official sources.

## 🚀 Quick Setup

**The fastest way to get started:**

1. **Run the setup script:**
```bash
./quick-setup.sh
```

2. **Restart Claude Desktop completely**

3. **Test with:** "Search for German laws about data protection"

## 🎯 What Questions Does This Answer?

**Claude Desktop will automatically use this MCP server for:**
- **Any German legal question** ("What happens if I miss a Jobcenter appointment?")
- **Legal rights and obligations** ("How long can I take parental leave?")
- **Court decisions and precedents** ("Recent BGH decisions on trademark law")
- **Specific law lookups** ("What does § 32 SGB II say?")
- **Administrative law questions** ("When do I need a hearing in administrative proceedings?")
- **Social law questions** ("Does data protection apply to Jobcenters?")
- **Any question about German federal laws, regulations, or court decisions**

**Purpose:** Ensures all German legal answers are grounded in official sources with proper citations, not general world knowledge.

## Features

- **Full-text search** across German federal laws and legislation
- **Case law search** through German federal court decisions
- **Semantic search** using fuzzy matching for natural language queries
- **Document search** across all types of legal documents
- **Detailed law retrieval** using European Legislation Identifiers (ELI)
- **Date filtering** and advanced search parameters
- **100% success rate** on German legal golden test cases

## Manual Installation

### 1. Build the Server
```bash
npm install
npm run build
npm test  # Should show 100% success rate
```

### 2. Claude Desktop Configuration

**Integration Type:** This is a **local MCP server** (not a web URL). It runs as a command-line tool that Claude Desktop connects to directly via stdio.

**No URL needed** - Claude Desktop communicates with the server process locally using the Model Context Protocol (MCP).

Add this server to your Claude Desktop configuration file:

### macOS
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rechtsinformationen-bund-de": {
      "command": "node",
      "args": ["/Users/wolfgang.ihloff/workspace/semantic-norm-discovery/dist/index.js"]
    }
  }
}
```

### Windows
Edit `%APPDATA%/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rechtsinformationen-bund-de": {
      "command": "node",
      "args": ["C:\\path\\to\\your\\project\\dist\\index.js"]
    }
  }
}
```

## Available Tools

**In Claude Desktop, you'll see these German-named tools with emojis and rechtsinformationen.bund.de branding:**

### 1. 🇩🇪 deutsche_gesetze_suchen
Deutsche Bundesgesetze durchsuchen - Search German federal laws and legislation

**Parameters:**
- `searchTerm` (required): Search term for finding laws
- `temporalCoverageFrom` (optional): Start date filter (ISO 8601 format)
- `temporalCoverageTo` (optional): End date filter (ISO 8601 format)
- `limit` (optional): Maximum number of results (default: 10)

**Example:** "Search for trademark laws" will use this tool automatically

### 2. ⚖️ rechtsprechung_suchen  
Deutsche Rechtsprechung durchsuchen - Search German federal court decisions

**Parameters:**
- `searchTerm` (required): Search term for finding court decisions
- `court` (optional): Filter by specific court (e.g., BGH, BVerfG, BAG)
- `dateFrom` (optional): Start date filter (ISO 8601 format)
- `dateTo` (optional): End date filter (ISO 8601 format)
- `limit` (optional): Maximum number of results (default: 10)

**Example:** "Find court decisions about data protection" will use this tool

### 3. 🏛️ gesetz_per_eli_abrufen
Deutsches Gesetz per ELI abrufen - Get specific German legislation by ELI identifier

**Parameters:**
- `eli` (required): European Legislation Identifier for the law
- `format` (optional): Response format (html, xml, or json, default: json)

**Example:** Claude will use this when you reference specific law identifiers

### 4. 🔍 alle_rechtsdokumente_suchen
Alle deutschen Rechtsdokumente durchsuchen - Search across all types of legal documents

**Parameters:**
- `searchTerm` (required): Search term for finding documents
- `documentKind` (optional): Filter by document type ('case-law' or 'legislation')
- `dateFrom` (optional): Start date filter (ISO 8601 format)
- `dateTo` (optional): End date filter (ISO 8601 format)
- `limit` (optional): Maximum number of results (default: 10)

**Example:** "Search all documents about copyright" will use this comprehensive tool

### 5. 🧠 semantische_rechtssuche
Semantische deutsche Rechtssuche - Intelligent search with fuzzy matching

**Parameters:**
- `query` (required): Natural language query for semantic search
- `threshold` (optional): Similarity threshold (0.0 to 1.0, default: 0.3)
- `limit` (optional): Maximum number of results (default: 10)

**Example:** Complex legal questions will trigger this intelligent search

### 6. 📄 dokument_details_abrufen
Rechtsdokument Details abrufen - Get detailed information about specific documents

**Parameters:**
- `documentId` (required): Document ID from search results
- `format` (optional): Response format (html, xml, or json, default: json)

**Example:** Claude will use this to get full details of found documents

## Usage Examples

### Basic Law Search
"Search for German laws about data protection from 2018 onwards"

### Court Decision Search
"Find recent court decisions from the Bundesgerichtshof about trademark infringement"

### Semantic Search
"What are the German laws regarding employee rights during company restructuring?"

### Specific Law Details
"Get the full text of the German Copyright Act"

## API Source

This MCP server uses the official German Federal Legal Information API:
- Base URL: `https://testphase.rechtsinformationen.bund.de/v1`
- Documentation: `https://docs.rechtsinformationen.bund.de`
- Status: Trial service (may be subject to changes)

## 🔧 Local Testing & Troubleshooting

### Test the Server Locally
```bash
# Run all golden tests (should show 100% success)
npm test

# Test API connectivity
npm run test:api

# Check if config is correct
npm run check-config
```

### Common Issues

#### 1. Server Won't Start
```bash
# Check Node.js version (needs v18+ or v20+)
node --version

# Rebuild everything
npm install && npm run build
```

#### 2. Claude Desktop Can't Find Server
1. **Verify config path**: Run `npm run check-config`
2. **Check file exists**: Ensure `dist/index.js` exists after build
3. **Restart Claude Desktop**: Always restart completely after config changes
4. **Check logs**: Look at Claude Desktop logs for error messages

#### 3. No Search Results
```bash
# Test if German legal API is accessible
npm run test:api

# Should show successful connections to rechtsinformationen.bund.de
```

#### 4. Wrong File Path in Config
- **macOS**: Use absolute path like `/Users/[username]/workspace/semantic-norm-discovery/dist/index.js`
- **Windows**: Use absolute path like `C:\Users\[username]\workspace\semantic-norm-discovery\dist\index.js`

### Helper Commands
```bash
# Generate correct config for your system
npm run claude-config

# Complete setup from scratch
./quick-setup.sh

# One-liner test and build
npm run setup
```

## Development

### Run in Development Mode
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Start Production Server
```bash
npm start
```

### Integration Architecture

**How it works:**
1. **Local Process**: MCP server runs as a Node.js process on your machine
2. **Stdio Communication**: Claude Desktop connects via standard input/output
3. **No Network Ports**: No HTTP server needed - direct process communication
4. **Real-time**: Each Claude query triggers real-time API calls to German legal database

**Data Flow:**
```
Claude Desktop → MCP Server → rechtsinformationen.bund.de API → German Legal Database
```

## Known Database Limitations

### Amendment Law Coverage
Our analysis reveals specific gaps in the rechtsinformationen.bund.de database that affect user queries about legislative changes:

#### **Missing Amendment Laws (2021)**
- **Issue**: The "Siebtes Gesetz zur Änderung des Vierten Buches Sozialgesetzbuch und anderer Gesetze" (7th Amendment to SGB IV and Other Laws) from 2021 is not found in the database
- **Impact**: Users asking "Why was § 44 SGB X changed in 2021?" receive incomplete information
- **Current Behavior**: Semantic search finds current § 44 SGB X text and court decisions, but not the specific amendment law or reasoning

#### **Date Filtering Issues**
- **Issue**: Temporal filters can exclude relevant results when laws enacted in one year become effective in another
- **Example**: Searching for "§ 44 SGB X Änderung 2021" with `dateFrom: "2021-01-01"` may miss a 2020 law that became effective January 1, 2021
- **Workaround**: Search without date filters first, then manually review effective dates

#### **Amendment Cross-References**
- **Issue**: Amendment laws may not clearly show which specific paragraphs of other laws they modify
- **Impact**: Finding "which amendment law changed § X" requires searching the base law, not the amendment law
- **Current Behavior**: Database contains court decisions applying amended provisions but not legislative history

#### **Legislative Materials Scope**
**What IS included:**
- ✅ Current law text
- ✅ Court decisions applying laws (BGH, BVerfG, BSG decisions)
- ✅ Some Federal Law Gazette references

**What is NOT included:**
- ❌ Parliamentary documents (Bundestag-Drucksachen)
- ❌ Committee reports and explanatory memoranda
- ❌ Legislative reasoning and amendment justifications
- ❌ Complete amendment law texts with cross-references

### Database Coverage Analysis
Based on systematic testing with multiple search strategies:
- **Current Law Provisions**: ✅ Comprehensive
- **Court Decisions**: ✅ Good coverage (2010-2024)
- **Amendment Laws**: ⚠️ Partial coverage with significant gaps
- **Legislative History**: ❌ Not included

### Recommendations for Developers
1. **Include Amendment Laws**: Add complete amendment laws with clear cross-references to modified provisions
2. **Improve Date Indexing**: Index both enactment dates and effective dates separately
3. **Add Legislative Materials**: Include explanatory memoranda and committee reports where available
4. **Cross-Reference Mapping**: Create explicit links between amendment laws and the provisions they modify

### Current API Limitations
- This is a trial service API that may be subject to changes
- No API key required, but rate limiting may apply
- Dataset may be incomplete during the trial phase
- Requires internet connection to access German legal database

## License

MIT