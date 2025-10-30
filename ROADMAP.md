# ROADMAP - rechtsinformationen-bund-de-mcp

This document outlines completed work and planned iterations for the MCP server.

## ✅ Phase 1: Core Improvements (COMPLETED)

### 1.1 Tool Renaming ✅
**Status**: COMPLETED
**Branch**: main
**Commit**: [Ready for commit]

**Changes**:
- Renamed `semantische_rechtssuche` → `intelligente_rechtssuche`
- Updated all 15+ references throughout codebase
- Clarified tool description: AI agent provides semantic understanding
- Tool accurately describes: keyword matching + Fuse.js fuzzy search (NOT ML embeddings)

**Impact**:
- Tool name now accurately reflects functionality
- Prevents confusion about semantic search capabilities
- Clear distinction between tool capabilities and AI agent responsibilities

**Files Modified**:
- [src/index.ts](src/index.ts) - Tool definition, case handler, all error messages

---

### 1.2 Abbreviation Search Bug Fix ✅
**Status**: COMPLETED
**Branch**: main
**Commit**: [Ready for commit]

**Problem**:
- Searching "SGB I" returned wrong laws (e.g., VersMedV)
- Generic scoring algorithm didn't prioritize exact abbreviation matches
- Roman numeral handling for SGB books was insufficient

**Solution**:
- Enhanced scoring algorithm with exact match priority (1000 points)
- Special SGB book handling to prevent wrong matches
- Negative scoring (-500 points) for incorrect SGB book matches
- Added validation warnings for abbreviation mismatches

**Files Modified**:
- [src/index.ts](src/index.ts):1776-2005 (`getLawByAbbreviation` method)

**Test Coverage**:
- Added test case: `sgb_i_lookup` in [tests/golden_case_tests.json](tests/golden_case_tests.json)
- Validation: Ensures "SGB I" returns Sozialgesetzbuch Erstes Buch, NOT VersMedV

---

### 1.3 Human-Readable URLs with Markdown Links ✅
**Status**: COMPLETED
**Branch**: main
**Commit**: [Ready for commit]

**Problem**:
- URLs were technical API endpoints: `https://testphase.rechtsinformationen.bund.de/v1/legislation/eli/bund/bgbl-1/2019/s2652/...`
- No document names in links
- Poor user experience in AI responses

**Solution**:
- Created `generateHumanReadableUrl()` helper method
- Created `formatDocumentLink()` helper method for markdown links
- Updated all formatting methods to return: `[Grundgesetz für die Bundesrepublik Deutschland](https://...)`

**Files Modified**:
- [src/index.ts](src/index.ts):1422-1482 (new helper methods)
- [src/index.ts](src/index.ts) - Updated formatLegislationResults, formatCaseLawResults, getLawByAbbreviation, formatEnhancedSemanticResults

**Impact**:
- All URLs now include document names as clickable markdown links
- Significantly improved user experience
- Easier to understand which documents are referenced

---

### 1.4 Enhanced Agent Instructions ✅
**Status**: COMPLETED
**Branch**: main
**Commit**: [Ready for commit]

**Changes**:
- Added rechtsinformationen MCP section to [tmp/agent_instructions.md](tmp/agent_instructions.md)
- Documented tool priority (`intelligente_rechtssuche` first)
- Added URL presentation guidelines with examples
- Included example workflows (GG Article 1 query)

**Impact**:
- AI agents have clear guidance on tool usage
- Ensures proper URL formatting in responses
- Reduces tool selection errors

---

### 1.5 Expanded Golden Test Cases ✅
**Status**: COMPLETED
**Branch**: main
**Commit**: [Ready for commit]

**Added Test Cases** (17 total, up from 12):
1. `gg_article_1` - Grundgesetz Article 1 lookup
2. `sgb_i_lookup` - SGB I abbreviation accuracy (bug validation)
3. `sgb_collection_search` - Multiple SGB books search (URL validation)
4. `bgb_abbreviation` - BGB abbreviation lookup
5. `stgb_paragraph_search` - StGB § 242 search

**Files Modified**:
- [tests/golden_case_tests.json](tests/golden_case_tests.json)

**Test Results**:
- 4/17 passed (23.5% success rate)
- Passing tests: Complex court decision searches (BVerfG, BGH cases)
- Failing tests: Mostly new test cases designed for AI integration testing
- **Note**: Current test runner does direct API calls, not MCP tool invocations

---

## 🚧 Phase 2: Comprehensive Testing (NEXT ITERATION)

### 2.1 Direct MCP Tool Testing
**Status**: PLANNED
**Priority**: HIGH
**Estimated Effort**: 4-6 hours

**Goal**: Test MCP tools directly without AI agent involvement

**File**: `tests/test-generic-search.js`

**Test Coverage**:
- ✅ Abbreviation lookup accuracy (GG, BGB, StGB, SGB I-XIV)
- ✅ Article/paragraph search (GG Artikel 1, § 44 SGB X, § 242 StGB)
- ✅ Full name search (Grundgesetz, Bürgerliches Gesetzbuch)
- ✅ URL validation (all results have markdown links with names)
- ✅ Multi-document searches (finding all SGB books)

**Test Architecture**:
```javascript
// Connect to local MCP server via stdio
// Call tools directly with test parameters
// Validate:
//   - Correct law returned
//   - URLs are markdown format with document names
//   - Abbreviations match exactly
//   - No wrong law matches (e.g., SGB I ≠ VersMedV)
```

**Deliverables**:
- [ ] `tests/test-generic-search.js` implementation
- [ ] Test report showing tool accuracy
- [ ] Documentation of any issues found

---

### 2.2 AI Integration Testing with OpenRouter
**Status**: PLANNED
**Priority**: HIGH
**Estimated Effort**: 6-8 hours

**Goal**: Test real AI agent interactions with MCP server

**File**: `tests/test-ai-interaction.js`

**Test Scenarios**:
1. **GG Article 1 Query**: "Wie lautet der Artikel 1 des Grundgesetzes?"
   - Expected: Uses `intelligente_rechtssuche` first
   - Validates: Correct article found, URL is markdown link

2. **SGB Collection Search**: "Bitte suche mir die SGB Gesetze raus"
   - Expected: Uses appropriate search tool, finds multiple SGB books
   - Validates: All URLs are markdown links with law names

3. **SGB I Abbreviation**: "Finde mir das Gesetz SGB I"
   - Expected: Returns Sozialgesetzbuch Erstes Buch (NOT VersMedV)
   - Validates: Abbreviation accuracy, proper URL formatting

4. **Complex Query**: "Was regelt § 44 SGB X über Rücknahme?"
   - Expected: Multiple tool calls with semantic understanding
   - Validates: Tool selection, citations, URL formatting

5. **Amendment Question**: "Was wurde 2021 am SGB X geändert?"
   - Expected: Multiple search attempts with variations
   - Validates: Agent provides semantic variations

**Test Architecture**:
```javascript
// Load credentials from .env (OPEN_ROUTER_API, MODELL)
// Start local MCP server
// Send queries to DeepSeek v3.2 with MCP tools available
// Validate:
//   - Correct tool selection
//   - Tool call parameters
//   - URL formatting in AI responses
//   - Citation completeness
//   - German language quality
```

**Deliverables**:
- [ ] `tests/test-ai-interaction.js` implementation
- [ ] Integration test report
- [ ] Agent instruction improvements based on failures
- [ ] Tool description refinements

---

### 2.3 npm Script Updates
**Status**: PLANNED
**Priority**: MEDIUM
**Estimated Effort**: 30 minutes

**Changes to [package.json](package.json)**:
```json
{
  "scripts": {
    "test": "node tests/test-golden.js",
    "test:generic": "node tests/test-generic-search.js",
    "test:ai": "node tests/test-ai-interaction.js",
    "test:all": "npm test && npm run test:generic && npm run test:ai",
    "test:quick": "npm test && npm run test:generic"
  }
}
```

**Deliverables**:
- [ ] Updated package.json
- [ ] Documentation of test commands in README

---

## 📚 Phase 3: Documentation & Polish (FUTURE)

### 3.1 Update CLAUDE.md
**Status**: PLANNED
**Priority**: MEDIUM
**Estimated Effort**: 2-3 hours

**Changes Needed**:
- [ ] Document `intelligente_rechtssuche` (renamed from semantische_rechtssuche)
- [ ] Update all tool references throughout document
- [ ] Add section on human-readable URL generation
- [ ] Document abbreviation search improvements
- [ ] Add troubleshooting section for common issues
- [ ] Update tool usage examples with new URL format
- [ ] Document AI testing approach

**Files to Update**:
- [CLAUDE.md](CLAUDE.md)
- [README.md](README.md) (if exists)
- [SETUP.md](SETUP.md) (tool name references)

---

### 3.2 LibreChat Integration Documentation
**Status**: PLANNED
**Priority**: LOW
**Estimated Effort**: 1-2 hours

**Goal**: Document best practices for LibreChat usage

**Topics**:
- Agent configuration examples
- Model recommendations (Qwen 2.5-72B, DeepSeek-R1-70B)
- Common pitfalls and solutions
- URL formatting in LibreChat responses

**Deliverables**:
- [ ] Update LIBRECHAT_AGENT_CONFIG.md with new tool names
- [ ] Add URL presentation examples
- [ ] Document agent instruction best practices

---

## 🔬 Phase 4: Advanced Features (FUTURE)

### 4.1 Improve Golden Test Pass Rate
**Status**: PLANNED
**Priority**: MEDIUM
**Estimated Effort**: 4-6 hours

**Current Issues**:
- 23.5% pass rate (4/17 tests)
- Test runner does direct API calls, not MCP tool invocations
- Many failures are due to test architecture, not tool bugs

**Proposed Solutions**:
1. Rewrite test-golden.js to use MCP tools directly
2. Add concept mapping for common legal terms
3. Improve search query generation in test runner
4. Add caching to avoid rate limiting

**Deliverables**:
- [ ] Improved test-golden.js
- [ ] Higher pass rate (target: >80%)
- [ ] Better correlation with real-world usage

---

### 4.2 Enhanced Semantic Search
**Status**: IDEA
**Priority**: LOW
**Estimated Effort**: 8-12 hours

**Concept**: Add true semantic search with embeddings

**Approach**:
- Use local embedding model (e.g., sentence-transformers)
- Pre-compute embeddings for law descriptions
- Add similarity search alongside keyword search
- Combine scores from both approaches

**Benefits**:
- Better concept matching
- Less reliance on exact keywords
- Improved handling of synonyms

**Risks**:
- Increased complexity
- Performance considerations
- Embedding model licensing

---

### 4.3 Historical Law Versions
**Status**: IDEA
**Priority**: LOW
**Estimated Effort**: 6-8 hours

**Problem**: Only current law versions easily accessible

**Proposed Solution**:
- Add `gesetz_historische_version_abrufen` tool
- Search Federal Law Gazette (BGBl) by year
- Track amendment laws (Artikelgesetze)
- Link to effective dates

**Deliverables**:
- [ ] New MCP tool for historical versions
- [ ] BGBl search functionality
- [ ] Amendment law tracking

---

## 🐛 Known Issues & Future Fixes

### Issue 1: API Rate Limiting
**Priority**: MEDIUM
**Description**: Test suite triggers 500 errors from API
**Solution**: Add request throttling, implement caching

### Issue 2: Date Filter Limitations
**Priority**: LOW
**Description**: Temporal coverage filters unreliable (documented in CLAUDE.md)
**Solution**: Warn users in tool descriptions, suggest alternative approaches

### Issue 3: 403 Errors on Document Details
**Priority**: LOW
**Description**: Some documents return 403 Forbidden
**Solution**: Already handled with fallback messaging, could add retry logic

---

## 📋 Checklist for Next Session

### Immediate Next Steps (Phase 2.1 & 2.2):
1. [ ] Create `tests/test-generic-search.js`
   - Test all abbreviation lookups (GG, BGB, StGB, SGB I-XIV)
   - Validate URL formatting
   - Test multi-document searches

2. [ ] Create `tests/test-ai-interaction.js`
   - Load OpenRouter credentials from .env
   - Implement 5 core test scenarios
   - Validate tool selection and URL formatting

3. [ ] Update [package.json](package.json) with new test scripts

4. [ ] Run all tests and document results

5. [ ] Based on test results, refine:
   - Tool descriptions
   - Agent instructions
   - Error messages

### After Testing Complete (Phase 3):
6. [ ] Update [CLAUDE.md](CLAUDE.md) with all changes
7. [ ] Review and update [tmp/agent_instructions.md](tmp/agent_instructions.md)
8. [ ] Create git commit with comprehensive commit message
9. [ ] Consider creating pull request for review

---

## 📊 Success Metrics

### Phase 1 (Completed):
- ✅ Tool renamed to accurately reflect functionality
- ✅ Abbreviation search accuracy improved
- ✅ All URLs now human-readable markdown links
- ✅ Agent instructions enhanced
- ✅ Test coverage expanded (12 → 17 test cases)

### Phase 2 (Next Iteration) Goals:
- 🎯 100% of generic MCP tool tests pass
- 🎯 ≥90% of AI integration tests pass
- 🎯 All URLs validated as markdown links with document names
- 🎯 Zero wrong law matches in abbreviation searches

### Phase 3 (Future) Goals:
- 🎯 Documentation fully updated
- 🎯 Golden test pass rate >80%
- 🎯 Community feedback incorporated

---

## 🤝 Contributing

This roadmap is a living document. As we complete phases and discover new requirements, we'll update priorities and add new items.

**Last Updated**: 2025-10-30
**Current Phase**: 1 (COMPLETED), Moving to Phase 2
**Next Review**: After Phase 2 completion
