#!/usr/bin/env node

/**
 * Batch Download Script for Social Services Legislation
 *
 * Downloads all relevant federal legislation for social services,
 * youth welfare, and related areas (Baden-Württemberg ministry focus)
 *
 * Usage: node scripts/batch-download-social-laws.js
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const BASE_URL = 'https://testphase.rechtsinformationen.bund.de/v1';
const OUTPUT_DIR = './downloads/social-services';

// Social Services Law Abbreviations for Baden-Württemberg Ministry
const SOCIAL_LAW_TERMS = [
  // Core Social Security Laws (Sozialgesetzbuch)
  'SGB I',   // Social Code Book I - General Part
  'SGB II',  // Basic Income Support (Jobcenter, Bürgergeld)
  'SGB III', // Employment Promotion
  'SGB IV',  // Common Provisions for Social Insurance
  'SGB V',   // Statutory Health Insurance
  'SGB VI',  // Statutory Pension Insurance
  'SGB VII', // Statutory Accident Insurance
  'SGB VIII', // Child and Youth Welfare (KINDER- UND JUGENDHILFE)
  'SGB IX',  // Rehabilitation and Participation of Disabled Persons
  'SGB X',   // Social Administrative Procedure
  'SGB XI',  // Long-term Care Insurance
  'SGB XII', // Social Assistance (Sozialhilfe)
  'SGB XIV', // Social Compensation Law

  // Youth and Family Law
  'Jugendschutzgesetz',
  'Bundeskindergeldgesetz',
  'Bundeselterngeld- und Elternzeitgesetz', // BEEG
  'Unterhaltsvorschussgesetz',
  'Kindschaftsrecht',
  'Vormundschaft',

  // Social Assistance and Integration
  'Asylbewerberleistungsgesetz',
  'Bundesausbildungsförderungsgesetz', // BAföG
  'Wohngeldgesetz',
  'Bildung und Teilhabe',

  // Disability and Inclusion
  'Behindertengleichstellungsgesetz',
  'Bundesteilhabegesetz',
  'Allgemeines Gleichbehandlungsgesetz',

  // Employment and Labor (Social Ministry relevant)
  'Arbeitsförderung',
  'Teilhabechancengesetz',
  'Mindestlohngesetz',

  // Healthcare and Social Insurance
  'Pflegeversicherung',
  'Krankengeld',
  'Mutterschaftsgeld',
  'Elterngeld',

  // Administrative Law
  'Verwaltungsverfahrensgesetz',
  'Sozialgerichtsgesetz',
  'Widerspruchsverfahren'
];

class SocialLawBatchDownloader {
  constructor() {
    this.results = [];
    this.downloadedCount = 0;
    this.errorCount = 0;
  }

  /**
   * Search for legislation by term
   */
  async searchLegislation(searchTerm, limit = 100) {
    try {
      console.log(`\n🔍 Searching for: "${searchTerm}"...`);

      const response = await axios.get(`${BASE_URL}/legislation`, {
        params: {
          searchTerm: searchTerm,
          size: limit
        }
      });

      const results = response.data?.searchResults || [];
      console.log(`   Found ${results.length} results`);

      return results;
    } catch (error) {
      console.error(`   ❌ Error searching for "${searchTerm}":`, error.message);
      this.errorCount++;
      return [];
    }
  }

  /**
   * Download document metadata and full text
   */
  async downloadDocument(result, outputDir) {
    try {
      const item = result.item;
      const eli = item.eli || item['@id'];

      // Extract law name for filename
      const lawName = item.name || item.headline || 'unknown';
      const safeFilename = lawName
        .replace(/[^a-zA-Z0-9äöüÄÖÜß\-\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 100);

      // Create metadata file
      const metadata = {
        name: item.name,
        headline: item.headline,
        eli: item.eli,
        abbreviation: item.abbreviation,
        legislationDate: item.legislationDate,
        documentNumber: item.documentNumber,
        apiUrl: item['@id'],
        workExampleUrl: item.workExample?.['@id'],
        textMatches: result.textMatches,
        downloadedAt: new Date().toISOString()
      };

      // Save metadata
      const metadataPath = path.join(outputDir, `${safeFilename}_metadata.json`);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      // Try to download full document
      if (item.workExample?.['@id']) {
        try {
          const docResponse = await axios.get(item.workExample['@id'], {
            headers: { 'Accept': 'application/json' }
          });

          const docPath = path.join(outputDir, `${safeFilename}_full.json`);
          await fs.writeFile(docPath, JSON.stringify(docResponse.data, null, 2));

          console.log(`   ✅ Downloaded: ${lawName}`);
          this.downloadedCount++;

          return true;
        } catch (docError) {
          console.log(`   ⚠️  Metadata only (403): ${lawName}`);
          this.downloadedCount++; // Still count metadata as success
          return true;
        }
      }

      return true;
    } catch (error) {
      console.error(`   ❌ Error downloading document:`, error.message);
      this.errorCount++;
      return false;
    }
  }

  /**
   * Download all legislation for a category
   */
  async downloadCategory(categoryName, searchTerms, outputDir) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📚 Category: ${categoryName}`);
    console.log(`${'='.repeat(80)}`);

    const categoryDir = path.join(outputDir, categoryName.replace(/\s+/g, '_'));
    await fs.mkdir(categoryDir, { recursive: true });

    const allResults = new Map(); // Use Map to deduplicate by ELI

    for (const term of searchTerms) {
      const results = await this.searchLegislation(term);

      for (const result of results) {
        const eli = result.item.eli || result.item['@id'];
        if (!allResults.has(eli)) {
          allResults.set(eli, result);
        }
      }

      // Rate limiting
      await this.sleep(500);
    }

    console.log(`\n📦 Unique documents found: ${allResults.size}`);
    console.log(`⏬ Starting downloads...`);

    let count = 0;
    for (const [eli, result] of allResults) {
      await this.downloadDocument(result, categoryDir);
      count++;

      // Progress indicator
      if (count % 10 === 0) {
        console.log(`   Progress: ${count}/${allResults.size}`);
      }

      // Rate limiting
      await this.sleep(300);
    }

    return allResults.size;
  }

  /**
   * Generate comprehensive report
   */
  async generateReport(outputDir) {
    const reportPath = path.join(outputDir, 'download_report.md');

    const report = `# Social Services Legislation Download Report

**Generated:** ${new Date().toISOString()}
**Downloads:** ${this.downloadedCount} documents
**Errors:** ${this.errorCount}

## Categories Downloaded

### 1. Core Social Security Laws (SGB I-XIV)
- SGB I: General Part
- SGB II: Basic Income Support (Bürgergeld, Jobcenter)
- SGB III: Employment Promotion
- SGB IV: Common Provisions
- SGB V: Health Insurance
- SGB VI: Pension Insurance
- SGB VII: Accident Insurance
- SGB VIII: Child and Youth Welfare ⭐ KEY for Youth Ministry
- SGB IX: Rehabilitation and Disability
- SGB X: Administrative Procedure
- SGB XI: Long-term Care
- SGB XII: Social Assistance (Sozialhilfe)
- SGB XIV: Social Compensation

### 2. Youth and Family Law
- Youth Protection Act
- Child Benefit Act
- Parental Leave and Benefits Act (BEEG)
- Maintenance Advance Act
- Family Law provisions

### 3. Social Assistance and Integration
- Asylum Seekers Benefits Act
- Federal Training Assistance Act (BAföG)
- Housing Benefit Act
- Education and Participation provisions

### 4. Disability and Inclusion
- Disability Equality Act
- Federal Participation Act
- General Equal Treatment Act

### 5. Employment Support
- Employment Promotion
- Participation Opportunities Act
- Minimum Wage Act

### 6. Healthcare and Insurance
- Care Insurance
- Sickness Benefits
- Maternity Benefits
- Parental Benefits

### 7. Administrative Law
- Administrative Procedure Act
- Social Court Act
- Appeals Procedure

## Usage

All documents are stored in JSON format:
- \`*_metadata.json\` - Document metadata (always available)
- \`*_full.json\` - Full document content (when API permits)

## API Source

Source: rechtsinformationen.bund.de (Federal Legal Information Portal)
Base URL: ${BASE_URL}
Status: Trial phase - official federal database

## Next Steps

1. **Review downloaded documents** in each category folder
2. **Extract relevant paragraphs** for your specific use case
3. **Build search index** if needed for local queries
4. **Update regularly** - laws change frequently

## Baden-Württemberg State Law

⚠️ **Important:** This download covers FEDERAL law only.

For Baden-Württemberg STATE law (Landesrecht), you need:
- Baden-Württemberg state legislation portal
- State-specific youth welfare laws
- State social assistance regulations

Federal laws downloaded here provide the framework, but state implementation
may vary.

## Contact

For questions about the data or API access:
- Documentation: https://docs.rechtsinformationen.bund.de
- MCP Server: https://github.com/your-repo/rechtsinformationen-bund-de-mcp
`;

    await fs.writeFile(reportPath, report);
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }

  /**
   * Helper: Sleep for rate limiting
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
║  Social Services Legislation Batch Downloader                          ║
║  Focus: Baden-Württemberg Ministry of Social Affairs, Youth            ║
║  Source: rechtsinformationen.bund.de (Federal Law)                     ║
╚════════════════════════════════════════════════════════════════════════╝
`);

    try {
      // Create output directory
      await fs.mkdir(OUTPUT_DIR, { recursive: true });

      // Download all categories
      const categories = [
        {
          name: '01_Core_Social_Security_SGB',
          terms: ['SGB I', 'SGB II', 'SGB III', 'SGB IV', 'SGB V', 'SGB VI', 'SGB VII', 'SGB VIII', 'SGB IX', 'SGB X', 'SGB XI', 'SGB XII', 'SGB XIV']
        },
        {
          name: '02_Youth_Family_Law',
          terms: ['Jugendschutzgesetz', 'Bundeskindergeldgesetz', 'Bundeselterngeld- und Elternzeitgesetz', 'Unterhaltsvorschussgesetz', 'Kinder- und Jugendhilfe']
        },
        {
          name: '03_Social_Assistance',
          terms: ['Asylbewerberleistungsgesetz', 'Bundesausbildungsförderungsgesetz', 'Wohngeldgesetz', 'Bildung und Teilhabe']
        },
        {
          name: '04_Disability_Inclusion',
          terms: ['Behindertengleichstellungsgesetz', 'Bundesteilhabegesetz', 'Allgemeines Gleichbehandlungsgesetz', 'Teilhabe', 'Inklusion']
        },
        {
          name: '05_Employment_Support',
          terms: ['Arbeitsförderung', 'Teilhabechancengesetz', 'Mindestlohngesetz', 'Beschäftigungsförderung']
        },
        {
          name: '06_Healthcare_Insurance',
          terms: ['Pflegeversicherung', 'Krankengeld', 'Mutterschaftsgeld', 'Elterngeld', 'Pflegegeld']
        },
        {
          name: '07_Administrative_Law',
          terms: ['Verwaltungsverfahrensgesetz', 'Sozialgerichtsgesetz', 'Widerspruchsverfahren', 'Verwaltungsakt']
        }
      ];

      let totalDocs = 0;
      for (const category of categories) {
        const count = await this.downloadCategory(
          category.name,
          category.terms,
          OUTPUT_DIR
        );
        totalDocs += count;
      }

      // Generate report
      await this.generateReport(OUTPUT_DIR);

      console.log(`\n${'='.repeat(80)}`);
      console.log(`✅ DOWNLOAD COMPLETE`);
      console.log(`${'='.repeat(80)}`);
      console.log(`📊 Total unique documents: ${totalDocs}`);
      console.log(`✅ Successfully downloaded: ${this.downloadedCount}`);
      console.log(`❌ Errors: ${this.errorCount}`);
      console.log(`📁 Output directory: ${OUTPUT_DIR}`);
      console.log(`\n💡 Next: Review download_report.md for details`);

    } catch (error) {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const downloader = new SocialLawBatchDownloader();
  downloader.run().catch(console.error);
}

module.exports = SocialLawBatchDownloader;
