#!/usr/bin/env node

import axios from 'axios';

const BASE_URL = 'https://testphase.rechtsinformationen.bund.de/v1';

async function testUrlGeneration() {
  console.log('🔗 Testing URL Generation for Different Document Types');
  console.log('=' .repeat(60));
  
  // Test with the specific search that was problematic
  const searchTerm = "SGB II § 31 § 32 Pflichtverletzung";
  console.log(`\nTesting search: "${searchTerm}"`);
  
  try {
    const response = await axios.get(`${BASE_URL}/document`, {
      params: { searchTerm, limit: 5 }
    });
    
    const results = response.data.member || [];
    console.log(`Found ${results.length} results\n`);
    
    results.forEach((result, index) => {
      const doc = result.item;
      const isLegislation = doc['@type'] === 'Legislation';
      
      console.log(`📋 Result ${index + 1}: ${doc.headline || 'No headline'}`);
      console.log(`   Type: ${doc['@type']}`);
      console.log(`   Court: ${doc.courtName || 'N/A'}`);
      console.log(`   ECLI: ${doc.ecli || 'N/A'}`);
      console.log(`   Original API URL: ${doc['@id']}`);
      
      // Generate human-readable URL using the same logic as the fixed code
      let humanUrl;
      if (isLegislation) {
        let documentUrl = doc['@id'];
        if (doc.workExample && doc.workExample['@id']) {
          documentUrl = doc.workExample['@id'];
        }
        humanUrl = `https://testphase.rechtsinformationen.bund.de${documentUrl.replace('/v1/legislation/', '/norms/')}`;
      } else {
        if (doc.ecli) {
          humanUrl = `https://www.rechtsinformationen.bund.de/ecli/${doc.ecli}`;
        } else {
          const caseId = doc['@id'].replace('/v1/case-law/', '');
          humanUrl = `https://www.rechtsinformationen.bund.de/case-law/${caseId}`;
        }
      }
      
      console.log(`   ✅ Human-readable URL: ${humanUrl}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testUrlGeneration().catch(console.error);