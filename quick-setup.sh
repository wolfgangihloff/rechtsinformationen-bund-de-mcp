#!/bin/bash

echo "🔧 Rechtsinformationen Bund DE MCP Server - Quick Setup"
echo "======================================================="

# Step 1: Build the server
echo "📦 Building the server..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please check the error messages above."
    exit 1
fi

# Step 2: Test the server
echo "🧪 Testing the server..."
npm test

if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Please check the error messages above."
    exit 1
fi

# Step 3: Generate Claude Desktop config
echo "⚙️  Generating Claude Desktop configuration..."

CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
PROJECT_PATH="$(pwd)"

# Create Claude config directory if it doesn't exist
mkdir -p "$HOME/Library/Application Support/Claude"

# Check if config file exists
if [ -f "$CONFIG_PATH" ]; then
    echo "📄 Existing Claude Desktop config found. Backing up..."
    cp "$CONFIG_PATH" "$CONFIG_PATH.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Create or update the config
echo "📝 Creating Claude Desktop configuration..."

cat > "$CONFIG_PATH" << EOF
{
  "mcpServers": {
    "rechtsinformationen-bund-de": {
      "command": "node",
      "args": ["$PROJECT_PATH/dist/index.js"]
    }
  }
}
EOF

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Restart Claude Desktop completely"
echo "2. Try asking Claude: 'Search for German laws about data protection'"
echo ""
echo "📁 Configuration written to:"
echo "   $CONFIG_PATH"
echo ""
echo "🔍 To verify setup:"
echo "   npm test          - Run golden tests"
echo "   npm run test:api  - Test API connectivity"
echo ""
echo "❓ Troubleshooting:"
echo "   If Claude Desktop can't find the server, check the config path above"
echo "   and ensure Claude Desktop has been fully restarted."