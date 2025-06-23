#!/usr/bin/env node

import axios from 'axios';

const BASE_URL = 'https://testphase.rechtsinformationen.bund.de/v1';

async function testSemanticSearch() {
  console.log('🧠 Testing Improved Semantic Search');
  console.log('=' .repeat(50));
  
  const testQuery = "Termin Jobcenter verpassen Konsequenzen Sanktionen Bürgergeld";
  console.log(`Query: "${testQuery}"`);
  
  // Test the approach the improved semantic search will use
  const keyTerms = testQuery.split(/\s+/).filter(term => term.length > 3);
  const legalExpansions = ['Meldeversäumnis', 'SGB II 32', '§ 32 SGB II', 'Pflichtverletzung', 'Minderung'];
  
  const searchTerms = [testQuery, ...keyTerms, ...legalExpansions].slice(0, 8); // Include more terms
  
  console.log('\nSearch terms to try:', searchTerms);
  
  let totalResults = 0;
  
  for (const searchTerm of searchTerms) {
    console.log(`\n🔍 Searching: "${searchTerm}"`);
    
    try {
      const response = await axios.get(`${BASE_URL}/document`, {
        params: { searchTerm, limit: 10 }
      });
      
      const results = response.data.member || [];
      console.log(`   Found: ${results.length} results`);
      totalResults += results.length;
      
      // Show relevant results
      results.slice(0, 2).forEach((result, i) => {
        const item = result.item;
        const content = (result.textMatches || []).map(m => m.text).join(' ');
        
        if (content.toLowerCase().includes('meldeversäumnis') || 
            content.toLowerCase().includes('sgb') ||
            content.toLowerCase().includes('sanktion')) {
          console.log(`   ✅ ${i + 1}. ${item.headline || 'No headline'}`);
          console.log(`      Content preview: ${content.substring(0, 100)}...`);
        }
      });
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log(`\n📊 Total results collected: ${totalResults}`);
  console.log('💡 This should now provide documents for semantic matching!');
}

testSemanticSearch().catch(console.error);