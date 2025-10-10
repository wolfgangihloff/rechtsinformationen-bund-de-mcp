#!/usr/bin/env node

/**
 * Enhanced Batch Download Script for Social Services Legislation
 *
 * Downloads all relevant federal legislation with multiple formats:
 * - JSON metadata
 * - HTML (human-readable)
 * - LegalDocML XML (structured legal format)
 * - Markdown (documentation)
 *
 * Usage: node scripts/batch-download-enhanced.mjs
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://testphase.rechtsinformationen.bund.de';
const OUTPUT_DIR = path.join(process.cwd(), 'tmp', 'bund-social');

// Comprehensive social services law terms
const SOCIAL_LAW_CATEGORIES = {
  'SGB_Social_Code_Books': [
    'SGB I', 'SGB II', 'SGB III', 'SGB IV', 'SGB V', 'SGB VI',
    'SGB VII', 'SGB VIII', 'SGB IX', 'SGB X', 'SGB XI', 'SGB XII', 'SGB XIV',
    'Sozialgesetzbuch'
  ],
  'Youth_Family_Law': [
    'Jugendschutzgesetz', 'JuSchG',
    'Bundeskindergeldgesetz', 'BKGG',
    'Bundeselterngeld- und Elternzeitgesetz', 'BEEG',
    'Unterhaltsvorschussgesetz', 'UhVorschG',
    'Kinder- und Jugendhilfe',
    'Jugendamt',
    'Adoption',
    'Pflegekinder',
    'Vormundschaft',
    'Beistandschaft'
  ],
  'Social_Assistance': [
    'Asylbewerberleistungsgesetz', 'AsylbLG',
    'Bundesausbildungsförderungsgesetz', 'BAföG',
    'Wohngeldgesetz', 'WoGG',
    'Bildungspaket',
    'Bildung und Teilhabe',
    'Grundsicherung',
    'Sozialhilfe'
  ],
  'Disability_Inclusion': [
    'Behindertengleichstellungsgesetz', 'BGG',
    'Bundesteilhabegesetz', 'BTHG',
    'Allgemeines Gleichbehandlungsgesetz', 'AGG',
    'Teilhabe',
    'Inklusion',
    'Rehabilitation',
    'Schwerbehinderung'
  ],
  'Employment_Integration': [
    'Teilhabechancengesetz',
    'Mindestlohngesetz', 'MiLoG',
    'Arbeitsförderung',
    'Beschäftigungsförderung',
    'Integration',
    'Bürgergeld'
  ],
  'Healthcare_Care': [
    'Pflegeversicherung',
    'Pflegestärkungsgesetz',
    'Krankengeld',
    'Mutterschaftsgeld',
    'Elterngeld',
    'Pflegegeld',
    'Pflegezeit',
    'Familienpflegezeit'
  ],
  'Administrative_Procedure': [
    'Verwaltungsverfahrensgesetz', 'VwVfG',
    'Sozialgerichtsgesetz', 'SGG',
    'Widerspruchsverfahren',
    'Verwaltungsakt',
    'Anhörung',
    'Akteneinsicht'
  ]
};

class EnhancedSocialLawDownloader {
  constructor() {
    this.stats = {
      searched: 0,
      found: 0,
      downloaded: 0,
      errors: 0,
      formats: {
        json: 0,
        html: 0,
        xml: 0,
        markdown: 0
      }
    };
    this.allDocuments = new Map(); // Deduplicate by ELI
  }

  /**
   * Search for legislation
   */
  async searchLegislation(searchTerm, limit = 100) {
    try {
      this.stats.searched++;
      console.log(`🔍 [${this.stats.searched}] Searching: "${searchTerm}"`);

      const response = await axios.get(`${BASE_URL}/v1/legislation`, {
        params: { searchTerm, size: limit },
        timeout: 30000
      });

      const results = response.data?.member || [];
      this.stats.found += results.length;

      if (results.length > 0) {
        console.log(`   ✅ Found ${results.length} results`);
      } else {
        console.log(`   ⚠️  No results`);
      }

      return results;
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      this.stats.errors++;
      return [];
    }
  }

  /**
   * Download document in multiple formats
   */
  async downloadDocument(result, categoryDir) {
    try {
      const item = result.item;
      const eli = item.eli || item['@id'];

      // Generate safe filename
      const lawName = item.name || item.headline || 'unknown';
      const safeFilename = lawName
        .replace(/[^a-zA-Z0-9äöüÄÖÜß\-\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 100);

      const baseFilename = path.join(categoryDir, safeFilename);

      // 1. Save JSON metadata
      const metadata = {
        name: item.name,
        headline: item.headline,
        eli: item.eli,
        abbreviation: item.abbreviation,
        legislationDate: item.legislationDate,
        documentNumber: item.documentNumber,
        apiUrl: BASE_URL + item['@id'],
        workExampleUrl: item.workExample?.['@id'] ? BASE_URL + item.workExample['@id'] : null,
        htmlUrl: this.convertToHtmlUrl(item.workExample?.['@id'] || item['@id']),
        textMatches: result.textMatches,
        downloadedAt: new Date().toISOString()
      };

      await fs.writeFile(`${baseFilename}_metadata.json`, JSON.stringify(metadata, null, 2));
      this.stats.formats.json++;

      // 2. Download full JSON document
      if (item.workExample?.['@id']) {
        try {
          const jsonUrl = BASE_URL + item.workExample['@id'];
          const jsonDoc = await axios.get(jsonUrl, {
            headers: { 'Accept': 'application/json' },
            timeout: 30000
          });

          await fs.writeFile(`${baseFilename}_full.json`, JSON.stringify(jsonDoc.data, null, 2));
          this.stats.formats.json++;
        } catch (e) {
          console.log(`   ⚠️  JSON download restricted (403)`);
        }
      }

      // 3. Download HTML version
      const htmlUrl = this.convertToHtmlUrl(item.workExample?.['@id'] || item['@id']);
      try {
        const htmlDoc = await axios.get(htmlUrl, {
          headers: { 'Accept': 'text/html' },
          timeout: 30000
        });

        await fs.writeFile(`${baseFilename}.html`, htmlDoc.data);
        this.stats.formats.html++;
        console.log(`   ✅ HTML downloaded`);
      } catch (e) {
        console.log(`   ⚠️  HTML download failed: ${e.message}`);
      }

      // 4. Download LegalDocML XML
      const workExampleUrl = item.workExample?.['@id'] || item['@id'];
      const xmlUrl = BASE_URL + (workExampleUrl.endsWith('/deu') ? workExampleUrl : workExampleUrl + '/deu') + '/regelungstext-1.xml';
      try {
        const xmlDoc = await axios.get(xmlUrl, {
          headers: { 'Accept': 'application/xml' },
          timeout: 30000
        });

        await fs.writeFile(`${baseFilename}.xml`, xmlDoc.data);
        this.stats.formats.xml++;
        console.log(`   ✅ XML (LegalDocML) downloaded`);
      } catch (e) {
        console.log(`   ⚠️  XML download failed: ${e.message}`);
      }

      // 5. Generate Markdown summary
      const markdown = this.generateMarkdown(metadata, result.textMatches);
      await fs.writeFile(`${baseFilename}.md`, markdown);
      this.stats.formats.markdown++;

      this.stats.downloaded++;
      console.log(`   ✅ ${lawName}`);

      return true;
    } catch (error) {
      console.error(`   ❌ Download error: ${error.message}`);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Convert API URL to HTML URL
   */
  convertToHtmlUrl(apiUrl) {
    if (!apiUrl) return '';

    // Convert /v1/legislation/eli/... to https://testphase.rechtsinformationen.bund.de/norms/eli/.../regelungstext-1.html
    const baseUrl = 'https://testphase.rechtsinformationen.bund.de';

    if (apiUrl.startsWith('/v1/legislation/eli/')) {
      return baseUrl + apiUrl.replace('/v1/legislation/eli/', '/norms/eli/') + '/regelungstext-1.html';
    } else if (apiUrl.startsWith('/v1/case-law/')) {
      return baseUrl + apiUrl.replace('/v1/case-law/', '/rechtsprechung/') + '/regelungstext-1.html';
    }

    return apiUrl; // Return as-is if no match
  }

  /**
   * Generate Markdown documentation
   */
  generateMarkdown(metadata, textMatches) {
    let md = `# ${metadata.name || metadata.headline}\n\n`;

    if (metadata.abbreviation) {
      md += `**Abbreviation:** ${metadata.abbreviation}\n\n`;
    }

    md += `**Legislation Date:** ${metadata.legislationDate || 'N/A'}\n`;
    md += `**ELI:** ${metadata.eli || 'N/A'}\n\n`;

    md += `## Links\n\n`;
    md += `- [HTML (Human-readable)](${metadata.htmlUrl})\n`;
    md += `- [API JSON](${metadata.apiUrl})\n`;
    md += `- [Work Example](${metadata.workExampleUrl})\n\n`;

    if (textMatches && textMatches.length > 0) {
      md += `## Relevant Excerpts\n\n`;
      for (const match of textMatches.slice(0, 5)) {
        md += `### ${match.name}\n\n`;
        md += `${match.text}\n\n`;
        if (match.location) {
          md += `*Location: ${match.location}*\n\n`;
        }
      }
    }

    md += `---\n\n`;
    md += `*Downloaded: ${metadata.downloadedAt}*\n`;
    md += `*Source: rechtsinformationen.bund.de*\n`;

    return md;
  }

  /**
   * Download all laws for a category
   */
  async downloadCategory(categoryName, searchTerms) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📚 Category: ${categoryName}`);
    console.log(`${'='.repeat(80)}`);

    const categoryDir = path.join(OUTPUT_DIR, categoryName);
    await fs.mkdir(categoryDir, { recursive: true });

    const categoryDocs = new Map();

    // Search with all terms
    for (const term of searchTerms) {
      const results = await this.searchLegislation(term);

      for (const result of results) {
        const eli = result.item.eli || result.item['@id'];
        if (!categoryDocs.has(eli) && !this.allDocuments.has(eli)) {
          categoryDocs.set(eli, result);
          this.allDocuments.set(eli, result);
        }
      }

      await this.sleep(500); // Rate limiting
    }

    console.log(`\n📦 Unique documents in category: ${categoryDocs.size}`);

    if (categoryDocs.size === 0) {
      console.log(`⚠️  No documents to download`);
      return 0;
    }

    console.log(`⏬ Starting downloads (limit: 10 for testing)...\n`);

    let count = 0;
    const MAX_DOWNLOADS = 10; // TEST LIMIT

    for (const [eli, result] of categoryDocs) {
      if (count >= MAX_DOWNLOADS) {
        console.log(`\n⚠️  Reached test limit of ${MAX_DOWNLOADS} documents`);
        break;
      }

      await this.downloadDocument(result, categoryDir);
      count++;

      if (count % 5 === 0) {
        console.log(`   Progress: ${count}/${Math.min(categoryDocs.size, MAX_DOWNLOADS)}`);
      }

      await this.sleep(1000); // Rate limiting between downloads
    }

    return count;
  }

  /**
   * Generate comprehensive report
   */
  async generateReport() {
    const reportPath = path.join(OUTPUT_DIR, 'DOWNLOAD_REPORT.md');

    const report = `# Social Services Federal Legislation Download Report

**Generated:** ${new Date().toISOString()}
**Output Directory:** ${OUTPUT_DIR}

## Download Statistics

- **Total searches performed:** ${this.stats.searched}
- **Total results found:** ${this.stats.found}
- **Unique documents downloaded:** ${this.stats.downloaded}
- **Errors encountered:** ${this.stats.errors}

## Files Downloaded by Format

- **JSON metadata:** ${this.stats.formats.json} files
- **HTML (human-readable):** ${this.stats.formats.html} files
- **XML (LegalDocML):** ${this.stats.formats.xml} files
- **Markdown summaries:** ${this.stats.formats.markdown} files

## Major Laws That Should Be Present

Check for these critical social services laws:
- [ ] SGB VIII (Kinder- und Jugendhilfe) - Core youth welfare law
- [ ] SGB II (Grundsicherung für Arbeitsuchende) - Basic income support
- [ ] SGB IX (Rehabilitation und Teilhabe) - Disability support
- [ ] SGB XII (Sozialhilfe) - Social assistance
- [ ] BEEG (Bundeselterngeld- und Elternzeitgesetz) - Parental benefits
- [ ] AsylbLG (Asylbewerberleistungsgesetz) - Asylum seeker support
- [ ] BAföG (Bundesausbildungsförderungsgesetz) - Education support
- [ ] JuSchG (Jugendschutzgesetz) - Youth protection

See category folders to verify all are present.

## File Formats

### JSON Metadata (\`*_metadata.json\`)
Document information, links, search excerpts, timestamp

### Full JSON (\`*_full.json\`)
Complete document structure with all paragraphs and sections

### HTML (\`*.html\`)
Human-readable format, can be opened in any browser

### LegalDocML XML (\`*.xml\`)
Structured legal format (European standard), machine-readable

### Markdown (\`*.md\`)
Documentation format with quick reference and relevant excerpts

## Source

Source: rechtsinformationen.bund.de (official federal portal)
Status: Trial phase
Scope: FEDERAL law only (Baden-Württemberg state law requires separate access)

---

*This data is provided for informational purposes. Always consult official sources for legal decisions.*
`;

    await fs.writeFile(reportPath, report);
    console.log(`\n📄 Report saved: ${reportPath}`);
  }

  /**
   * Sleep helper for rate limiting
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Main execution
   */
  async run() {
    console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║  Enhanced Social Services Legislation Batch Downloader                 ║
║  Focus: Baden-Württemberg Ministry of Social Affairs, Youth            ║
║  Source: rechtsinformationen.bund.de (Federal Law)                     ║
║  Formats: JSON, HTML, XML (LegalDocML), Markdown                       ║
╚════════════════════════════════════════════════════════════════════════╝
`);

    try {
      // Create output directory
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      console.log(`📁 Output directory: ${OUTPUT_DIR}\n`);

      // Download each category
      for (const [categoryName, searchTerms] of Object.entries(SOCIAL_LAW_CATEGORIES)) {
        await this.downloadCategory(categoryName, searchTerms);
      }

      // Generate final report
      await this.generateReport();

      console.log(`\n${'='.repeat(80)}`);
      console.log(`✅ DOWNLOAD COMPLETE`);
      console.log(`${'='.repeat(80)}`);
      console.log(`📊 Statistics:`);
      console.log(`   Searches: ${this.stats.searched}`);
      console.log(`   Results found: ${this.stats.found}`);
      console.log(`   Unique documents: ${this.stats.downloaded}`);
      console.log(`   Errors: ${this.stats.errors}`);
      console.log(`\n📦 Files by format:`);
      console.log(`   JSON: ${this.stats.formats.json}`);
      console.log(`   HTML: ${this.stats.formats.html}`);
      console.log(`   XML (LegalDocML): ${this.stats.formats.xml}`);
      console.log(`   Markdown: ${this.stats.formats.markdown}`);
      console.log(`\n📁 Location: ${OUTPUT_DIR}`);
      console.log(`📄 See DOWNLOAD_REPORT.md for details\n`);

    } catch (error) {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    }
  }
}

// Run
const downloader = new EnhancedSocialLawDownloader();
downloader.run().catch(console.error);
