#!/usr/bin/env node

// IMPORTANT: This file correctly uses workExample URLs per API design
// The API follows semantic web principles: main @id = work level, workExample @id = expression level
// See: https://docs.rechtsinformationen.bund.de/endpoints/#getLegislation

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import Fuse from 'fuse.js';

const BASE_URL = 'https://testphase.rechtsinformationen.bund.de/v1';

interface SearchResult {
  item: {
    '@type': string;
    documentNumber?: string;
    ecli?: string;
    eli?: string;
    headline?: string;
    name?: string;
    decisionDate?: string;
    legislationDate?: string;
    datePublished?: string;
    temporalCoverage?: string;
    inForce?: boolean;
    fileNumbers?: string[];
    courtType?: string;
    courtName?: string;
    documentType?: string;
    outline?: string;
    judicialBody?: string;
    '@id': string;
    inLanguage?: string;
    abbreviation?: string;
    alternateName?: string;
    workExample?: {
      '@type': string;
      '@id': string;
      legislationIdentifier?: string;
    };
  };
  textMatches?: Array<{
    name: string;
    text: string;
    location?: string;
    '@type': 'SearchResultMatch';
  }>;
  '@type': 'SearchResult';
}

class RechtsinformationenBundDeMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'rechtsinformationen',
        version: '1.4.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'deutsche_gesetze_suchen',
            description: `🇩🇪 **SECONDARY TOOL** - Deutsche Bundesgesetze durchsuchen

**What this tool searches:**
• Federal legislation database at rechtsinformationen.bund.de
• Laws (Gesetze), ordinances (Verordnungen), administrative provisions
• Full-text search in legislation content

**URL Construction:**
Results contain URLs in format:
https://testphase.rechtsinformationen.bund.de/v1/legislation/eli/bund/{agent}/{year}/{naturalIdentifier}/{pointInTime}/{version}/{language}

Example: /v1/legislation/eli/bund/bgbl-1/2006/s2748/2025-05-01/1/deu
These URLs work directly in browsers and API calls.

**When to use:**
✓ Follow-up searches after intelligente_rechtssuche
✓ When you need legislation-only results (excludes case law)
✓ When searching for specific law abbreviations (BEEG, BGB, SGB)

**⚠️ DATABASE COVERAGE LIMITATIONS:**
• **Grundgesetz (GG)**: NOT in database - only laws referencing GG available
• **SGB I-VIII**: NOT in database - SGB IX-XIV available, earlier books missing
• **Historic laws**: Limited coverage, focus on current legislation post-2000
• If a law is not found, it may not be in the testphase database yet

**Limitations:**
⚠️ Date filters (temporalCoverageFrom/To) are unreliable - they may exclude relevant results
⚠️ For amendment questions, DON'T use date filters - search broadly instead

**Parameters:**
• searchTerm: Keywords or law names (required)
• temporalCoverageFrom/To: ISO dates (optional, use with caution)
• limit: Max results, default 10, API max 100

**Usage Priority:**
For initial queries → Use intelligente_rechtssuche first
For legislation-only → Use this tool`,
            inputSchema: {
              type: 'object',
              properties: {
                searchTerm: {
                  type: 'string',
                  description: 'Search term for finding laws (use quotes for exact phrases)',
                },
                temporalCoverageFrom: {
                  type: 'string',
                  description: 'Start date for temporal coverage filter (ISO 8601 format) - WARNING: May exclude relevant results',
                },
                temporalCoverageTo: {
                  type: 'string',
                  description: 'End date for temporal coverage filter (ISO 8601 format) - WARNING: May exclude relevant results',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 5, API max: 100)',
                  default: 5,
                },
              },
              required: ['searchTerm'],
            },
          },
          {
            name: 'rechtsprechung_suchen',
            description: `⚖️ **SECONDARY TOOL** - Deutsche Rechtsprechung durchsuchen

**What this tool searches:**
• German court decisions database at rechtsinformationen.bund.de
• Decisions from federal courts (BGH, BVerfG, BAG, BFH, BSG, BVerwG, etc.)
• Full-text search in court decision content

**URL Construction:**
Results contain URLs with ECLI (European Case Law Identifier):
https://testphase.rechtsinformationen.bund.de/v1/case-law/ecli/de/{court}/{year}/{identifier}

Example: /v1/case-law/ecli/de/bgh/2023/010523
These URLs work directly in browsers and API calls.

**When to use:**
✓ Follow-up searches after intelligente_rechtssuche
✓ When you need case-law-only results (excludes legislation)
✓ When filtering by specific courts (use 'court' parameter)
✓ When searching for Urteile (judgments) or Beschlüsse (decisions)

**Common Courts:**
• BGH - Bundesgerichtshof (Federal Court of Justice)
• BVerfG - Bundesverfassungsgericht (Constitutional Court)
• BAG - Bundesarbeitsgericht (Federal Labour Court)
• BFH - Bundesfinanzhof (Federal Fiscal Court)
• BSG - Bundessozialgericht (Federal Social Court)
• BVerwG - Bundesverwaltungsgericht (Federal Administrative Court)

**Parameters:**
• searchTerm: Keywords or case references (required)
• court: Filter by court abbreviation (optional)
• dateFrom/To: Decision date filters in ISO format (optional)
• documentType: "Urteil" or "Beschluss" (optional)
• limit: Max results, default 10, API max 100

**Usage Priority:**
For initial queries → Use intelligente_rechtssuche first
For court-specific searches → Use this tool`,
            inputSchema: {
              type: 'object',
              properties: {
                searchTerm: {
                  type: 'string',
                  description: 'Search term for finding court decisions',
                },
                court: {
                  type: 'string',
                  description: 'Filter by specific court abbreviation (e.g., BGH, BVerfG, BAG, BFH, BSG, BVerwG)',
                },
                dateFrom: {
                  type: 'string',
                  description: 'Start date filter for decision date (ISO 8601 format: YYYY-MM-DD)',
                },
                dateTo: {
                  type: 'string',
                  description: 'End date filter for decision date (ISO 8601 format: YYYY-MM-DD)',
                },
                documentType: {
                  type: 'string',
                  description: 'Filter by document type (e.g., "Urteil" for judgments, "Beschluss" for decisions)',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 5, API max: 100)',
                  default: 5,
                },
              },
              required: ['searchTerm'],
            },
          },
          {
            name: 'dokument_details_abrufen',
            description: `📄 **RETRIEVAL TOOL** - Vollständigen Dokumenttext abrufen

**What this tool does:**
• Retrieves complete document content from rechtsinformationen.bund.de
• Works with both legislation and case law documents
• Requires specific document identifier from previous search results

**URL/ID Input:**
This tool accepts:
1. Full API URLs from search results (recommended):
   https://testphase.rechtsinformationen.bund.de/v1/legislation/eli/...
   https://testphase.rechtsinformationen.bund.de/v1/case-law/ecli/...

2. Partial paths starting with /v1/:
   /v1/legislation/eli/bund/bgbl-1/2006/s2748/2025-05-01/1/deu
   /v1/case-law/ecli/de/bgh/2023/010523

3. ELI or ECLI identifiers (will be constructed into full path)

**When to use:**
✓ When you have a specific document from search results
✓ When you need the full text (searches only return snippets)
✓ When you need HTML or XML format instead of JSON

**When NOT to use:**
✗ For initial searches (use intelligente_rechtssuche instead)
✗ When you don't have a specific document ID
✗ To browse or discover documents (use search tools instead)

**Limitations:**
⚠️ Some document paths may return 403 Forbidden errors
⚠️ If 403 occurs, use the document web URL in a browser instead
⚠️ Not all historical versions are accessible via API

**Parameters:**
• documentId: Full URL or path from search results (required)
• format: "json" (default), "html", or "xml" (optional)

**Usage Priority:**
Search first → Get results → Use this tool for full text`,
            inputSchema: {
              type: 'object',
              properties: {
                documentId: {
                  type: 'string',
                  description: 'Document ID or URL from search results. Use the "@id" field from search results, or full URL like https://testphase.rechtsinformationen.bund.de/v1/legislation/eli/...',
                },
                format: {
                  type: 'string',
                  description: 'Response format: "json" (default, structured data), "html" (readable format), or "xml" (raw format)',
                  enum: ['html', 'xml', 'json'],
                  default: 'json',
                },
              },
              required: ['documentId'],
            },
          },
          {
            name: 'intelligente_rechtssuche',
            description: `🧠 **PRIMARY TOOL** ⭐ ALWAYS USE THIS FIRST for ANY German legal question ⭐

**What this tool searches:**
• Full-text search across rechtsinformationen.bund.de
• Both legislation (Gesetze) AND case law (Rechtsprechung)
• Intelligent query enhancement with misconception correction

**⚠️ DATABASE COVERAGE LIMITATIONS:**
• **Grundgesetz (GG)**: NOT in database - only laws referencing GG are available
• **SGB I-VIII**: NOT in database - SGB IX-XIV available, earlier books missing
• **Historic laws**: Limited coverage, focus on current legislation post-2000
• **Amendments**: Newer amendment laws well-covered, older may be missing
• If a law is not found, it may not be in the testphase database yet

**Intelligent Features (Automatic):**
✓ English → German translation (e.g., "employee rights" → "Arbeitnehmerrechte")
✓ Misconception correction (e.g., "Überprüfungsantrag" → "Widerspruch")
✓ Legal reference extraction (e.g., detects "§ 15 BEEG" patterns)
✓ Multiple search term execution in parallel
✓ Result prioritization and deduplication

**Data Model Understanding (CRITICAL for answering questions):**
Results follow FRBR model with three levels:
1. **Work** (Abstract): The law as intellectual creation
2. **Expression** (Version): Specific publication with metadata
3. **Manifestation** (Format): HTML links for reading, JSON-LD for metadata

**Metadata Available in Search Results:**
• **Immediately available** (no follow-up needed):
  - legislationDate - When the law was passed/enacted
  - datePublished - When published in Federal Law Gazette (BGBl)
  - name - Full law title
  - abbreviation - Official abbreviation (BGB, StGB, etc.)

• **Requires follow-up call** (use gesetz_per_eli_abrufen):
  - temporalCoverage - Date range when law is/was in force
  - inForce - Current validity status (boolean)
  - Full text content and structure

**Results contain:**
• **HTML links** (Manifestation): [Law Name] for users to read
• **Basic metadata** (Expression): Legislation date, published date immediately visible
• **Detailed metadata**: Use gesetz_per_eli_abrufen for inForce status and temporal coverage

**Example Use Cases:**
• "When was BGB enacted?" → Check legislationDate in results (immediate)
• "When was BGB published?" → Check datePublished in results (immediate)
• "Is SGB IX still valid?" → Use gesetz_per_eli_abrufen for inForce status (follow-up)
• "Show me § 242 StGB" → Use HTML link for law text (immediate)

**What this tool does NOT do:**
✗ Does NOT perform true semantic search with ML embeddings
✗ Does NOT generate semantically similar terms (YOU must provide variations)
✗ Does NOT try multiple query phrasings (YOU must search with different terms)
✗ Does NOT explore related concepts automatically (YOU need multiple searches)
✗ Uses keyword matching + Fuse.js fuzzy search (not neural embeddings)

**AI Agent Responsibilities:**
As the calling agent, YOU must:
1. Provide multiple query variations (synonyms, related terms, different phrasings)
2. Search for law abbreviations separately (BEEG, BGB, SGB, etc.)
3. Try specific § references when mentioned (§ 44 SGB X)
4. Search for amendment laws with different patterns
5. Use specialized tools (deutsche_gesetze_suchen, rechtsprechung_suchen) for follow-up

**Search Strategies for Common Questions:**

Amendment questions:
• "X Änderungsgesetz 2021"
• "Gesetz zur Änderung X 2021"
• "BGBl 2021 X" (Federal Law Gazette)
• Search both enactment year AND effective year

Law interpretation:
• Search law name + specific § reference
• Try both formal name and abbreviation
• Search for related commentary or court decisions

Case law:
• Search topic + "BGH" or court name
• Try legal concepts + "Rechtsprechung"
• Search ECLI or case file numbers if known

**Parameters:**
• query: Your search query in German or English (required)
• threshold: Fuzzy match threshold 0.0-1.0 (default: 0.3, lower = more results)
• limit: Max results (default: 5, API max: 100)

**Usage Pattern:**
1. Start here for ALL legal questions
2. Analyze results for relevant documents
3. Use specialized tools for follow-up (deutsche_gesetze_suchen, rechtsprechung_suchen)
4. Use dokument_details_abrufen for full text of specific documents
5. Try query variations yourself if results insufficient`,
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query in German or English. Can include legal references (§ 15 BEEG), concepts (Elternzeit), or questions. Agent should try multiple variations for comprehensive search.',
                },
                threshold: {
                  type: 'number',
                  description: 'Fuzzy match threshold (0.0 to 1.0, default: 0.3). Lower = more lenient matching, higher = stricter matching.',
                  default: 0.3,
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 5, API max: 100)',
                  default: 5,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'gesetz_per_abkuerzung_abrufen',
            description: `📖 **DIRECT LOOKUP TOOL** - Gesetz direkt per Abkürzung abrufen

**What this tool does:**
• Direct lookup of German federal laws by standard abbreviations
• Bypasses semantic search for exact law retrieval
• Returns the current version of the law with full metadata
• Standard legal research pattern in Germany

**⚠️ DATABASE COVERAGE LIMITATIONS:**
• **Grundgesetz (GG)**: NOT in database - lookup will fail or return wrong law
• **SGB I-VIII**: NOT in database - SGB IX-XIV available, earlier books missing
• **Historic laws**: Limited coverage, focus on current legislation post-2000
• If abbreviation lookup fails, the law may not be in the testphase database

**Supported Abbreviations (if in database):**
Common German federal laws (examples):
• SGB IX, SGB X, SGB XI, SGB XII, SGB XIV (✅ Available)
• SGB I-VIII (❌ NOT Available)
• BGB (Bürgerliches Gesetzbuch) (✅ Available)
• StGB (Strafgesetzbuch) (✅ Available)
• GG (Grundgesetz) (❌ NOT Available)
• AufenthG, BetrVG, KSchG, BEEG, BUrlG, ArbZG (Check availability)
• And many more...

**When to use:**
✓ When you know the exact law abbreviation (e.g., "SGB I", "BGB")
✓ For direct access without semantic search uncertainty
✓ When user asks for a specific law by its common name
✓ To avoid irrelevant search results

**When NOT to use:**
✗ For broad legal research (use intelligente_rechtssuche)
✗ When searching for court decisions (use rechtsprechung_suchen)
✗ For full-text content search (use deutsche_gesetze_suchen)

**Parameters:**
• abbreviation: Standard German law abbreviation (required)
  Examples: "SGB I", "BGB", "StGB", "GG", "AufenthG", "KSchG"

**Returns:**
• Full law name and abbreviation
• ELI identifier
• Law type classification
• Current version date
• Complete table of contents (if available)
• Direct HTML and JSON URLs

**Example Usage:**
Input: { abbreviation: "SGB I" }
Output: Sozialgesetzbuch (SGB) Erstes Buch (I) - Allgemeiner Teil

**Usage Priority:**
For exact law lookup by abbreviation → Use this tool FIRST
For content search within laws → Use intelligente_rechtssuche or deutsche_gesetze_suchen`,
            inputSchema: {
              type: 'object',
              properties: {
                abbreviation: {
                  type: 'string',
                  description: 'German law abbreviation (e.g., "SGB I", "BGB", "StGB", "GG", "AufenthG", "KSchG", "BEEG")',
                },
              },
              required: ['abbreviation'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'deutsche_gesetze_suchen':
            return await this.searchLegislation(args);
          case 'rechtsprechung_suchen':
            return await this.searchCaseLaw(args);
          case 'dokument_details_abrufen':
            return await this.getDocumentDetails(args);
          case 'intelligente_rechtssuche':
            return await this.intelligentLegalSearch(args);
          case 'gesetz_per_abkuerzung_abrufen':
            return await this.getLawByAbbreviation(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error('MCP Server Error:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error in ${name}: ${error instanceof Error ? error.message : 'Unknown error occurred'}\n\nDebug info: ${JSON.stringify(args, null, 2)}`,
            },
          ],
        };
      }
    });
  }

  private async searchLegislation(args: any) {
    const { searchTerm, temporalCoverageFrom, temporalCoverageTo, limit = 5 } = args;

    // Convert limit to number if it's a string (for model compatibility)
    const numericLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;

    const params = new URLSearchParams();
    params.append('searchTerm', searchTerm);
    if (temporalCoverageFrom) params.append('temporalCoverageFrom', temporalCoverageFrom);
    if (temporalCoverageTo) params.append('temporalCoverageTo', temporalCoverageTo);
    params.append('size', Math.min(numericLimit, 100).toString()); // API max is 100

    const response = await axios.get(`${BASE_URL}/legislation`, { params });
    
    return {
      content: [
        {
          type: 'text',
          text: `Found ${response.data.member?.length || 0} German laws matching "${searchTerm}":\n\n${this.formatLegislationResults(response.data)}`,
        },
      ],
    };
  }

  private async searchCaseLaw(args: any) {
    const { searchTerm, court, dateFrom, dateTo, documentType, limit = 5 } = args;

    // Convert limit to number if it's a string (for model compatibility)
    const numericLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;

    const params = new URLSearchParams();
    params.append('searchTerm', searchTerm);
    if (court) params.append('court', court);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    if (documentType) params.append('type', documentType);
    params.append('limit', numericLimit.toString());

    const response = await axios.get(`${BASE_URL}/case-law`, { params });
    
    return {
      content: [
        {
          type: 'text',
          text: `Found ${response.data.member?.length || 0} court decisions matching "${searchTerm}":\n\n${this.formatCaseLawResults(response.data)}`,
        },
      ],
    };
  }

  private async getDocumentDetails(args: any) {
    const { documentId, format = 'json' } = args;

    // Handle both API paths and full URLs
    let apiPath = documentId;
    if (documentId.startsWith('http')) {
      // Extract API path from full URL
      const url = new URL(documentId);

      // Handle /norms/ URLs (these are user-facing URLs, not API paths)
      if (url.pathname.startsWith('/norms/')) {
        // /norms/ URLs map to /v1/legislation/ endpoints
        // Extract the ELI path after /norms/
        // Example: /norms/eli/bund/bgbl-1/2006/s2748/2025-05-01/1/deu
        // becomes: /v1/legislation/eli/bund/bgbl-1/2006/s2748/2025-05-01/1/deu
        apiPath = url.pathname.replace('/norms/', '/v1/legislation/');
      } else if (url.pathname.startsWith('/case-law/')) {
        // Already correct API path format
        apiPath = url.pathname;
      } else if (url.pathname.startsWith('/v1/')) {
        // Already an API path
        apiPath = url.pathname;
      } else if (url.pathname.startsWith('/ecli/')) {
        // ECLI URLs need to be converted to /v1/case-law/ format
        // But we don't have enough info, so return helpful error
        throw new Error('ECLI URLs not directly supported. Please use the document number or search for the case first.');
      } else {
        // Use the path as-is and hope for the best
        apiPath = url.pathname;
      }
    } else if (!documentId.startsWith('/v1/')) {
      // If it's not a URL and doesn't start with /v1/, assume it's a document number
      // Try to determine the type and construct the correct path
      if (documentId.includes('eli/bund/')) {
        apiPath = `/v1/legislation/${documentId}`;
      } else {
        // Assume it's a case law document number
        apiPath = `/v1/case-law/${documentId}`;
      }
    }

    const headers: any = {};
    if (format === 'html') headers['Accept'] = 'text/html';
    if (format === 'xml') headers['Accept'] = 'application/xml';

    try {
      // Construct the full URL, avoiding double /v1/ prefix
      const fullUrl = apiPath.startsWith('/v1/')
        ? `https://testphase.rechtsinformationen.bund.de${apiPath}`
        : `${BASE_URL}${apiPath}`;

      const response = await axios.get(fullUrl, { headers });

      return {
        content: [
          {
            type: 'text',
            text: `Document details for ${documentId}:\n\n${this.formatDocumentDetails(response.data, format)}`,
          },
        ],
      };
    } catch (error: any) {
      if (error.response?.status === 403) {
        // 403 Forbidden - provide helpful guidance
        return {
          content: [
            {
              type: 'text',
              text: `❌ Access forbidden (403) for document: ${documentId}

⚠️ **The API does not support direct access to this document path.**

💡 **What you can do instead:**
1. The search results already contain the most relevant content in the text matches
2. For the full document text, use the web URL directly in a browser:
   ${documentId.startsWith('http') ? documentId : `https://testphase.rechtsinformationen.bund.de${apiPath}`}

3. Try searching for more specific terms to get richer text matches

**API Path attempted:** ${apiPath.startsWith('/v1/') ? `https://testphase.rechtsinformationen.bund.de${apiPath}` : `${BASE_URL}${apiPath}`}

**Note:** The rechtsinformationen.bund.de API primarily provides search and metadata access. Full document content is best accessed via the web interface.`,
            },
          ],
        };
      }
      throw error; // Re-throw other errors
    }
  }

  private async intelligentLegalSearch(args: any) {
    const { query, threshold = 0.3, limit = 5 } = args;

    // Convert parameters to correct types if they're strings (for model compatibility)
    const numericThreshold = typeof threshold === 'string' ? parseFloat(threshold) : threshold;
    const numericLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    
    // STEP 0: Detect language and translate English to German
    const germanQuery = this.translateEnglishToGerman(query);
    const actualQuery = germanQuery !== query ? germanQuery : query;
    
    // STEP 1: Extract and validate legal references
    const legalReferences = this.extractLegalReferences(actualQuery);
    
    // STEP 2: Map concepts to correct legal terms
    const conceptMappings = this.mapLegalConcepts(actualQuery);
    
    // STEP 3: Generate intelligent search terms
    const intelligentSearchTerms = [
      ...legalReferences.validReferences,
      ...conceptMappings.correctedTerms,
      ...this.expandLegalTerms(actualQuery)
    ].filter(term => term && term.length > 2);
    
    let allDocuments: any[] = [];
    let searchResults: any[] = [];
    
    // STEP 4: Search with validated legal references first (highest priority)
    for (const validRef of legalReferences.validReferences.slice(0, 3)) {
      try {
        const response = await axios.get(`${BASE_URL}/document`, {
          params: { searchTerm: validRef, size: 10 }
        });
        
        if (response.data.member && response.data.member.length > 0) {
          searchResults.push({ term: validRef, results: response.data.member, priority: 'high' });
          const docs = response.data.member.map((sr: SearchResult) => ({
            title: sr.item?.headline || sr.item?.name || '',
            summary: sr.textMatches?.map((tm) => tm.text).join(' ') || '',
            content: sr.textMatches?.map((tm) => tm.text).join(' ') || '',
            originalResult: sr,
            searchTerm: validRef,
            priority: 'high'
          }));
          allDocuments.push(...docs);
        }
      } catch (error) {
        // Continue with other search terms if one fails
      }
    }
    
    // STEP 5: Search with corrected concept terms (medium priority)
    for (const correctedTerm of conceptMappings.correctedTerms.slice(0, 2)) {
      try {
        const response = await axios.get(`${BASE_URL}/document`, {
          params: { searchTerm: correctedTerm, size: 10 }
        });

        if (response.data.member && response.data.member.length > 0) {
          searchResults.push({ term: correctedTerm, results: response.data.member, priority: 'medium' });
          const docs = response.data.member.map((sr: SearchResult) => ({
            title: sr.item?.headline || sr.item?.name || '',
            summary: sr.textMatches?.map((tm) => tm.text).join(' ') || '',
            content: sr.textMatches?.map((tm) => tm.text).join(' ') || '',
            originalResult: sr,
            searchTerm: correctedTerm,
            priority: 'medium'
          }));
          allDocuments.push(...docs);
        }
      } catch (error) {
        // Continue with other search terms if one fails
      }
    }

    // STEP 6: Fallback - search with original query if no results yet
    if (allDocuments.length === 0) {
      try {
        const response = await axios.get(`${BASE_URL}/document`, {
          params: { searchTerm: actualQuery, size: numericLimit }
        });

        if (response.data.member && response.data.member.length > 0) {
          searchResults.push({ term: actualQuery, results: response.data.member, priority: 'low' });
          const docs = response.data.member.map((sr: SearchResult) => ({
            title: sr.item?.headline || sr.item?.name || '',
            summary: sr.textMatches?.map((tm) => tm.text).join(' ') || '',
            content: sr.textMatches?.map((tm) => tm.text).join(' ') || '',
            originalResult: sr,
            searchTerm: actualQuery,
            priority: 'low'
          }));
          allDocuments.push(...docs);
        }
      } catch (error) {
        // Continue even if fallback fails
      }
    }

    // Remove duplicates based on document ID
    const uniqueDocuments = allDocuments.filter((doc, index, self) => 
      index === self.findIndex(other => 
        other.originalResult.item?.documentNumber === doc.originalResult.item?.documentNumber ||
        other.originalResult.item?.['@id'] === doc.originalResult.item?.['@id']
      )
    );
    
    if (uniqueDocuments.length === 0) {
      // Prepare translation info for display
      const translationInfo = germanQuery !== query ? `\n🌐 **Query translated from English**: "${query}" → "${germanQuery}"` : '';

      // Generate helpful suggestions based on the query
      const suggestions = [];
      if (actualQuery.match(/§\s*\d+/)) {
        suggestions.push('Try searching for the law abbreviation (e.g., "BEEG", "BGB", "SGB")');
      } else {
        suggestions.push('Try searching with specific § references if known (e.g., "§ 15 BEEG")');
      }
      suggestions.push('Try broader search terms (e.g., just the law name or main topic)');
      suggestions.push('Try law abbreviations: BEEG, BGB, SGB, StGB, ZPO, etc.');

      return {
        content: [{
          type: 'text',
          text: `🔍 Intelligent Legal Search Results for "${query}"${translationInfo}\n\n❌ No documents found despite trying:\n• Legal references: ${legalReferences.validReferences.join(', ') || 'none detected'}\n• Concept mappings: ${conceptMappings.correctedTerms.slice(0, 3).join(', ') || 'none'}\n• Direct search: "${actualQuery}"\n\n💡 Suggestions:\n${suggestions.map(s => `• ${s}`).join('\n')}`
        }]
      };
    }
    
    // Sort documents by priority first, then use fuzzy matching
    const prioritySort = (a: any, b: any) => {
      const priorityOrder: { [key: string]: number } = { 'high': 3, 'medium': 2, 'low': 1 };
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    };

    uniqueDocuments.sort(prioritySort);

    // IMPROVED: Better Fuse.js configuration for exact title matches
    // Issue: "Sozialgesetzbuch Erstes Buch Allgemeiner Teil" was returning 0.014 similarity
    // Solution: Boost title weight significantly and use stricter threshold
    const fuse = new Fuse(uniqueDocuments, {
      keys: [
        { name: 'title', weight: 0.7 },      // Increased from 0.4 - titles are most important
        { name: 'summary', weight: 0.2 },    // Reduced from 0.4 - content is secondary
        { name: 'content', weight: 0.1 }     // Reduced from 0.2 - least important
      ],
      threshold: numericThreshold,           // Use provided threshold (default 0.3, not 0.6)
      includeScore: true,
      ignoreLocation: true,                  // NEW: Don't penalize matches at end of string
      findAllMatches: true,                  // NEW: Find all matches, not just first
      minMatchCharLength: 2,                 // NEW: Minimum match length
      useExtendedSearch: false,              // Keep simple for now
    });

    const semanticResults = fuse.search(actualQuery);

    // IMPROVED: Better fallback and minimum score filtering
    let finalResults: any[];
    if (semanticResults.length > 0) {
      // Filter out poor matches (score > 0.7 means not relevant enough)
      const goodMatches = semanticResults.filter(r => (r.score || 0) <= 0.7);

      if (goodMatches.length > 0) {
        finalResults = goodMatches.slice(0, numericLimit);
      } else {
        // All matches were poor, return top priority documents instead
        finalResults = uniqueDocuments.slice(0, numericLimit).map(doc => ({
          item: doc,
          score: 0.85  // Mark as low confidence
        }));
      }
    } else {
      // No fuzzy matches, return priority documents
      finalResults = uniqueDocuments.slice(0, numericLimit).map(doc => ({
        item: doc,
        score: 0.8
      }));
    }
    
    // Prepare translation info for display
    const translationInfo = germanQuery !== query ? `\n🌐 **Query translated from English**: "${query}" → "${germanQuery}"` : '';
    
    return {
      content: [
        {
          type: 'text',
          text: `🔍 Intelligent Legal Search Results for "${query}"${translationInfo}\n\n✅ Found ${finalResults.length} documents from ${uniqueDocuments.length} total\n📚 Search strategy: ${legalReferences.validReferences.length > 0 ? 'Legal references + ' : ''}${conceptMappings.correctedTerms.length > 0 ? 'Concept mapping' : 'Standard search'}\n\n${this.formatEnhancedSemanticResults(finalResults, conceptMappings.explanations)}`,
        },
      ],
    };
  }
  
  private translateEnglishToGerman(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // Check if query appears to be in English (contains English legal terms)
    const englishIndicators = [
      'employee', 'employer', 'employment', 'dismissal', 'termination', 'firing',
      'data protection', 'privacy', 'rights', 'law', 'legal', 'court', 'decision',
      'company', 'restructuring', 'redundancy', 'layoff', 'unemployment',
      'social security', 'benefits', 'welfare', 'pension', 'insurance',
      'contract', 'agreement', 'obligation', 'liability', 'damages',
      'trademark', 'copyright', 'patent', 'intellectual property',
      'rental', 'tenant', 'landlord', 'lease', 'housing',
      'protection', 'compensation', 'claim', 'appeal', 'hearing'
    ];
    
    const hasEnglishTerms = englishIndicators.some(term => lowerQuery.includes(term));
    
    if (!hasEnglishTerms) {
      return query; // Already German or not English
    }
    
    // English to German legal translation map
    const translations: { [key: string]: string } = {
      // Employment law
      'employee rights': 'Arbeitnehmerrechte',
      'employee': 'Arbeitnehmer',
      'employer': 'Arbeitgeber', 
      'employment': 'Beschäftigung',
      'dismissal': 'Kündigung',
      'termination': 'Kündigung',
      'firing': 'Entlassung',
      'redundancy': 'betriebsbedingte Kündigung',
      'layoff': 'Entlassung',
      'company restructuring': 'Betriebsumstrukturierung',
      'works council': 'Betriebsrat',
      'participation': 'Mitbestimmung',
      'protection': 'Schutz',
      'dismissal protection': 'Kündigungsschutz',
      
      // Data protection
      'data protection': 'Datenschutz',
      'privacy': 'Datenschutz',
      'personal data': 'personenbezogene Daten',
      
      // Social security
      'social security': 'Sozialversicherung',
      'unemployment benefits': 'Arbeitslosengeld',
      'unemployment': 'Arbeitslosigkeit',
      'benefits': 'Leistungen',
      'welfare': 'Sozialhilfe',
      'pension': 'Rente',
      'insurance': 'Versicherung',
      
      // Contract law
      'contract': 'Vertrag',
      'agreement': 'Vereinbarung',
      'obligation': 'Verpflichtung',
      'liability': 'Haftung',
      'damages': 'Schadenersatz',
      'compensation': 'Entschädigung',
      
      // Intellectual property
      'trademark': 'Marke',
      'copyright': 'Urheberrecht',
      'patent': 'Patent',
      'intellectual property': 'geistiges Eigentum',
      
      // Housing/rental
      'rental': 'Miete',
      'tenant': 'Mieter',
      'landlord': 'Vermieter',
      'lease': 'Mietvertrag',
      'housing': 'Wohnung',
      'rent increase': 'Mieterhöhung',
      
      // Legal procedures
      'court': 'Gericht',
      'decision': 'Entscheidung',
      'judgment': 'Urteil',
      'appeal': 'Berufung',
      'hearing': 'Anhörung',
      'claim': 'Anspruch',
      'application': 'Antrag',
      'proceeding': 'Verfahren',
      
      // General legal terms
      'law': 'Gesetz',
      'legal': 'rechtlich',
      'rights': 'Rechte',
      'federal': 'Bundes',
      'regulation': 'Verordnung',
      'administration': 'Verwaltung',
      'authority': 'Behörde'
    };
    
    let translatedQuery = query;
    
    // Apply translations (longer phrases first to avoid partial matches)
    const sortedKeys = Object.keys(translations).sort((a, b) => b.length - a.length);
    
    for (const englishTerm of sortedKeys) {
      const germanTerm = translations[englishTerm];
      const regex = new RegExp(`\\b${englishTerm}\\b`, 'gi');
      translatedQuery = translatedQuery.replace(regex, germanTerm);
    }
    
    return translatedQuery;
  }
  
  private extractLegalReferences(query: string): { validReferences: string[], invalidReferences: string[] } {
    const validReferences: string[] = [];
    const invalidReferences: string[] = [];
    
    // Extract § references with common patterns
    const paragraphPatterns = [
      /§\s*(\d+[a-z]?)\s+(SGB\s*[IVX]*\d*|BGB|StGB|GG|VwVfG|BEEG|EStG|UStG|HGB|ZPO|StPO)/gi,
      /(SGB\s*[IVX]*\d*|BGB|StGB|GG|VwVfG|BEEG|EStG|UStG|HGB|ZPO|StPO)\s*§?\s*(\d+[a-z]?)/gi,
      /Art\.?\s*(\d+[a-z]?)\s*(GG|EMRK)/gi
    ];
    
    for (const pattern of paragraphPatterns) {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        if (match[1] && match[2]) {
          // Format: § XX LAW or LAW § XX
          const section = match[1] || match[2];
          const law = match[2] || match[1];
          const reference = `§ ${section} ${law}`.replace(/\s+/g, ' ').trim();
          validReferences.push(reference);
        }
      }
    }
    
    // Also extract just the law abbreviations
    const lawAbbreviations = query.match(/(SGB\s*[IVX]*\d*|BGB|StGB|GG|VwVfG|BEEG|EStG|UStG|HGB|ZPO|StPO)/gi) || [];
    validReferences.push(...lawAbbreviations.map(law => law.replace(/\s+/g, ' ').trim()));
    
    // Remove duplicates
    const uniqueValidRefs = [...new Set(validReferences)];
    
    // Debug logging can be enabled here if needed
    
    return {
      validReferences: uniqueValidRefs,
      invalidReferences
    };
  }

  private mapLegalConcepts(query: string): { correctedTerms: string[], explanations: string[] } {
    const correctedTerms: string[] = [];
    const explanations: string[] = [];
    const lowerQuery = query.toLowerCase();

    // IMPROVED: Add Sozialgesetzbuch alias expansion
    // Issue: Users search for "Sozialgesetzbuch Erstes Buch" but index may have "SGB I"
    // Solution: Add multiple aliases for SGB searches
    const sgbAliases: { [key: string]: string[] } = {
      'sozialgesetzbuch erstes buch': ['SGB I', 'SGB 1', 'Sozialgesetzbuch (SGB) Erstes Buch'],
      'sozialgesetzbuch zweites buch': ['SGB II', 'SGB 2', 'Sozialgesetzbuch (SGB) Zweites Buch'],
      'sozialgesetzbuch drittes buch': ['SGB III', 'SGB 3', 'Sozialgesetzbuch (SGB) Drittes Buch'],
      'sozialgesetzbuch viertes buch': ['SGB IV', 'SGB 4', 'Sozialgesetzbuch (SGB) Viertes Buch'],
      'sozialgesetzbuch fünftes buch': ['SGB V', 'SGB 5', 'Sozialgesetzbuch (SGB) Fünftes Buch'],
      'sozialgesetzbuch sechstes buch': ['SGB VI', 'SGB 6', 'Sozialgesetzbuch (SGB) Sechstes Buch'],
      'sozialgesetzbuch siebtes buch': ['SGB VII', 'SGB 7', 'Sozialgesetzbuch (SGB) Siebtes Buch'],
      'sozialgesetzbuch achtes buch': ['SGB VIII', 'SGB 8', 'Sozialgesetzbuch (SGB) Achtes Buch'],
      'sozialgesetzbuch neuntes buch': ['SGB IX', 'SGB 9', 'Sozialgesetzbuch (SGB) Neuntes Buch'],
      'sozialgesetzbuch zehntes buch': ['SGB X', 'SGB 10', 'Sozialgesetzbuch (SGB) Zehntes Buch'],
      'sozialgesetzbuch elftes buch': ['SGB XI', 'SGB 11', 'Sozialgesetzbuch (SGB) Elftes Buch'],
      'sozialgesetzbuch zwölftes buch': ['SGB XII', 'SGB 12', 'Sozialgesetzbuch (SGB) Zwölftes Buch'],
    };

    // Check for SGB aliases
    for (const [pattern, aliases] of Object.entries(sgbAliases)) {
      if (lowerQuery.includes(pattern)) {
        correctedTerms.push(...aliases);
        explanations.push(`"${pattern}" expanded to: ${aliases.join(', ')}`);
      }
    }

    // Concept mapping for common misunderstandings
    const conceptMap = {
      // Administrative procedure concepts
      'überprüfungsantrag': ['Widerspruch', 'Überprüfung', 'Nachprüfung', 'Verwaltungsverfahren'],
      'überprüfung': ['Widerspruch', 'Nachprüfung', 'Verwaltungsverfahren'],
      'antrag überprüfung': ['Widerspruch', 'Überprüfungsverfahren'],
      
      // SGB concepts
      'arbeitslosengeld überprüfung': ['SGB III Widerspruch', 'SGB II Widerspruch', 'Bescheid Überprüfung'],
      'bürgergeld überprüfung': ['SGB II Widerspruch', 'SGB II Bescheid', 'Leistungsbescheid'],
      'hartz iv überprüfung': ['SGB II Widerspruch', 'SGB II Bescheid'],
      
      // Administrative acts concepts  
      'verwaltungsakt überprüfung': ['Widerspruch', 'Rücknahme', 'Widerruf', '§ 44 SGB X', '§ 45 SGB X'],
      'bescheid überprüfung': ['Widerspruch', 'Rücknahme', 'Widerruf', 'SGB X'],
      'bescheid korrigieren': ['Rücknahme', 'Widerruf', '§ 44 SGB X', '§ 45 SGB X'],
      
      // Court procedures
      'gericht überprüfung': ['Klage', 'Berufung', 'Revision', 'Rechtsmittel'],
      'urteil überprüfung': ['Berufung', 'Revision', 'Rechtsmittel'],
      
      // Social law specific
      'jobcenter überprüfung': ['SGB II Widerspruch', 'Leistungsbescheid', '§ 32 SGB II'],
      'sanktionen überprüfung': ['SGB II Widerspruch', 'Sanktionsbescheid'],
      
      // Rental law
      'miete überprüfung': ['Mieterhöhung', 'Betriebskosten', 'Mietminderung'],
      'mietvertrag überprüfung': ['Mietrecht', 'BGB Miete'],
      'mieterhöhungsantrag': ['§ 558 BGB', 'Mieterhöhung', 'Kappungsgrenze', 'Mietspiegel'],
      'miete erhöhen': ['§ 558 BGB', 'Mieterhöhung', 'Modernisierung'],
      
      // Employment law
      'kündigungsschutzantrag': ['Kündigungsschutzklage', '§ 4 KSchG', '§ 13 KSchG', 'Arbeitsgerichtliches Verfahren'],
      'kündigung anfechten': ['Kündigungsschutzklage', 'KSchG', 'Arbeitsgericht'],
      'entlassung überprüfung': ['Kündigungsschutzklage', 'KSchG'],
      
      // Social assistance law
      'sozialhilfeantrag': ['§ 19 SGB XII', 'Hilfe zum Lebensunterhalt', 'Grundsicherung', 'Antragsverfahren SGB XII'],
      'grundsicherung antrag': ['SGB XII', 'Hilfe zum Lebensunterhalt'],
      'sozialhilfe beantragen': ['§ 19 SGB XII', 'Grundsicherung'],
      
      // General procedure terms
      'einspruch': ['Widerspruch', 'Rechtsbehelf'],
      'beschwerde': ['Widerspruch', 'Rechtsmittel'],
      'revision': ['Rechtsmittel', 'Berufung']
    };
    
    // Check for concept matches
    for (const [concept, corrections] of Object.entries(conceptMap)) {
      if (lowerQuery.includes(concept)) {
        correctedTerms.push(...corrections);
        explanations.push(`"${concept}" mapped to: ${corrections.join(', ')}`);
      }
    }
    
    // Specific misconception corrections for common legal errors
    if (lowerQuery.includes('§ 44') || lowerQuery.includes('paragraph 44')) {
      if (lowerQuery.includes('sgb x') || lowerQuery.includes('sgb 10')) {
        correctedTerms.push('§ 44 SGB X Rücknahme', 'Verwaltungsakt Rücknahme', 'rechtswidriger Verwaltungsakt');
        explanations.push('§ 44 SGB X is about "Rücknahme" (withdrawal) of unlawful administrative acts');
      }
    }
    
    // BGB § 535 rental law misconception
    if (lowerQuery.includes('§ 535') && lowerQuery.includes('mieterhöhung')) {
      correctedTerms.push('§ 558 BGB', 'Mieterhöhung', 'Kappungsgrenze', 'Mietspiegel');
      explanations.push('§ 535 BGB defines basic rental duties. For rent increases, see § 558 BGB');
    }
    
    // KSchG § 1 employment law misconception  
    if (lowerQuery.includes('§ 1') && lowerQuery.includes('kschg') && lowerQuery.includes('antrag')) {
      correctedTerms.push('Kündigungsschutzklage', '§ 4 KSchG', '§ 13 KSchG', 'Arbeitsgericht');
      explanations.push('§ 1 KSchG defines scope of protection. For dismissal procedures, see § 4 KSchG and court proceedings');
    }
    
    // SGB XII § 27 social assistance misconception
    if (lowerQuery.includes('§ 27') && lowerQuery.includes('sgb xii') && lowerQuery.includes('antrag')) {
      correctedTerms.push('§ 19 SGB XII', 'Hilfe zum Lebensunterhalt', 'Grundsicherung');
      explanations.push('§ 27 SGB XII is about care benefits. For general social assistance applications, see § 19 SGB XII');
    }
    
    // Remove duplicates and filter out empty terms
    const uniqueTerms = [...new Set(correctedTerms)].filter(term => term && term.length > 2);
    
    // Debug logging can be enabled here if needed
    
    return {
      correctedTerms: uniqueTerms,
      explanations
    };
  }

  private expandLegalTerms(query: string): string[] {
    const expansions: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Jobcenter related terms
    if (lowerQuery.includes('jobcenter') || lowerQuery.includes('termin')) {
      expansions.push('Meldeversäumnis', 'SGB II 32', '§ 32 SGB II');
    }

    // Sanction related terms
    if (lowerQuery.includes('sanktion') || lowerQuery.includes('konsequenz')) {
      expansions.push('Pflichtverletzung', 'Minderung', 'Bürgergeld');
    }

    // Benefits related terms
    if (lowerQuery.includes('bürgergeld') || lowerQuery.includes('arbeitslosengeld')) {
      expansions.push('SGB II', 'Leistung', 'Bezug');
    }

    // NEW: Decompose German compound words
    // Many legal terms are compounds that need to be broken down for better search
    const words = query.split(/\s+/);
    for (const word of words) {
      const lowerWord = word.toLowerCase();

      // Only process words longer than 10 chars (likely compounds)
      if (lowerWord.length > 10) {
        // Common legal suffixes to remove
        const suffixes = [
          { pattern: /antrag$/i, replacement: '' },           // Mieterhöhungsantrag → Mieterhöhung
          { pattern: /verfahren$/i, replacement: '' },        // Kündigungsverfahren → Kündigung
          { pattern: /klage$/i, replacement: '' },            // Kündigungsschutzklage → Kündigungsschutz
          { pattern: /gesetz$/i, replacement: '' },           // Mutterschutzgesetz → Mutterschutz (but keep short ones)
          { pattern: /verordnung$/i, replacement: '' },       // Elternzeitverordnung → Elternzeit
        ];

        for (const { pattern, replacement } of suffixes) {
          const withoutSuffix = lowerWord.replace(pattern, replacement);

          // Only add if we actually removed something meaningful (>5 chars remaining)
          if (withoutSuffix !== lowerWord && withoutSuffix.length > 5) {
            // Capitalize first letter to match German noun capitalization
            const capitalized = withoutSuffix.charAt(0).toUpperCase() + withoutSuffix.slice(1);
            expansions.push(capitalized);
          }
        }

        // Special handling for specific compound patterns
        if (lowerWord.includes('mieterhöhung')) {
          expansions.push('Mieterhöhung', '§ 558 BGB', 'Miete');
        }
        if (lowerWord.includes('kündigungsschutz')) {
          expansions.push('Kündigungsschutz', 'KSchG', 'Kündigung');
        }
        if (lowerWord.includes('sozialhilfe')) {
          expansions.push('Sozialhilfe', 'SGB XII', '§ 19 SGB XII');
        }
        if (lowerWord.includes('elternzeit')) {
          expansions.push('Elternzeit', 'BEEG', '§ 15 BEEG');
        }
      }
    }

    // Remove duplicates and filter empty
    return [...new Set(expansions)].filter(term => term && term.length > 0);
  }

  /**
   * Generate human-readable HTML URL from document data
   *
   * Converts API JSON URLs to HTML viewer URLs:
   * - Legislation: /v1/legislation/eli/... → /norms/eli/...
   * - Case Law: /v1/case-law/... → /case-law/...
   */
  private generateHumanReadableUrl(doc: any): string {
    // For legislation - use workExample for the correct versioned URL
    if (doc['@type'] === 'Legislation') {
      // Prefer workExample which has the full versioned path
      const documentUrl = doc.workExample?.['@id'] || doc['@id'] || '';

      // Convert /v1/legislation/eli/... to /norms/eli/...
      if (documentUrl.includes('/v1/legislation/eli/')) {
        return `https://testphase.rechtsinformationen.bund.de${documentUrl.replace('/v1/legislation/', '/norms/')}`;
      }

      // Fallback for non-ELI legislation URLs
      return `https://testphase.rechtsinformationen.bund.de${documentUrl.replace('/v1', '')}`;
    }

    // For case law - use ECLI format or document path
    if (doc['@type'] === 'CaseLaw' || doc.ecli) {
      if (doc.ecli) {
        // ECLI format: convert to /case-law/ecli/... path
        return `https://testphase.rechtsinformationen.bund.de/case-law/ecli/${doc.ecli}`;
      }
      // Standard document path
      const documentUrl = doc['@id'] || '';
      return `https://testphase.rechtsinformationen.bund.de${documentUrl.replace('/v1', '')}`;
    }

    // Fallback for other document types
    const documentUrl = doc['@id'] || '';
    return `https://testphase.rechtsinformationen.bund.de${documentUrl.replace('/v1', '')}`;
  }

  /**
   * Format document as markdown link with name
   */
  private formatDocumentLink(doc: any): string {
    const name = doc.headline || doc.name || 'Untitled Document';
    const url = this.generateHumanReadableUrl(doc);
    return `[${name}](${url})`;
  }

  private formatLegislationResults(data: any): string {
    if (!data.member || data.member.length === 0) {
      return 'No legislation found.';
    }

    const sourceHeader = `\n🏛️ **OFFICIAL GERMAN FEDERAL LEGISLATION - MUST CITE** (rechtsinformationen.bund.de)\n${'='.repeat(80)}\n⚠️ **IMPORTANT INSTRUCTIONS FOR YOUR RESPONSE:**
1. Base your answer ONLY on the information provided below
2. Include ALL URLs listed at the bottom in your "Quellen" or "Sources" section
3. Cite specific § references (e.g., "§ 15 BEEG") in your answer
4. DO NOT add external knowledge not found in these sources

`;
    
    const results = data.member.map((searchResult: SearchResult, index: number) => {
      const law = searchResult.item;
      const textMatches = searchResult.textMatches || [];
      
      // Extract relevant text matches by category
      const relevantTexts = textMatches.reduce((acc, match) => {
        acc[match.name] = match.text;
        return acc;
      }, {} as any);
      
      // Look for specific legal references (§ sections)
      const allContent = textMatches.map(m => m.text || '').join(' ');
      const paragraphMatches = allContent.match(/§\s*\d+[a-z]?(\s*(Abs\.?|Absatz)\s*\d+)?(\s*(S\.?|Satz)\s*\d+)?\s*(SGB|BGB|StGB|GG|VwVfG|BEEG|EStG)\s*[IVX]*\d*/gi) || [];
      
      // CORRECT API USAGE: Use workExample for expression-level (concrete document) access
      // Main item['@id'] = work level (abstract law concept): "/v1/legislation/eli/bund/bgbl-1/2007/s2942/regelungstext-1"
      // workExample['@id'] = expression level (concrete version): "/v1/legislation/eli/bund/bgbl-1/2007/s2942/2024-08-20/1/deu/regelungstext-1"
      // This follows semantic web design principles per API documentation
      let documentUrl = law['@id'];
      if (law.workExample && law.workExample['@id']) {
        documentUrl = law.workExample['@id']; // Contains complete versioned path
      }
      
      // Construct both API URL (JSON) and Web URL (HTML)
      const apiUrl = `https://testphase.rechtsinformationen.bund.de${documentUrl}`;

      // Try to get HTML URL from workExample encoding field
      let htmlUrl = apiUrl; // Fallback to API URL
      const workExample = law.workExample as any;
      if (workExample && workExample.encoding) {
        const htmlEncoding = workExample.encoding.find((enc: any) =>
          enc.encodingFormat === 'text/html' && enc.contentUrl
        );
        if (htmlEncoding) {
          htmlUrl = `https://testphase.rechtsinformationen.bund.de${htmlEncoding.contentUrl}`;
        }
      }

      // Create reference information for the user
      let referenceInfo = `${law.eli || law.documentNumber || 'Unknown ID'}`;
      if (law.eli && law.eli.includes('bgbl')) {
        const eliMatch = law.eli.match(/eli\/bund\/bgbl-([IVX]+)\/(\d+)\/s(\d+)/);
        if (eliMatch) {
          const [, roman, year, page] = eliMatch;
          referenceInfo = `Bundesgesetzblatt ${year} Teil ${roman} S. ${page}`;
        }
      }
      
      // Generate human-readable markdown link
      const docLink = this.formatDocumentLink(law);

      // Extract metadata information (Expression level data)
      const metadataInfo = [];
      if (law.legislationDate) metadataInfo.push(`**Legislation Date:** ${law.legislationDate}`);
      if (law.datePublished) metadataInfo.push(`**Published:** ${law.datePublished}`);
      if (law.temporalCoverage) metadataInfo.push(`**Valid Period:** ${law.temporalCoverage}`);
      if (typeof law.inForce === 'boolean') metadataInfo.push(`**In Force:** ${law.inForce ? '✅ Yes' : '❌ No'}`);

      return `**📋 OFFICIAL LAW ${index + 1} - CITE THIS:** ${docLink}
📋 **Law Type:** ${law['@type']} | **Date:** ${law.legislationDate || law.decisionDate || 'N/A'}
🔗 **ELI Identifier:** ${law.eli || law.documentNumber || 'N/A'}
📖 **Abbreviation:** ${law.abbreviation || 'N/A'}
${metadataInfo.length > 0 ? `📅 **METADATA (for validity/date questions):** ${metadataInfo.join(' | ')}` : ''}
${paragraphMatches.length > 0 ? `⚖️ **KEY LEGAL REFERENCES TO CITE:** ${paragraphMatches.slice(0, 3).join(', ')}` : ''}

📝 **Law Content:**
${Object.entries(relevantTexts).map(([name, text]) =>
  `• **${name}**: ${(text as string || '').substring(0, 300)}${(text as string || '').length > 300 ? '...' : ''}`
).join('\n')}

📖 **OFFICIAL REFERENCE:** ${referenceInfo}
💡 **NOTE:** Official German federal legislation database (rechtsinformationen.bund.de)
🔍 **DATA MODEL:** This response contains Expression-level metadata (dates, validity) and Manifestation-level links (HTML for reading)`;
    }).join('\n\n' + '─'.repeat(80) + '\n\n');

    const footer = `\n${'='.repeat(80)}\n📋 **REQUIRED: COPY THESE LINKS TO YOUR "QUELLEN" OR "SOURCES" SECTION**\n\nYou MUST include ALL of these markdown links in your response:\n\n${data.member.map((sr: SearchResult, i: number) => {
      const law = sr.item;
      const docLink = this.formatDocumentLink(law);
      return `   ${i + 1}. ${docLink}`;
    }).join('\n')}\n`;
    
    return sourceHeader + results + footer;
  }

  private formatCaseLawResults(data: any): string {
    if (!data.member || data.member.length === 0) {
      return 'No case law found.';
    }

    const sourceHeader = `\n⚖️ **OFFICIAL GERMAN COURT DECISIONS - MUST CITE** (rechtsinformationen.bund.de)\n${'='.repeat(80)}\n⚠️ **IMPORTANT INSTRUCTIONS FOR YOUR RESPONSE:**
1. Base your answer ONLY on the information provided below
2. Include ALL URLs listed at the bottom in your "Quellen" or "Sources" section
3. Cite specific case numbers and § references in your answer
4. DO NOT add external knowledge not found in these sources

`;
    
    const results = data.member.map((searchResult: SearchResult, index: number) => {
      const case_ = searchResult.item;
      const textMatches = searchResult.textMatches || [];
      
      // Extract different types of content
      const contentByType = textMatches.reduce((acc, match) => {
        acc[match.name] = match.text;
        return acc;
      }, {} as any);
      
      // Look for specific legal references (§ sections)
      const allContent = textMatches.map(m => m.text || '').join(' ');
      const paragraphMatches = allContent.match(/§\s*\d+[a-z]?(\s*(Abs\.?|Absatz)\s*\d+)?(\s*(S\.?|Satz)\s*\d+)?\s*(SGB|BGB|StGB|GG|VwVfG|BEEG|EStG)\s*[IVX]*\d*/gi) || [];
      
      // Generate human-readable markdown link
      const caseLink = this.formatDocumentLink(case_);

      return `**📋 OFFICIAL COURT DECISION ${index + 1} - CITE THIS:** ${caseLink}
🏛️ **Court:** ${case_.courtName || 'German Federal Court'} | ${case_.judicialBody || ''}
📅 **Decision Date:** ${case_.decisionDate || 'N/A'} | **Type:** ${case_.documentType || 'N/A'}
📋 **Case Numbers:** ${case_.fileNumbers?.join(', ') || 'N/A'}
🔗 **ECLI:** ${case_.ecli || 'N/A'}
${paragraphMatches.length > 0 ? `⚖️ **KEY LEGAL REFERENCES TO CITE:** ${paragraphMatches.slice(0, 3).join(', ')}` : ''}

📝 **Decision Content:**
${Object.entries(contentByType).map(([type, text]) =>
  `• **${type}**: ${(text as string || '').substring(0, 250)}${(text as string || '').length > 250 ? '...' : ''}`
).join('\n')}`;
    }).join('\n\n' + '─'.repeat(80) + '\n\n');

    const footer = `\n${'='.repeat(80)}\n📋 **REQUIRED: COPY THESE LINKS TO YOUR "QUELLEN" OR "SOURCES" SECTION**\n\nYou MUST include ALL of these markdown links in your response:\n\n${data.member.map((sr: SearchResult, i: number) => {
      const case_ = sr.item;
      const caseLink = this.formatDocumentLink(case_);
      return `   ${i + 1}. ${caseLink}`;
    }).join('\n')}\n`;
    
    return sourceHeader + results + footer;
  }

  private formatDocumentResults(data: any): string {
    if (!data.member || data.member.length === 0) {
      return 'No documents found.';
    }

    const sourceHeader = `\n📚 **OFFICIAL SOURCES - MUST CITE IN RESPONSE** (rechtsinformationen.bund.de)\n${'='.repeat(80)}\n⚠️ **IMPORTANT INSTRUCTIONS FOR YOUR RESPONSE:**
1. Base your answer ONLY on the information provided below
2. Include ALL URLs listed at the bottom in your "Quellen" or "Sources" section
3. Cite specific § references (e.g., "§ 32 SGB II") in your answer
4. DO NOT add external knowledge not found in these sources

`;
    
    const results = data.member.map((searchResult: SearchResult, index: number) => {
      const doc = searchResult.item;
      const textMatches = searchResult.textMatches || [];
      
      const isLegislation = doc['@type'] === 'Legislation';
      const summary = textMatches.map(m => m.text || '').join(' ').substring(0, 300);
      
      // Look for specific legal references (§ sections)
      const allContent = textMatches.map(m => m.text || '').join(' ');
      const paragraphMatches = allContent.match(/§\s*\d+[a-z]?(\s*(Abs\.?|Absatz)\s*\d+)?(\s*(S\.?|Satz)\s*\d+)?\s*(SGB|BGB|StGB|GG|VwVfG|BEEG|EStG)\s*[IVX]*\d*/gi) || [];
      
      // Generate human-readable URLs based on document type
      let fullUrl: string;
      
      if (isLegislation) {
        // For legislation: Use workExample for expression-level access
        let documentUrl = doc['@id'];
        if (doc.workExample && doc.workExample['@id']) {
          documentUrl = doc.workExample['@id']; // Contains complete versioned path
        }
        // Convert API path to working website URL for legislation
        fullUrl = `https://testphase.rechtsinformationen.bund.de${documentUrl}`;
      } else {
        // For court decisions: Always use case-law URL format (has full content)
        // ECLI URLs on testphase appear to show shorter/placeholder content
        fullUrl = `https://testphase.rechtsinformationen.bund.de${doc['@id'].replace('/v1', '')}`;
      }
      
      // Create reference information for the user
      let referenceInfo = `${doc.eli || doc.documentNumber || 'Unknown ID'}`;
      if (doc.eli && doc.eli.includes('bgbl')) {
        const eliMatch = doc.eli.match(/eli\/bund\/bgbl-([IVX]+)\/(\d+)\/s(\d+)/);
        if (eliMatch) {
          const [, roman, year, page] = eliMatch;
          referenceInfo = `Bundesgesetzblatt ${year} Teil ${roman} S. ${page}`;
        }
      }
      
      return `**📋 OFFICIAL SOURCE ${index + 1} - CITE THIS:** ${doc.headline || doc.name || 'German Legal Document'}
🏛️ **Court/Authority:** ${doc.courtName || 'Federal Legal Authority'}
📅 **Date:** ${doc.legislationDate || doc.decisionDate || 'N/A'}
🔗 **Official Document ID:** ${doc.eli || doc.ecli || doc.documentNumber || 'N/A'}
${paragraphMatches.length > 0 ? `⚖️ **KEY LEGAL REFERENCES TO CITE:** ${paragraphMatches.slice(0, 3).join(', ')}` : ''}

📝 **Key Legal Content:** ${summary || 'No content available'}

📖 **OFFICIAL REFERENCE:** ${referenceInfo}
🌐 **FULL TEXT LINK:** ${fullUrl}
💡 **NOTE:** Official German federal legal database
📄 **Document Type:** ${doc['@type']} ${isLegislation ? '(Federal Law)' : '(Court Decision)'}`;
    }).join('\n\n' + '─'.repeat(80) + '\n\n');

    const footer = `\n${'='.repeat(80)}\n💡 **MANDATORY CITATION:** All information above is from official German Federal Legal Information Portal\n🔍 **SOURCE:** rechtsinformationen.bund.de | **Via:** Rechtsinformationen Bund DE MCP Server\n⚠️ **IMPORTANT:** Include specific § references and human-readable source URLs in your final response. DO NOT add external world knowledge.\n🌐 **WICHTIG:** Include these URLs in your "Quellen" section:\n${data.member.map((sr: SearchResult, i: number) => {
      const doc = sr.item;
      const isLegislation = doc['@type'] === 'Legislation';
      let fullUrl: string;
      
      if (isLegislation) {
        // For legislation: Use workExample for expression-level access
        let documentUrl = doc['@id'];
        if (doc.workExample && doc.workExample['@id']) {
          documentUrl = doc.workExample['@id'];
        }
        fullUrl = `https://testphase.rechtsinformationen.bund.de${documentUrl}`;
      } else {
        // For court decisions: Always use case-law URL format (has full content)
        fullUrl = `https://testphase.rechtsinformationen.bund.de${doc['@id'].replace('/v1', '')}`;
      }
      
      return `   ${i + 1}. ${fullUrl}`;
    }).join('\n')}\n`;
    
    return sourceHeader + results + footer;
  }

  private formatDocumentDetails(data: any, format: string): string {
    if (format === 'html' || format === 'xml') {
      return `Raw ${format.toUpperCase()} content:\n${data}`;
    }

    // Handle JSON response
    if (data.member && data.member.length > 0) {
      return this.formatDocumentResults(data);
    }

    // Handle single document response
    return `📋 **Document Details**
Type: ${data['@type'] || 'N/A'}
Name: ${data.name || data.headline || 'N/A'}
Date: ${data.legislationDate || data.decisionDate || 'N/A'}
Identifier: ${data.eli || data.ecli || data.documentNumber || 'N/A'}

${JSON.stringify(data, null, 2)}`;
  }

  private formatLegislationDetails(data: any, format: string): string {
    if (format === 'html' || format === 'xml') {
      return `Raw ${format.toUpperCase()} content:\n${data}`;
    }

    if (data.member && data.member.length > 0) {
      return this.formatLegislationResults(data);
    }

    return `📋 **Legislation Details**
${JSON.stringify(data, null, 2)}`;
  }

  private formatEnhancedSemanticResults(results: any[], explanations: string[]): string {
    if (results.length === 0) {
      return 'No semantically similar documents found.';
    }

    let output = '';

    // Add concept mapping explanations if available
    if (explanations.length > 0) {
      output += `💡 **Concept Corrections Applied:**\n${explanations.map(exp => `• ${exp}`).join('\n')}\n\n`;
    }

    output += results.map((result, index) => {
      const doc = result.item.originalResult ? result.item.originalResult.item : result.item;
      const rawScore = result.score || 0;

      // Convert Fuse.js score (0=perfect, 1=terrible) to confidence (0-100%)
      const confidence = Math.round((1 - rawScore) * 100);
      const confidenceLabel = confidence >= 80 ? '🟢 High' :
                             confidence >= 60 ? '🟡 Medium' :
                             confidence >= 40 ? '🟠 Low' : '🔴 Very Low';

      const priority = result.item.priority || 'standard';
      const searchTerm = result.item.searchTerm || 'unknown';
      const textMatches = result.item.originalResult ? result.item.originalResult.textMatches : [];
      const summary = textMatches ? textMatches.map((m: any) => m.text || '').join(' ').substring(0, 200) : 'No summary available';

      // Classify law type for better categorization
      const lawType = this.classifyLawType(doc);

      // Extract paragraph references
      const allContent = textMatches ? textMatches.map((m: any) => m.text || '').join(' ') : '';
      const paragraphMatches = allContent.match(/§\s*\d+[a-z]?(\s*(Abs\.?|Absatz)\s*\d+)?/gi) || [];
      const uniqueParas = [...new Set(paragraphMatches)].slice(0, 3);

      // Generate human-readable markdown link
      const docLink = this.formatDocumentLink(doc);

      return `${index + 1}. ${docLink}
   📊 **Confidence:** ${confidenceLabel} (${confidence}%) | **Priority:** ${priority}
   📂 **Law Type:** ${lawType}
   📅 **Date:** ${doc.legislationDate || doc.decisionDate || 'N/A'}
   🔍 **Found via:** "${searchTerm}"
   ${doc.courtName ? `🏛️ **Court:** ${doc.courtName}` : ''}
   🔗 **ELI/ECLI:** ${doc.eli || doc.ecli || doc.documentNumber || 'N/A'}
   ${doc.abbreviation ? `📖 **Abbreviation:** ${doc.abbreviation}` : ''}
   ${uniqueParas.length > 0 ? `⚖️ **Key Paragraphs:** ${uniqueParas.join(', ')}` : ''}
   📄 **Summary:** ${summary || 'No summary available'}`;
    }).join('\n\n');

    return output;
  }

  private formatSemanticResults(results: any[]): string {
    if (results.length === 0) {
      return 'No semantically similar documents found.';
    }

    return results.map((result, index) => {
      const doc = result.item.originalResult.item;
      const score = result.score ? (1 - result.score).toFixed(3) : 'N/A';
      const textMatches = result.item.originalResult.textMatches || [];
      const summary = textMatches.map((m: any) => m.text || '').join(' ').substring(0, 200);

      return `${index + 1}. **${doc.headline || doc.name || 'Untitled Document'}** (Similarity: ${score})
   📂 Type: ${doc['@type']}
   📅 Date: ${doc.legislationDate || doc.decisionDate || 'N/A'}
   ${doc.courtName ? `🏛️ Court: ${doc.courtName}` : ''}
   🔗 Identifier: ${doc.eli || doc.ecli || doc.documentNumber || 'N/A'}
   📄 Summary: ${summary || 'No summary available'}`;
    }).join('\n\n');
  }

  private async getLawByAbbreviation(args: any) {
    const { abbreviation } = args;

    // Normalize abbreviation (handle variations like "SGB I" vs "SGB-I" vs "SGBI")
    const normalizedAbbr = abbreviation.trim().toUpperCase();

    // Map common abbreviations to full law names for better search results
    const abbreviationMap: {[key: string]: string} = {
      'GG': 'Grundgesetz für die Bundesrepublik Deutschland',
      'BGB': 'Bürgerliches Gesetzbuch',
      'StGB': 'Strafgesetzbuch',
      'SGB I': 'Sozialgesetzbuch Erstes Buch',
      'SGB II': 'Sozialgesetzbuch Zweites Buch',
      'SGB III': 'Sozialgesetzbuch Drittes Buch',
      'SGB IV': 'Sozialgesetzbuch Viertes Buch',
      'SGB V': 'Sozialgesetzbuch Fünftes Buch',
      'SGB VI': 'Sozialgesetzbuch Sechstes Buch',
      'SGB VII': 'Sozialgesetzbuch Siebtes Buch',
      'SGB VIII': 'Sozialgesetzbuch Achtes Buch',
      'SGB IX': 'Sozialgesetzbuch Neuntes Buch',
      'SGB X': 'Sozialgesetzbuch Zehntes Buch',
      'SGB XI': 'Sozialgesetzbuch Elftes Buch',
      'SGB XII': 'Sozialgesetzbuch Zwölftes Buch',
      'SGB XIII': 'Sozialgesetzbuch Dreizehntes Buch',
      'SGB XIV': 'Sozialgesetzbuch Vierzehntes Buch',
    };

    // Build search queries: prioritize full name if we know it
    const searchQueries: string[] = [];

    // Add full law name if we have a mapping
    if (abbreviationMap[normalizedAbbr]) {
      searchQueries.push(`"${abbreviationMap[normalizedAbbr]}"`);
      searchQueries.push(abbreviationMap[normalizedAbbr]);
    }

    // Add abbreviation searches
    searchQueries.push(`"${abbreviation}"`);
    searchQueries.push(normalizedAbbr);
    searchQueries.push(abbreviation);

    // Try multiple search approaches
    let bestMatch: any = null;
    let allResults: any[] = [];

    for (const query of searchQueries) {
      try {
        const response = await axios.get(`${BASE_URL}/legislation`, {
          params: { searchTerm: query, size: 20 }
        });

        if (response.data.member && response.data.member.length > 0) {
          allResults.push(...response.data.member);
        }
      } catch (error) {
        // Continue with other queries
      }
    }

    // Remove duplicates
    const uniqueResults = allResults.filter((item, index, self) =>
      index === self.findIndex(other => other.item?.documentNumber === item.item?.documentNumber)
    );

    if (uniqueResults.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `❌ No law found for abbreviation "${abbreviation}"\n\n💡 **Suggestions:**\n• Check spelling (e.g., "SGB I" not "SGB 1")\n• Try the full law name instead\n• Use intelligente_rechtssuche for broader search\n• Common abbreviations: SGB I-XII, BGB, StGB, GG, AufenthG, KSchG, BEEG`
        }]
      };
    }

    // Scoring function to find best match
    const scoreMatch = (result: SearchResult) => {
      const item = result.item;
      let score = 0;

      // Check if title matches our mapped full name (HIGHEST PRIORITY)
      if (abbreviationMap[normalizedAbbr]) {
        const expectedTitle = abbreviationMap[normalizedAbbr].toUpperCase();
        const actualTitle = (item.headline || item.name || '').toUpperCase();

        // Exact or very close title match - this is our law!
        if (actualTitle === expectedTitle || actualTitle.includes(expectedTitle)) {
          score += 2000; // HIGHEST priority - full title match
        }
      }

      // Check abbreviation field (high priority)
      if (item.abbreviation) {
        const itemAbbr = item.abbreviation.trim().toUpperCase();
        const searchAbbr = normalizedAbbr.trim();

        // Exact match (high priority)
        if (itemAbbr === searchAbbr) {
          score += 1000;
        }
        // Handle SGB variations: "SGB I" should match "SGB I" exactly, not "SGB IX" or "SGB II"
        else if (searchAbbr.startsWith('SGB')) {
          // Extract the book number/numeral from both
          const searchBook = searchAbbr.replace('SGB', '').trim();
          const itemBook = itemAbbr.replace('SGB', '').trim();

          // Exact book match (very high priority)
          if (searchBook === itemBook) {
            score += 900;
          }
          // Partial match only if it's not a different SGB book
          else if (itemAbbr.includes(searchAbbr)) {
            // Check if this is actually a different SGB book
            const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'];
            const isDifferentBook = romanNumerals.some(numeral => {
              return searchBook !== numeral && itemBook === numeral;
            });

            if (!isDifferentBook) {
              score += 50;
            }
            // Penalize wrong SGB book
            else {
              score -= 500;
            }
          }
        }
        // Non-SGB laws: allow partial matches
        else if (itemAbbr.includes(searchAbbr)) {
          score += 50;
        }
      }

      // Check alternateName field
      if (item.alternateName) {
        const altName = item.alternateName.trim().toUpperCase();
        if (altName === normalizedAbbr.trim()) score += 900;
        else if (altName.includes(normalizedAbbr)) score += 40;
      }

      // Check headline/name
      const title = (item.headline || item.name || '').toUpperCase();
      if (title.includes(normalizedAbbr)) score += 30;

      // Boost if it's a "Sozialgesetzbuch" for SGB queries
      if (normalizedAbbr.startsWith('SGB') && title.includes('SOZIALGESETZBUCH')) {
        score += 20;
      }

      // Boost recent versions (but only slightly)
      if (item.legislationDate) {
        const year = parseInt(item.legislationDate.substring(0, 4));
        if (year > 2000) score += 10;
      }

      return score;
    };

    // Find best match
    const scoredResults = uniqueResults.map(result => ({
      result,
      score: scoreMatch(result)
    }));

    scoredResults.sort((a, b) => b.score - a.score);
    bestMatch = scoredResults[0]?.result;

    if (!bestMatch || scoredResults[0]?.score < 0) {
      return {
        content: [{
          type: 'text',
          text: `⚠️ Found ${uniqueResults.length} results but none match exactly.\n\nPlease use intelligente_rechtssuche or deutsche_gesetze_suchen for broader search.`
        }]
      };
    }

    // Format the response with enhanced metadata
    const law = bestMatch.item;
    const lawType = this.classifyLawType(law);

    // Validate abbreviation match and warn if mismatch
    const itemAbbr = (law.abbreviation || '').trim().toUpperCase();
    const searchAbbr = normalizedAbbr.trim();
    const isExactMatch = itemAbbr === searchAbbr;

    // For SGB laws, check book numbers match
    let isSGBBookMatch = true;
    if (searchAbbr.startsWith('SGB')) {
      const searchBook = searchAbbr.replace('SGB', '').trim();
      const itemBook = itemAbbr.replace('SGB', '').trim();
      isSGBBookMatch = searchBook === itemBook;
    }

    // If abbreviation doesn't match exactly, add warning
    const mismatchWarning = (!isExactMatch || !isSGBBookMatch) ? `\n\n⚠️ **WARNING:** Searched for "${abbreviation}" but found "${law.abbreviation || 'Unknown'}"\nThis may not be an exact match. Consider using intelligente_rechtssuche for more accurate results.\n` : '';

    // Generate human-readable markdown link
    const docLink = this.formatDocumentLink(law);

    return {
      content: [{
        type: 'text',
        text: `📖 **LAW FOUND BY ABBREVIATION: ${abbreviation}**${mismatchWarning}

**Full Title:** ${docLink}
**Official Abbreviation:** ${law.abbreviation || 'N/A'}
**Law Type:** ${lawType}
**Document Number:** ${law.documentNumber || 'N/A'}
**ELI Identifier:** ${law.eli || 'N/A'}
**Publication Date:** ${law.legislationDate || 'N/A'}
**Language:** ${law.inLanguage || 'German (deu)'}

💡 **Next Steps:**
• Use gesetz_inhaltsverzeichnis_abrufen to see table of contents
• Use deutsche_gesetze_suchen to search within this law
• Use dokument_details_abrufen to get full text

📋 **Additional Matches Found:** ${uniqueResults.length - 1} other versions/related laws`
      }]
    };
  }

  private classifyLawType(law: any): string {
    const title = (law.headline || law.name || '').toLowerCase();
    const abbr = (law.abbreviation || '').toUpperCase();

    if (abbr === 'GG' || title.includes('grundgesetz')) return 'Grundgesetz (Constitutional Law)';
    if (abbr.startsWith('SGB') || title.includes('sozialgesetzbuch')) return 'Sozialgesetzbuch (Social Code)';
    if (abbr === 'BGB' || title.includes('bürgerliches gesetzbuch')) return 'Bürgerliches Gesetzbuch (Civil Code)';
    if (abbr === 'StGB' || title.includes('strafgesetzbuch')) return 'Strafgesetzbuch (Criminal Code)';
    if (title.includes('verordnung')) return 'Verordnung (Regulation)';
    if (title.includes('gesetz')) return 'Bundesgesetz (Federal Law)';

    return law['@type'] || 'Legislation';
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Rechtsinformationen MCP server running on stdio');
  }
}

const server = new RechtsinformationenBundDeMCPServer();
server.run().catch(console.error);