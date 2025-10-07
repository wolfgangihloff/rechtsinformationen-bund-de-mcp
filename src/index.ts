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
        name: 'rechtsinformationen-bund-de-mcp',
        version: '1.0.0',
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
✓ Follow-up searches after semantische_rechtssuche
✓ When you need legislation-only results (excludes case law)
✓ When searching for specific law abbreviations (BEEG, BGB, SGB)

**Limitations:**
⚠️ Date filters (temporalCoverageFrom/To) are unreliable - they may exclude relevant results
⚠️ For amendment questions, DON'T use date filters - search broadly instead

**Parameters:**
• searchTerm: Keywords or law names (required)
• temporalCoverageFrom/To: ISO dates (optional, use with caution)
• limit: Max results, default 10, API max 100

**Usage Priority:**
For initial queries → Use semantische_rechtssuche first
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
                  description: 'Maximum number of results to return (default: 10, API max: 100)',
                  default: 10,
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
✓ Follow-up searches after semantische_rechtssuche
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
For initial queries → Use semantische_rechtssuche first
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
                  description: 'Maximum number of results to return (default: 10, API max: 100)',
                  default: 10,
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
✗ For initial searches (use semantische_rechtssuche instead)
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
            name: 'alle_rechtsdokumente_suchen',
            description: `🔍 **SECONDARY TOOL** - Umfassende Suche (Gesetze + Rechtsprechung)

**What this tool searches:**
• Combined search across ALL documents at rechtsinformationen.bund.de
• Both legislation (Gesetze) AND case law (Rechtsprechung)
• Use when you need broad coverage across all document types

**URL Construction:**
Results contain mixed URLs:
• Legislation: /v1/legislation/eli/bund/...
• Case Law: /v1/case-law/ecli/de/{court}/...

All URLs work directly in browsers and API calls.

**When to use:**
✓ Follow-up searches after semantische_rechtssuche
✓ When you want both legislation AND case law results
✓ When using documentKind filter to switch between types
✓ When you've exhausted other specialized tools

**Filtering Options:**
• documentKind: "legislation" (only laws) or "case-law" (only court decisions)
• court: Filter by court abbreviation (only applies to case-law results)
• dateFrom/To: Date range filters (ISO format)

**Limitations:**
⚠️ Date filters are unreliable - may exclude relevant results
⚠️ Less precise than specialized tools (deutsche_gesetze_suchen, rechtsprechung_suchen)
⚠️ Results are mixed, harder to navigate than type-specific searches

**Parameters:**
• searchTerm: Keywords or legal references (required)
• documentKind: "legislation" or "case-law" (optional)
• dateFrom/To: ISO date filters (optional, use with caution)
• court: Court abbreviation for case-law filtering (optional)
• limit: Max results, default 10, API max 100

**Usage Priority:**
For initial queries → Use semantische_rechtssuche first
For type-specific searches → Use deutsche_gesetze_suchen or rechtsprechung_suchen
For broad mixed results → Use this tool

**Important:** Exhaust ALL MCP tools before considering external web search.`,
            inputSchema: {
              type: 'object',
              properties: {
                searchTerm: {
                  type: 'string',
                  description: 'Search term for finding documents across all types',
                },
                documentKind: {
                  type: 'string',
                  description: 'Filter by document type: "legislation" (only laws) or "case-law" (only court decisions)',
                  enum: ['case-law', 'legislation'],
                },
                dateFrom: {
                  type: 'string',
                  description: 'Start date filter (ISO 8601 format: YYYY-MM-DD) - WARNING: May exclude relevant results',
                },
                dateTo: {
                  type: 'string',
                  description: 'End date filter (ISO 8601 format: YYYY-MM-DD) - WARNING: May exclude relevant results',
                },
                court: {
                  type: 'string',
                  description: 'Filter by court abbreviation (only applies to case-law results, e.g., BGH, BVerfG, BAG)',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 10, API max: 100)',
                  default: 10,
                },
              },
              required: ['searchTerm'],
            },
          },
          {
            name: 'semantische_rechtssuche',
            description: `🧠 **PRIMARY TOOL** ⭐ ALWAYS USE THIS FIRST for ANY German legal question ⭐

**What this tool searches:**
• Full-text search across rechtsinformationen.bund.de
• Both legislation (Gesetze) AND case law (Rechtsprechung)
• Intelligent query enhancement with misconception correction

**Intelligent Features (Automatic):**
✓ English → German translation (e.g., "employee rights" → "Arbeitnehmerrechte")
✓ Misconception correction (e.g., "Überprüfungsantrag" → "Widerspruch")
✓ Legal reference extraction (e.g., detects "§ 15 BEEG" patterns)
✓ Multiple search term execution in parallel
✓ Result prioritization and deduplication

**URL Construction:**
Results contain mixed URLs (same as alle_rechtsdokumente_suchen):
• Legislation: https://testphase.rechtsinformationen.bund.de/v1/legislation/eli/bund/...
• Case Law: https://testphase.rechtsinformationen.bund.de/v1/case-law/ecli/de/...

All URLs work directly in browsers and API calls.

**What this tool does NOT do:**
✗ Does NOT generate semantically similar terms (YOU must provide variations)
✗ Does NOT try multiple query phrasings (YOU must search with different terms)
✗ Does NOT explore related concepts automatically (YOU need multiple searches)
✗ Does NOT use ML embeddings (uses keyword matching + Fuse.js fuzzy search)

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
• limit: Max results (default: 10, API max: 100)

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
                  description: 'Maximum number of results to return (default: 10, API max: 100)',
                  default: 10,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'gesetz_per_eli_abrufen',
            description: `🏛️ **RETRIEVAL TOOL** - Gesetz per ELI-Kennung abrufen

**What this tool does:**
• Retrieves specific legislation by ELI (European Legislation Identifier)
• Direct access to a known law document
• Alternative to dokument_details_abrufen specifically for legislation

**ELI Format:**
ELI identifiers follow this structure:
/eli/{jurisdiction}/{agent}/{year}/{naturalIdentifier}/{pointInTime}/{version}/{language}

Example: /eli/bund/bgbl-1/2006/s2748/2025-05-01/1/deu
• bund = federal legislation
• bgbl-1 = Federal Law Gazette I
• 2006 = publication year
• s2748 = page number
• 2025-05-01 = point in time (version date)
• 1 = version number
• deu = German language

**URL Construction:**
This tool constructs the full API URL:
https://testphase.rechtsinformationen.bund.de/v1/legislation/eli/bund/...

The URL works directly in browsers and API calls.

**When to use:**
✓ When you have a complete ELI identifier from search results
✓ When you know the exact ELI of a law (e.g., from citation)
✓ When you need a specific version/date of legislation

**When NOT to use:**
✗ For initial searches (use semantische_rechtssuche instead)
✗ When you only have a law name (use deutsche_gesetze_suchen)
✗ For court decisions (use rechtsprechung_suchen or ECLI instead)
✗ When you don't have the complete ELI path

**Limitations:**
⚠️ Only works with legislation (not case law)
⚠️ Requires complete, correctly formatted ELI
⚠️ Historical versions may not be available for all laws
⚠️ Only covers federal legislation (Bundesgesetze)

**Parameters:**
• eli: Complete ELI path (required)
• format: "json" (default), "html", or "xml" (optional)

**Usage Priority:**
Search first → Get ELI from results → Use this tool for retrieval

**Note:** For most use cases, dokument_details_abrufen is more flexible as it accepts various ID formats.`,
            inputSchema: {
              type: 'object',
              properties: {
                eli: {
                  type: 'string',
                  description: 'European Legislation Identifier (ELI) in format: /eli/bund/bgbl-1/YYYY/sXXXX/YYYY-MM-DD/V/deu or eli/bund/bgbl-1/...',
                },
                format: {
                  type: 'string',
                  description: 'Response format: "json" (default, structured data), "html" (readable format), or "xml" (raw format)',
                  enum: ['html', 'xml', 'json'],
                  default: 'json',
                },
              },
              required: ['eli'],
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
          case 'alle_rechtsdokumente_suchen':
            return await this.searchAllDocuments(args);
          case 'semantische_rechtssuche':
            return await this.intelligentLegalSearch(args);
          case 'gesetz_per_eli_abrufen':
            return await this.getLegislationByEli(args);
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
    const { searchTerm, temporalCoverageFrom, temporalCoverageTo, limit = 10 } = args;

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
    const { searchTerm, court, dateFrom, dateTo, documentType, limit = 10 } = args;

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

  private async getLegislationByEli(args: any) {
    const { eli, format = 'json' } = args;
    
    const params = new URLSearchParams();
    params.append('eli', eli);
    
    const headers: any = {};
    if (format === 'html') headers['Accept'] = 'text/html';
    if (format === 'xml') headers['Accept'] = 'application/xml';

    const response = await axios.get(`${BASE_URL}/legislation`, { params, headers });
    
    return {
      content: [
        {
          type: 'text',
          text: `Legislation with ELI ${eli}:\n\n${this.formatLegislationDetails(response.data, format)}`,
        },
      ],
    };
  }

  private async searchAllDocuments(args: any) {
    const { searchTerm, documentKind, dateFrom, dateTo, court, limit = 10 } = args;

    // Convert limit to number if it's a string (for model compatibility)
    const numericLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    
    // Enhanced search logic for specific legal questions
    let enhancedSearchTerms = [searchTerm];
    
    // Special handling for Jobcenter/Meldeversäumnis questions
    if (searchTerm.toLowerCase().includes('jobcenter') || 
        searchTerm.toLowerCase().includes('termin') ||
        searchTerm.toLowerCase().includes('melde')) {
      enhancedSearchTerms = [
        'Meldeversäumnis',
        '§ 32 SGB II',
        'SGB II 32',
        searchTerm
      ];
    }
    
    // Try multiple search approaches
    let allResults: any[] = [];
    
    for (const term of enhancedSearchTerms) {
      const params = new URLSearchParams();
      params.append('searchTerm', term);
      if (documentKind) params.append('documentKind', documentKind);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (court) params.append('court', court);
      params.append('limit', Math.ceil(numericLimit / enhancedSearchTerms.length).toString());

      try {
        const response = await axios.get(`${BASE_URL}/document`, { params });
        if (response.data.member) {
          allResults.push(...response.data.member);
        }
      } catch (error) {
        // Continue with other search terms if one fails
      }
    }
    
    // Remove duplicates and prioritize results with legal references
    const uniqueResults = allResults.filter((item, index, self) => 
      index === self.findIndex(other => other.item?.documentNumber === item.item?.documentNumber)
    );
    
    // Sort by relevance (prioritize results with § references)
    uniqueResults.sort((a, b) => {
      const aContent = (a.textMatches || []).map((m: any) => m.text).join(' ');
      const bContent = (b.textMatches || []).map((m: any) => m.text).join(' ');
      const aHasLegalRef = /§\s*\d+.*SGB/i.test(aContent);
      const bHasLegalRef = /§\s*\d+.*SGB/i.test(bContent);
      
      if (aHasLegalRef && !bHasLegalRef) return -1;
      if (!aHasLegalRef && bHasLegalRef) return 1;
      return 0;
    });
    
    const limitedResults = uniqueResults.slice(0, numericLimit);
    const mockResponse = { member: limitedResults };
    
    return {
      content: [
        {
          type: 'text',
          text: `Found ${limitedResults.length} documents matching "${searchTerm}":\n\n${this.formatDocumentResults(mockResponse)}`,
        },
      ],
    };
  }

  private async intelligentLegalSearch(args: any) {
    const { query, threshold = 0.3, limit = 10 } = args;

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
    
    // Use more lenient fuzzy matching for legal documents
    const fuse = new Fuse(uniqueDocuments, {
      keys: [
        { name: 'title', weight: 0.4 },
        { name: 'summary', weight: 0.4 },
        { name: 'content', weight: 0.2 }
      ],
      threshold: Math.max(numericThreshold, 0.6), // More lenient for legal documents
      includeScore: true,
    });

    const semanticResults = fuse.search(actualQuery);
    
    // If fuzzy search finds nothing, return top priority documents
    const finalResults = semanticResults.length > 0
      ? semanticResults.slice(0, numericLimit)
      : uniqueDocuments.slice(0, numericLimit).map(doc => ({ item: doc, score: 0.8 }));
    
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
      
      return `**📋 OFFICIAL LAW ${index + 1} - CITE THIS:** ${law.headline || law.name || 'German Federal Law'}
📋 **Law Type:** ${law['@type']} | **Date:** ${law.legislationDate || law.decisionDate || 'N/A'}
🔗 **ELI Identifier:** ${law.eli || law.documentNumber || 'N/A'}
📖 **Abbreviation:** ${law.abbreviation || 'N/A'}
${paragraphMatches.length > 0 ? `⚖️ **KEY LEGAL REFERENCES TO CITE:** ${paragraphMatches.slice(0, 3).join(', ')}` : ''}

📝 **Law Content:**
${Object.entries(relevantTexts).map(([name, text]) => 
  `• **${name}**: ${(text as string || '').substring(0, 300)}${(text as string || '').length > 300 ? '...' : ''}`
).join('\n')}

📖 **OFFICIAL REFERENCE:** ${referenceInfo}
🌐 **READ ONLINE (HTML):** ${htmlUrl}
📊 **API ACCESS (JSON):** ${apiUrl}
💡 **NOTE:** Official German federal legislation database`;
    }).join('\n\n' + '─'.repeat(80) + '\n\n');

    const footer = `\n${'='.repeat(80)}\n📋 **REQUIRED: COPY THESE URLS TO YOUR "QUELLEN" OR "SOURCES" SECTION**\n\nYou MUST include ALL of these URLs in your response:\n\n${data.member.map((sr: SearchResult, i: number) => {
      const law = sr.item;
      let documentUrl = law['@id'];
      if (law.workExample && law.workExample['@id']) {
        documentUrl = law.workExample['@id'];
      }

      // Get HTML URL if available for user-friendly links
      let htmlUrl = `https://testphase.rechtsinformationen.bund.de${documentUrl}`;
      const workExampleFooter = law.workExample as any;
      if (workExampleFooter && workExampleFooter.encoding) {
        const htmlEncoding = workExampleFooter.encoding.find((enc: any) =>
          enc.encodingFormat === 'text/html' && enc.contentUrl
        );
        if (htmlEncoding) {
          htmlUrl = `https://testphase.rechtsinformationen.bund.de${htmlEncoding.contentUrl}`;
        }
      }

      return `   ${i + 1}. ${htmlUrl}`;
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
      
      // Generate human-readable web URLs - court decisions use ECLI links
      let readableUrl: string;
      
      // For court decisions: Always use case-law URL format (has full content)
      // ECLI URLs on testphase appear to show shorter/placeholder content
      readableUrl = `https://testphase.rechtsinformationen.bund.de${case_['@id'].replace('/v1', '')}`;
      
      return `**📋 OFFICIAL COURT DECISION ${index + 1} - CITE THIS:** ${case_.headline || 'German Court Decision'}
🏛️ **Court:** ${case_.courtName || 'German Federal Court'} | ${case_.judicialBody || ''}
📅 **Decision Date:** ${case_.decisionDate || 'N/A'} | **Type:** ${case_.documentType || 'N/A'}
📋 **Case Numbers:** ${case_.fileNumbers?.join(', ') || 'N/A'}
🔗 **ECLI:** ${case_.ecli || 'N/A'}
${paragraphMatches.length > 0 ? `⚖️ **KEY LEGAL REFERENCES TO CITE:** ${paragraphMatches.slice(0, 3).join(', ')}` : ''}

📝 **Decision Content:**
${Object.entries(contentByType).map(([type, text]) => 
  `• **${type}**: ${(text as string || '').substring(0, 250)}${(text as string || '').length > 250 ? '...' : ''}`
).join('\n')}

🌐 **HUMAN-READABLE LINK FOR USER:** ${readableUrl}`;
    }).join('\n\n' + '─'.repeat(80) + '\n\n');

    const footer = `\n${'='.repeat(80)}\n💡 **MANDATORY CITATION:** All above from official German Federal Court Decisions\n🔍 **SOURCE:** rechtsinformationen.bund.de | **Via:** Rechtsinformationen Bund DE MCP Server\n⚠️ **IMPORTANT:** Include specific § references and source URLs in your final response.\n🌐 **WICHTIG:** Include these URLs in your "Quellen" section:\n${data.member.map((sr: SearchResult, i: number) => {
      const case_ = sr.item;
      let readableUrl = `https://rechtsinformationen.bund.de${case_['@id']}`.replace('/v1/', '/').replace('testphase.', '');
      if (case_.ecli) {
        readableUrl = `https://www.rechtsinformationen.bund.de/ecli/${case_.ecli}`;
      }
      return `   ${i + 1}. ${readableUrl}`;
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
      const score = result.score ? (1 - result.score).toFixed(3) : 'N/A';
      const priority = result.item.priority || 'standard';
      const searchTerm = result.item.searchTerm || 'unknown';
      const textMatches = result.item.originalResult ? result.item.originalResult.textMatches : [];
      const summary = textMatches ? textMatches.map((m: any) => m.text || '').join(' ').substring(0, 200) : 'No summary available';
      
      return `${index + 1}. **${doc.headline || doc.name || 'Untitled Document'}** (Similarity: ${score}, Priority: ${priority})
   📂 Type: ${doc['@type']}
   📅 Date: ${doc.legislationDate || doc.decisionDate || 'N/A'}
   🔍 Found via: "${searchTerm}"
   ${doc.courtName ? `🏛️ Court: ${doc.courtName}` : ''}
   🔗 Identifier: ${doc.eli || doc.ecli || doc.documentNumber || 'N/A'}
   📄 Summary: ${summary || 'No summary available'}`;
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Rechtsinformationen Bund DE MCP server running on stdio');
  }
}

const server = new RechtsinformationenBundDeMCPServer();
server.run().catch(console.error);