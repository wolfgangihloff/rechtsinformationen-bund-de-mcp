# Rechtsinformationen Bund DE MCP Server - Local Setup Guide

## Quick Start

### 1. Install and Build
```bash
cd /Users/wolfgang.ihloff/workspace/semantic-norm-discovery
npm install
npm run build
```

### 2. Test the Server
```bash
# Test the golden cases to ensure everything works
node test-golden-fixed.js

# Should show: Success Rate: 100.0%
```

### 3. Configure Claude Desktop

#### For macOS:
Edit your Claude Desktop configuration file at:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

Add this configuration:
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

#### For Windows:
Edit your Claude Desktop configuration file at:
```
%APPDATA%/Claude/claude_desktop_config.json
```

Add this configuration:
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

### 4. Restart Claude Desktop
Close and reopen Claude Desktop completely for the changes to take effect.

### 5. Test in Claude Desktop
Try these example queries:
- "Search for German laws about data protection"
- "Find court decisions about employment law"
- "What are the rules for parental leave in Germany?"

## Detailed Configuration

### Complete Claude Desktop Config Example
```json
{
  "mcpServers": {
    "rechtsinformationen-bund-de": {
      "command": "node",
      "args": ["/Users/wolfgang.ihloff/workspace/semantic-norm-discovery/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  },
  "globalShortcut": null
}
```

### Available Tools in Claude Desktop

Once configured, Claude Desktop will have access to these tools:

1. **search_german_laws** - Search federal legislation
2. **search_case_law** - Search court decisions  
3. **search_all_documents** - Search across all document types
4. **semantic_search** - Natural language search with fuzzy matching
5. **get_document_details** - Get full details of specific documents
6. **get_legislation_by_eli** - Retrieve laws by European Legislation Identifier

## Troubleshooting

### Server Won't Start
```bash
# Check if Node.js is installed
node --version

# Should show v18+ or v20+

# Check if dependencies are installed
npm list

# Rebuild if needed
npm run build
```

### Claude Desktop Can't Find the Server
1. **Check file path**: Ensure the path in `claude_desktop_config.json` is correct
2. **Check permissions**: Make sure the files are readable
3. **Check logs**: Look at Claude Desktop logs for error messages
4. **Restart Claude Desktop**: Always restart after config changes

### No Search Results
```bash
# Test API connectivity
node debug-api.js

# Should show successful connections to the German legal API
```

### Config File Location Issues

#### Find your Claude Desktop config directory:

**macOS:**
```bash
# Open the directory in Finder
open "~/Library/Application Support/Claude"

# Or create the config file
mkdir -p "~/Library/Application Support/Claude"
touch "~/Library/Application Support/Claude/claude_desktop_config.json"
```

**Windows:**
```cmd
# Open the directory in Explorer
explorer "%APPDATA%\\Claude"

# Or create the config file
mkdir "%APPDATA%\\Claude" 2>nul
echo {} > "%APPDATA%\\Claude\\claude_desktop_config.json"
```

## Development Mode

### Running in Development Mode
```bash
# Start the server directly for debugging
npm run dev

# Or run the built version
npm start
```

### Testing Individual Components
```bash
# Test API endpoints
node debug-api.js

# Test response parsing
node debug-response.js

# Run golden tests
node test-golden-fixed.js
```

## Alternative: HTTP Server Mode (if stdio doesn't work)

If you need to run the server via HTTP instead of stdio, here's how to modify it:

### Create HTTP Server Wrapper
```bash
# Create a new file for HTTP mode
cat > http-server.js << 'EOF'
#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { GermanLegalMCPServer } from './dist/index.js';

const app = express();
app.use(cors());
app.use(express.json());

const mcpServer = new GermanLegalMCPServer();

app.post('/mcp', async (req, res) => {
  try {
    const result = await mcpServer.handleRequest(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rechtsinformationen Bund DE MCP Server running on http://localhost:${PORT}`);
});
EOF
```

### Install HTTP Dependencies
```bash
npm install express cors
```

### Run HTTP Server
```bash
node http-server.js
```

Then configure Claude Desktop to use:
```json
{
  "mcpServers": {
    "rechtsinformationen-bund-de": {
      "command": "curl",
      "args": ["-X", "POST", "http://localhost:3000/mcp", "-H", "Content-Type: application/json", "-d"]
    }
  }
}
```

## Support

If you encounter issues:
1. Check the golden tests still pass: `node test-golden-fixed.js`
2. Verify API connectivity: `node debug-api.js` 
3. Check Claude Desktop logs for error messages
4. Ensure the file paths in the config are absolute and correct