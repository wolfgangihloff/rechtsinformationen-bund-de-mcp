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
 * Usage: node scripts/batch-download-enhanced.js
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const BASE_URL = 'https://testphase.rechtsinformationen.bund.de/v1';
const OUTPUT_DIR = './tmp/bund-social';

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

      const response = await axios.get(`${BASE_URL}/legislation`, {
        params: { searchTerm, size: limit },
        timeout: 30000
      });

      const results = response.data?.searchResults || [];
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
        apiUrl: item['@id'],
        workExampleUrl: item.workExample?.['@id'],
        htmlUrl: this.convertToHtmlUrl(item.workExample?.['@id'] || item['@id']),
        textMatches: result.textMatches,
        downloadedAt: new Date().toISOString()
      };

      await fs.writeFile(`${baseFilename}_metadata.json`, JSON.stringify(metadata, null, 2));
      this.stats.formats.json++;

      // 2. Download full JSON document
      if (item.workExample?.['@id']) {
        try {
          const jsonDoc = await axios.get(item.workExample['@id'], {
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
      const xmlUrl = (item.workExample?.['@id'] || item['@id']).replace(/\/deu$/, '/deu/regelungstext-1.xml');
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

    // Convert /v1/legislation/eli/... to /norms/eli/.../regelungstext-1.html
    return apiUrl
      .replace('/v1/legislation/eli/', '/norms/eli/')
      .replace('/v1/case-law/', '/rechtsprechung/')
      + '/regelungstext-1.html';
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

    console.log(`⏬ Starting downloads...\n`);

    let count = 0;
    for (const [eli, result] of categoryDocs) {
      await this.downloadDocument(result, categoryDir);
      count++;

      if (count % 5 === 0) {
        console.log(`   Progress: ${count}/${categoryDocs.size}`);
      }

      await this.sleep(1000); // Rate limiting between downloads
    }

    return categoryDocs.size;
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

## Categories Covered

### 1. SGB (Sozialgesetzbuch) - Social Code Books I-XIV
Complete set of German social security legislation:
- **SGB I:** General Part (foundation for all social law)
- **SGB II:** Basic Income Support (Bürgergeld, Jobcenter)
- **SGB III:** Employment Promotion
- **SGB IV:** Common Provisions for Social Insurance
- **SGB V:** Statutory Health Insurance
- **SGB VI:** Statutory Pension Insurance
- **SGB VII:** Statutory Accident Insurance
- **SGB VIII:** Child and Youth Welfare ⭐ **PRIMARY for Youth Ministry**
- **SGB IX:** Rehabilitation and Participation of Disabled Persons
- **SGB X:** Social Administrative Procedure (complaints, appeals)
- **SGB XI:** Long-term Care Insurance
- **SGB XII:** Social Assistance (Sozialhilfe)
- **SGB XIV:** Social Compensation Law

### 2. Youth and Family Law
- Youth Protection Act (Jugendschutzgesetz)
- Federal Child Benefit Act
- Parental Leave and Benefits Act (BEEG)
- Maintenance Advance Act
- Adoption and foster care regulations
- Guardianship and curatorship

### 3. Social Assistance and Integration
- Asylum Seekers Benefits Act (AsylbLG)
- Federal Training Assistance Act (BAföG)
- Housing Benefit Act (Wohngeldgesetz)
- Education and Participation Package
- Basic security provisions

### 4. Disability and Inclusion
- Disability Equality Act (BGG)
- Federal Participation Act (BTHG)
- General Equal Treatment Act (AGG)
- Rehabilitation services
- Inclusion measures

### 5. Employment and Integration
- Participation Opportunities Act
- Minimum Wage Act
- Employment promotion programs
- Integration support

### 6. Healthcare and Care
- Care Insurance (Pflegeversicherung)
- Care Support Acts
- Sickness benefits
- Maternity and parental benefits
- Family care leave

### 7. Administrative Procedure
- Administrative Procedure Act (VwVfG)
- Social Court Act (SGG)
- Appeals and objection procedures
- Right to hearing
- File inspection rights

## File Formats Explained

### JSON Metadata (\`*_metadata.json\`)
- Document information
- Links to all versions
- Search excerpts
- Download timestamp

### Full JSON (\`*_full.json\`)
- Complete document structure
- All paragraphs and sections
- Amendment history
- Legal relationships

### HTML (\`*.html\`)
- Human-readable format
- Rendered law text
- Can be opened in any browser
- Includes formatting and structure

### LegalDocML XML (\`*.xml\`)
- Structured legal format
- European standard
- Machine-readable
- Suitable for legal tech applications
- Contains semantic markup

### Markdown (\`*.md\`)
- Documentation format
- Quick reference
- Relevant excerpts
- Links to all versions

## Usage Examples

### Reading a Law
\`\`\`bash
# Open HTML version in browser
open "tmp/bund-social/SGB_Social_Code_Books/SGB_VIII_*.html"

# View markdown summary
cat "tmp/bund-social/SGB_Social_Code_Books/SGB_VIII_*.md"
\`\`\`

### Searching Downloaded Laws
\`\`\`bash
# Search all markdown files
grep -r "Jugendamt" tmp/bund-social/**/*.md

# Search XML for specific paragraph
grep -r "§ 8a" tmp/bund-social/**/*.xml
\`\`\`

### Processing with Tools
\`\`\`python
# Python example - parse LegalDocML
import xml.etree.ElementTree as ET

tree = ET.parse('tmp/bund-social/.../SGB_VIII.xml')
# Process structured legal data
\`\`\`

## Important Notes

### ⚠️ Federal Law Only
This download contains **FEDERAL** legislation only. Baden-Württemberg state law (Landesrecht) requires separate access to state portals.

Federal laws provide the framework, but:
- States implement with variations
- Local regulations may apply
- Administrative practices differ by region

### Data Freshness
Laws change frequently. Recommended update schedule:
- **Weekly:** SGB II (Jobcenter/Bürgergeld - rapid changes)
- **Monthly:** SGB VIII, employment laws
- **Quarterly:** Stable administrative procedures
- **On notification:** Specific amendments affecting your work

### Legal Status
Source: rechtsinformationen.bund.de (official federal portal)
- ✅ Authoritative source for federal law
- ✅ Suitable for research and application development
- ⚠️ Always cite original sources for legal work
- ⚠️ Verify critical information with official sources
- ❌ Not a substitute for legal advice

## Cross-Reference Validation

Major federal social services laws that should be present:
- [ ] SGB VIII (Kinder- und Jugendhilfe) - Core youth welfare law
- [ ] SGB II (Grundsicherung für Arbeitsuchende) - Basic income support
- [ ] SGB IX (Rehabilitation und Teilhabe) - Disability support
- [ ] SGB XII (Sozialhilfe) - Social assistance
- [ ] BEEG (Bundeselterngeld- und Elternzeitgesetz) - Parental benefits
- [ ] AsylbLG (Asylbewerberleistungsgesetz) - Asylum seeker support
- [ ] BAföG (Bundesausbildungsförderungsgesetz) - Education support
- [ ] JuSchG (Jugendschutzgesetz) - Youth protection

Check the category folders to verify all are present.

## Next Steps

1. **Review downloaded documents** in each category folder
2. **Verify completeness** using checklist above
3. **Build search index** if needed for faster queries
4. **Extract key provisions** relevant to your ministry work
5. **Set up update schedule** for regular refreshes
6. **Integrate with workflows** - use JSON/XML for automation

## Support

- **API Documentation:** https://docs.rechtsinformationen.bund.de
- **MCP Server:** See main project README
- **Issues:** Report download problems via GitHub

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

// Run if executed directly
if (require.main === module) {
  const downloader = new EnhancedSocialLawDownloader();
  downloader.run().catch(console.error);
}

module.exports = EnhancedSocialLawDownloader;
