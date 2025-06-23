#!/bin/bash

echo "🔄 Restarting Claude Desktop..."

# Kill Claude Desktop
pkill -f "Claude Desktop" || true

# Wait a moment
sleep 2

# Restart Claude Desktop
open -a "Claude Desktop"

echo "✅ Claude Desktop restarted!"