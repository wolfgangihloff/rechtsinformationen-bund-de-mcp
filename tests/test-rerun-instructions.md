# How to Rerun the Golden Tests

## Prerequisites
Make sure you have Node.js and npm installed in your environment.

## Quick Test Run
```bash
# Navigate to the project directory
cd /Users/wolfgang.ihloff/workspace/semantic-norm-discovery

# Run the golden tests
node test-golden-fixed.js
```

## Full Development Cycle
```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Build the MCP server
npm run build

# 3. Run the golden tests
node test-golden-fixed.js

# 4. Test individual API endpoints for debugging
node debug-api.js

# 5. Examine response structure for development
node debug-response.js
```

## Test Scripts Available

### `test-golden-fixed.js`
- **Purpose**: Runs all 7 golden test cases against the German legal API
- **Current Success Rate**: 100% (7/7 tests passing)
- **What it tests**: 
  - SGB II Meldeversäumnis (missing job center appointments)
  - BEEG Elternzeit (parental leave duration)
  - BEEG Elterngeld Teilzeit (parental benefits with part-time work)
  - VwVfG Anhörung (administrative procedure hearings)
  - Ermessensentscheidung vs gebundene Entscheidung (discretionary vs bound decisions)
  - SGB X Datenschutz Jobcenter (data protection at job centers)
  - SGB X Verwaltungsakt Rücknahme (withdrawal of administrative acts)

### `debug-api.js`
- **Purpose**: Tests API connectivity and basic endpoint functionality
- **Use case**: When API seems down or returning errors

### `debug-response.js`
- **Purpose**: Examines the exact JSON-LD response structure from the API
- **Use case**: When developing new features or debugging response parsing

## Expected Test Output
When running `test-golden-fixed.js`, you should see:
```
🧪 Running Golden Test Cases for German Legal MCP Server (Fixed)
================================================================================

📋 Test 1: Was passiert, wenn ich einen Termin beim Jobcenter verpasse?
Expected: § 32 SGB II – Meldeversäumnis
--------------------------------------------------
🔍 Searching: "Meldeversäumnis"
   All docs: 100 points, 12 results
   ...
✅ PASSED: Found: (Sozialgerichtliches Verfahren - Minderung des Arbeitslosengeld II...)

...

📊 TEST SUMMARY
================================================================================
Total Tests: 7
Passed: 7
Failed: 0
Success Rate: 100.0%
```

## Troubleshooting

### If tests fail:
1. Check internet connectivity
2. Verify the API is accessible: `node debug-api.js`
3. Check if API structure has changed: `node debug-response.js`

### If API returns no results:
- The German legal API database may be incomplete during trial phase
- Try broader search terms
- Check if specific law codes (SGB, BEEG, VwVfG) are available in the current dataset

### To modify test cases:
Edit the `goldenTests` array in `test-golden-fixed.js` to add new questions or update search terms.

## MCP Server Testing
To test the MCP server directly with Claude Desktop:
1. Build: `npm run build`  
2. Add to Claude Desktop config (see README.md)
3. Restart Claude Desktop
4. Test with queries like: "Search for German laws about data protection"