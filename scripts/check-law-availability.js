#!/usr/bin/env node

/**
 * Law Availability Checker
 *
 * Reads known_laws.json from observation project and checks if each law
 * is available in rechtsinformationen.bund.de API.
 *
 * Creates: data/law_availability.json with results
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://testphase.rechtsinformationen.bund.de/v1';
const SOURCE_FILE = '/Users/wolfgang/workspace/observation/observation_extractor/data/known_laws.json';
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'law_availability.json');

// Rate limiting
const DELAY_MS = 500; // 500ms between requests to avoid overwhelming API
const BATCH_SIZE = 50; // Process in batches, save progress

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert API document_id to human-readable HTML URL
 * /v1/legislation/eli/bund/... → https://testphase.rechtsinformationen.bund.de/norms/eli/bund/...
 */
function convertToHtmlUrl(documentId) {
  if (!documentId) return null;

  // Remove /v1/legislation prefix and add norms prefix
  if (documentId.startsWith('/v1/legislation/eli/')) {
    const eliPath = documentId.replace('/v1/legislation/', '');
    return `https://testphase.rechtsinformationen.bund.de/norms/${eliPath}`;
  }

  return null;
}

async function checkLawAvailability(abbreviation, fullName) {
  try {
    // Strategy 1: Search by abbreviation
    const abbrResponse = await axios.get(`${BASE_URL}/legislation`, {
      params: { searchTerm: abbreviation, size: 5 },
      timeout: 10000,
    });

    // Check if we got exact or close match
    if (abbrResponse.data.member && abbrResponse.data.member.length > 0) {
      for (const result of abbrResponse.data.member) {
        const law = result.item;
        const lawAbbr = (law.abbreviation || '').trim().toUpperCase();
        const searchAbbr = abbreviation.trim().toUpperCase();
        const lawName = (law.name || law.headline || '').toUpperCase();
        const searchName = fullName.toUpperCase();

        // Exact abbreviation match
        if (lawAbbr === searchAbbr) {
          const documentId = law['@id'] || null;
          return {
            available: true,
            match_type: 'exact_abbreviation',
            found_name: law.name || law.headline,
            found_abbreviation: law.abbreviation,
            eli: law.eli || null,
            document_id: documentId,
            html_url: convertToHtmlUrl(documentId),
          };
        }

        // Partial name match (at least 50% of words)
        if (lawName.includes(searchName.substring(0, 30))) {
          const documentId = law['@id'] || null;
          return {
            available: true,
            match_type: 'partial_name',
            found_name: law.name || law.headline,
            found_abbreviation: law.abbreviation,
            eli: law.eli || null,
            document_id: documentId,
            html_url: convertToHtmlUrl(documentId),
          };
        }
      }
    }

    // Strategy 2: Search by full name (first 50 chars)
    await delay(DELAY_MS);
    const nameQuery = fullName.replace(/PDF$/, '').trim().substring(0, 50);
    const nameResponse = await axios.get(`${BASE_URL}/legislation`, {
      params: { searchTerm: nameQuery, size: 5 },
      timeout: 10000,
    });

    if (nameResponse.data.member && nameResponse.data.member.length > 0) {
      for (const result of nameResponse.data.member) {
        const law = result.item;
        const lawName = (law.name || law.headline || '').toUpperCase();
        const searchName = nameQuery.toUpperCase();

        // Close name match
        if (lawName.includes(searchName.substring(0, 20))) {
          const documentId = law['@id'] || null;
          return {
            available: true,
            match_type: 'name_search',
            found_name: law.name || law.headline,
            found_abbreviation: law.abbreviation,
            eli: law.eli || null,
            document_id: documentId,
            html_url: convertToHtmlUrl(documentId),
          };
        }
      }
    }

    // Not found
    return {
      available: false,
      match_type: null,
      found_name: null,
      found_abbreviation: null,
      eli: null,
      document_id: null,
      html_url: null,
    };

  } catch (error) {
    console.error(`  Error checking ${abbreviation}: ${error.message}`);
    return {
      available: false,
      match_type: 'error',
      error: error.message,
      found_name: null,
      found_abbreviation: null,
      eli: null,
      document_id: null,
      html_url: null,
    };
  }
}

async function main() {
  console.log('🔍 Law Availability Checker');
  console.log('═'.repeat(60));
  console.log('');

  // Read source file
  console.log(`📖 Reading source: ${SOURCE_FILE}`);
  const sourceData = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf-8'));
  const laws = sourceData.laws;
  const lawEntries = Object.entries(laws);
  const totalLaws = lawEntries.length;

  console.log(`   Found ${totalLaws} laws to check`);
  console.log('');

  // Prepare output directory
  const dataDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Check if we have existing progress
  let results = {
    generated_at: new Date().toISOString(),
    source: SOURCE_FILE,
    api_base_url: BASE_URL,
    total_laws: totalLaws,
    checked: 0,
    available: 0,
    unavailable: 0,
    errors: 0,
    laws: {},
  };

  if (fs.existsSync(OUTPUT_FILE)) {
    console.log('📂 Found existing progress, resuming...');
    results = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    console.log(`   Already checked: ${results.checked}/${totalLaws}`);
    console.log('');
  }

  // Process laws in batches
  let processedInSession = 0;
  const startIdx = results.checked;

  for (let i = startIdx; i < totalLaws; i++) {
    const [abbreviation, lawData] = lawEntries[i];
    const fullName = lawData.full_name.replace(/PDF$/, '').trim();

    console.log(`[${i + 1}/${totalLaws}] Checking: ${abbreviation}`);
    console.log(`   Name: ${fullName.substring(0, 60)}...`);

    const availability = await checkLawAvailability(abbreviation, fullName);

    results.laws[abbreviation] = {
      full_name: fullName,
      url: lawData.url,
      ...availability,
      checked_at: new Date().toISOString(),
    };

    results.checked = i + 1;
    if (availability.available) {
      results.available++;
      console.log(`   ✅ FOUND: ${availability.match_type}`);
    } else {
      results.unavailable++;
      console.log(`   ❌ NOT FOUND`);
    }
    if (availability.error) {
      results.errors++;
    }
    console.log('');

    processedInSession++;

    // Save progress every BATCH_SIZE laws
    if (processedInSession % BATCH_SIZE === 0) {
      console.log('💾 Saving progress...');
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
      console.log(`   Saved: ${results.checked}/${totalLaws} checked`);
      console.log(`   Available: ${results.available}, Unavailable: ${results.unavailable}`);
      console.log('');
    }

    // Rate limiting
    await delay(DELAY_MS);
  }

  // Final save
  console.log('');
  console.log('═'.repeat(60));
  console.log('✅ COMPLETE');
  console.log('');
  console.log('📊 Final Statistics:');
  console.log(`   Total Laws: ${results.total_laws}`);
  console.log(`   Checked: ${results.checked}`);
  console.log(`   Available: ${results.available} (${((results.available / results.checked) * 100).toFixed(1)}%)`);
  console.log(`   Unavailable: ${results.unavailable} (${((results.unavailable / results.checked) * 100).toFixed(1)}%)`);
  console.log(`   Errors: ${results.errors}`);
  console.log('');
  console.log(`💾 Results saved to: ${OUTPUT_FILE}`);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
