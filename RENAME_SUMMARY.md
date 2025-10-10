# MCP Server Rename - Token Optimization

## Change Summary

**Date:** 2025-10-10
**Version:** 1.1.0

### What Changed

Renamed the MCP server from `rechtsinformationen-bund-de-mcp` to `rechtsinformationen`

### Reason

**Token Efficiency:** Shorter name saves significant tokens in:
- Tool names (used in every MCP call)
- Tool responses
- Documentation
- Agent configurations

### Token Savings Per Tool Call

**Before:**
```
mcp__rechtsinformationen-bund-de-mcp__semantische_rechtssuche
```
**Length:** 58 characters

**After:**
```
mcp__rechtsinformationen__semantische_rechtssuche
```
**Length:** 48 characters

**Savings:** 10 characters per tool name = ~2-3 tokens per tool call

### Total Impact

With 8 tools and typical usage of 2-3 tool calls per query:

- **Per Query:** ~6-9 tokens saved
- **Per 100 Queries:** ~600-900 tokens saved
- **Per 1000 Queries:** ~6,000-9,000 tokens saved

### Files Updated

1. ✅ `/package.json` - Package name and version
2. ✅ `/src/index.ts` - Server name and version
3. ✅ `/README.md` - All documentation references
4. ✅ `/LIBRECHAT_IMPROVEMENTS.md` - All tool name references

### Tool Names Updated

**Old Format:** `mcp__rechtsinformationen-bund-de-mcp__[tool_name]`
**New Format:** `mcp__rechtsinformationen__[tool_name]`

All 8 tools affected:
1. `semantische_rechtssuche`
2. `deutsche_gesetze_suchen`
3. `rechtsprechung_suchen`
4. `dokument_details_abrufen`
5. `alle_rechtsdokumente_suchen`
6. `gesetz_per_eli_abrufen`
7. `gesetz_per_abkuerzung_abrufen` ⭐ NEW
8. `gesetz_inhaltsverzeichnis_abrufen` ⭐ NEW

### Migration for Users

#### Claude Desktop Config

**Before:**
```json
{
  "mcpServers": {
    "rechtsinformationen-bund-de": {
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```

**After:**
```json
{
  "mcpServers": {
    "rechtsinformationen": {
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```

#### LibreChat Agent Config

**Before:**
```json
{
  "tools": [
    "mcp__rechtsinformationen-bund-de-mcp__semantische_rechtssuche",
    "mcp__rechtsinformationen-bund-de-mcp__deutsche_gesetze_suchen"
  ]
}
```

**After:**
```json
{
  "tools": [
    "mcp__rechtsinformationen__semantische_rechtssuche",
    "mcp__rechtsinformationen__deutsche_gesetze_suchen",
    "mcp__rechtsinformationen__gesetz_per_abkuerzung_abrufen"
  ]
}
```

### Testing

✅ **Build:** Successful
✅ **Server Start:** Verified - shows "Rechtsinformationen MCP server running on stdio"
✅ **Tool Names:** All 8 tools accessible with new shorter names

### Breaking Changes

⚠️ **Users must update their configuration files:**

1. Claude Desktop users: Update `claude_desktop_config.json`
2. LibreChat users: Update agent tool configurations
3. All users: Rebuild after pulling updates (`npm run build`)

### Rollback Procedure

If issues arise, rollback by:

```bash
git revert HEAD
npm install
npm run build
```

Then restore old config:
```json
{
  "mcpServers": {
    "rechtsinformationen-bund-de": { ... }
  }
}
```

---

**Note:** This is a one-time breaking change for long-term token efficiency. All future versions will use the shorter `rechtsinformationen` name.
