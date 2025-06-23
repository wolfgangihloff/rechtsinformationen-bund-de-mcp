#!/usr/bin/env node

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://testphase.rechtsinformationen.bund.de/v1';

// Load golden test cases from JSON file
const goldenTestsPath = path.join(process.cwd(), 'tests', 'golden_case_tests.json');
let goldenTests = [];

try {
  const jsonData = fs.readFileSync(goldenTestsPath, 'utf8');
  const testCases = JSON.parse(jsonData);
  
  // Convert JSON format to test format
  goldenTests = testCases.map(testCase => ({
    id: testCase.id,
    question: testCase.query,
    title: testCase.title,
    expectedHit: testCase.expected_case_reference?.ecli || testCase.relevant_norms?.join(', ') || 'Unknown',
    expectedCase: testCase.expected_case_reference,
    searchTerms: generateSearchTerms(testCase),
    expectedLaw: extractLawFromNorms(testCase.relevant_norms),
    evaluationCriteria: testCase.evaluation_criteria,
    expectedSummary: testCase.expected_summary,
    difficulty: testCase.difficulty,
    tags: testCase.tags
  }));
  
  console.log(`📋 Loaded ${goldenTests.length} golden test cases from ${goldenTestsPath}`);
} catch (error) {
  console.error(`❌ Error loading golden test cases: ${error.message}`);
  console.log('Using fallback test cases...');
  
  // Fallback to original test cases
  goldenTests = [
    {
      question: "Was passiert, wenn ich einen Termin beim Jobcenter verpasse?",
      expectedHit: "§ 32 SGB II – Meldeversäumnis",
      searchTerms: ["Meldeversäumnis", "Jobcenter Termin verpassen", "SGB II 32"],
      expectedLaw: "SGB II"
    },
    {
      question: "Wie lange kann ich in Elternzeit gehen?",
      expectedHit: "§ 15 BEEG",
      searchTerms: ["Elternzeit Dauer", "BEEG 15", "Elternzeit"],
      expectedLaw: "BEEG"
    }
  ];
}

function generateSearchTerms(testCase) {
  const terms = [];
  
  // Add case number if available
  if (testCase.expected_case_reference?.case_number) {
    terms.push(testCase.expected_case_reference.case_number);
  }
  
  // Add ECLI if available
  if (testCase.expected_case_reference?.ecli) {
    terms.push(testCase.expected_case_reference.ecli);
  }
  
  // Add court name
  if (testCase.expected_case_reference?.court) {
    terms.push(testCase.expected_case_reference.court);
  }
  
  // Extract key terms from query
  const query = testCase.query.toLowerCase();
  const keyTerms = [];
  
  if (query.includes('bundestag')) keyTerms.push('Bundestag', 'Auflösung');
  if (query.includes('dashcam')) keyTerms.push('Dashcam', 'Beweismittel');
  if (query.includes('schimmel')) keyTerms.push('Schimmel', 'Beweislast', 'Mietrecht');
  if (query.includes('kopftuch')) keyTerms.push('Kopftuch', 'Lehrerin', 'Religionsfreiheit');
  if (query.includes('bürgergeld') || query.includes('hartz')) keyTerms.push('Bürgergeld', 'Sanktionen', 'Hartz IV');
  
  terms.push(...keyTerms);
  
  // Add some generic terms from the query
  const words = testCase.query.split(' ').filter(word => word.length > 4);
  terms.push(...words.slice(0, 3));
  
  return terms.filter((term, index, self) => self.indexOf(term) === index).slice(0, 8);
}

function extractLawFromNorms(norms) {
  if (!norms || norms.length === 0) return null;
  
  const lawPattern = /(GG|BGB|SGB|StGB|VwVfG|BEEG|BDSG|DSGVO)/;
  for (const norm of norms) {
    const match = norm.match(lawPattern);
    if (match) return match[1];
  }
  return null;
}

async function searchAPI(searchTerm, documentKind = null) {
  try {
    const params = new URLSearchParams();
    params.append('searchTerm', searchTerm);
    if (documentKind) params.append('documentKind', documentKind);
    params.append('limit', '20');

    const response = await axios.get(`${BASE_URL}/document`, { params });
    return response.data;
  } catch (error) {
    console.error(`Error searching for "${searchTerm}":`, error.message);
    return null;
  }
}

async function searchLegislation(searchTerm) {
  try {
    const params = new URLSearchParams();
    params.append('searchTerm', searchTerm);
    params.append('limit', '20');

    const response = await axios.get(`${BASE_URL}/legislation`, { params });
    return response.data;
  } catch (error) {
    console.error(`Error searching legislation for "${searchTerm}":`, error.message);
    return null;
  }
}

function analyzeResults(results, test) {
  if (!results || !results.member || results.member.length === 0) {
    return {
      found: false,
      score: 0,
      details: "No results found",
      urls: [],
      references: []
    };
  }

  const items = results.member;
  let bestMatch = null;
  let score = 0;
  let foundUrls = [];
  let foundReferences = [];

  // Check for exact matches in titles, summaries, or content
  for (const searchResult of items) {
    const item = searchResult.item || searchResult;
    const textMatches = searchResult.textMatches || [];
    
    const headline = (item.headline || '').toLowerCase();
    const content = textMatches.map(m => m.text || '').join(' ').toLowerCase();
    const documentNumber = (item.documentNumber || '').toLowerCase();
    const ecli = (item.ecli || '').toLowerCase();
    
    let itemScore = 0;
    
    // Check for expected ECLI match (highest priority)
    if (test.expectedCase?.ecli && ecli.includes(test.expectedCase.ecli.toLowerCase())) {
      itemScore += 100;
      foundReferences.push(`ECLI: ${item.ecli}`);
    }
    
    // Check for expected case number match
    if (test.expectedCase?.case_number) {
      const caseNumber = test.expectedCase.case_number.toLowerCase().replace(/\s/g, '');
      const itemCaseNumbers = (item.fileNumbers || []).join(' ').toLowerCase().replace(/\s/g, '');
      if (itemCaseNumbers.includes(caseNumber) || documentNumber.includes(caseNumber)) {
        itemScore += 80;
        foundReferences.push(`Case: ${test.expectedCase.case_number}`);
      }
    }
    
    // Check for expected court match
    if (test.expectedCase?.court && item.courtName) {
      const expectedCourt = test.expectedCase.court.toLowerCase();
      const itemCourt = item.courtName.toLowerCase();
      if (itemCourt.includes(expectedCourt) || expectedCourt.includes(itemCourt)) {
        itemScore += 60;
        foundReferences.push(`Court: ${item.courtName}`);
      }
    }
    
    // Check if expected law is mentioned
    if (test.expectedLaw) {
      const lawPattern = test.expectedLaw.toLowerCase();
      if (headline.includes(lawPattern) || 
          content.includes(lawPattern) ||
          documentNumber.includes(lawPattern) ||
          ecli.includes(lawPattern)) {
        itemScore += 40;
        foundReferences.push(`Law: ${test.expectedLaw}`);
      }
    }
    
    // Check for specific paragraph references from relevant_norms
    if (test.expectedCase && Array.isArray(test.expectedCase.relevant_norms)) {
      for (const norm of test.expectedCase.relevant_norms) {
        const normLower = norm.toLowerCase();
        if (headline.includes(normLower) || content.includes(normLower)) {
          itemScore += 30;
          foundReferences.push(`Norm: ${norm}`);
        }
      }
    }
    
    // Generate and validate URLs
    let documentUrl = '';
    if (item['@type'] === 'Legislation') {
      // For legislation: Use workExample for expression-level access
      let apiPath = item['@id'];
      if (item.workExample && item.workExample['@id']) {
        apiPath = item.workExample['@id'];
      }
      documentUrl = `https://testphase.rechtsinformationen.bund.de${apiPath.replace('/v1/legislation/', '/norms/')}`;
    } else {
      // For court decisions: Use ECLI URL if available, otherwise fallback
      if (item.ecli) {
        documentUrl = `https://testphase.rechtsinformationen.bund.de/ecli/${item.ecli}`;
      } else {
        documentUrl = `https://testphase.rechtsinformationen.bund.de${item['@id'].replace('/v1', '')}`;
      }
    }
    
    if (documentUrl) {
      foundUrls.push({
        title: item.headline || item.name || 'Unknown Document',
        url: documentUrl,
        type: item['@type'],
        ecli: item.ecli,
        score: itemScore
      });
    }
    
    // Evaluation criteria scoring
    if (test.evaluationCriteria) {
      for (const criterion of test.evaluationCriteria) {
        const criterionLower = criterion.toLowerCase();
        if (headline.includes(criterionLower) || content.includes(criterionLower)) {
          itemScore += 25;
        }
      }
    }
    
    if (itemScore > score) {
      score = itemScore;
      bestMatch = { item, textMatches, score: itemScore };
    }
  }

  // Enhanced validation logic for more precise matching
  let passed = false;
  
  if (test.expectedCase?.ecli) {
    // For tests with specific ECLI expectations, require high accuracy
    const hasEcliMatch = foundReferences.some(ref => ref.includes('ECLI:') && ref.toLowerCase().includes(test.expectedCase.ecli.toLowerCase()));
    const hasCaseMatch = foundReferences.some(ref => ref.includes('Case:') && test.expectedCase.case_number && 
      ref.toLowerCase().includes(test.expectedCase.case_number.toLowerCase()));
    
    // Require either ECLI match OR (case number match AND high score)
    passed = hasEcliMatch || (hasCaseMatch && score >= 80);
  } else {
    // For general tests without specific ECLI, use score threshold
    passed = score > 60; // Increased threshold for better precision
  }

  return {
    found: passed,
    score,
    bestMatch,
    urls: foundUrls.sort((a, b) => b.score - a.score).slice(0, 3), // Top 3 URLs
    references: [...new Set(foundReferences)], // Remove duplicates
    details: bestMatch ? 
      `Found: ${bestMatch.item.headline || bestMatch.item.title || 'Untitled'} (Score: ${score})` : 
      "No relevant match found",
    validation: {
      expectedEcli: test.expectedCase?.ecli,
      foundEcli: foundReferences.find(ref => ref.includes('ECLI:')),
      strictMatch: test.expectedCase?.ecli ? (foundReferences.some(ref => ref.includes('ECLI:') && ref.toLowerCase().includes(test.expectedCase.ecli.toLowerCase()))) : null
    }
  };
}

async function runGoldenTests() {
  console.log('🧪 Running Golden Test Cases for German Legal MCP Server');
  console.log('=' .repeat(80));
  
  let totalTests = 0;
  let passedTests = 0;
  const results = [];

  for (const test of goldenTests) {
    totalTests++;
    console.log(`\n📋 Test ${totalTests}: ${test.question}`);
    console.log(`Expected: ${test.expectedHit}`);
    console.log('-'.repeat(50));

    let bestResult = null;
    let bestScore = 0;

    // Try different search approaches
    for (const searchTerm of test.searchTerms) {
      console.log(`🔍 Searching: "${searchTerm}"`);
      
      // Search all documents
      const allDocsResult = await searchAPI(searchTerm);
      if (allDocsResult) {
        const analysis = analyzeResults(allDocsResult, test);
        console.log(`   All docs: ${analysis.score} points, ${allDocsResult.member?.length || 0} results`);
        if (analysis.score > bestScore) {
          bestScore = analysis.score;
          bestResult = { ...analysis, searchTerm, method: 'all-documents' };
        }
      }

      // Search case law specifically if we expect a court decision
      if (test.expectedCase?.court) {
        const caseLawResult = await searchAPI(searchTerm, 'case-law');
        if (caseLawResult) {
          const analysis = analyzeResults(caseLawResult, test);
          console.log(`   Case law: ${analysis.score} points, ${caseLawResult.member?.length || 0} results`);
          if (analysis.score > bestScore) {
            bestScore = analysis.score;
            bestResult = { ...analysis, searchTerm, method: 'case-law' };
          }
        }
      }

      // Search legislation specifically if we expect legislation
      if (test.expectedLaw) {
        const legislationResult = await searchAPI(searchTerm, 'legislation');
        if (legislationResult) {
          const analysis = analyzeResults(legislationResult, test);
          console.log(`   Legislation: ${analysis.score} points, ${legislationResult.member?.length || 0} results`);
          if (analysis.score > bestScore) {
            bestScore = analysis.score;
            bestResult = { ...analysis, searchTerm, method: 'legislation' };
          }
        }
      }

      // Try legislation endpoint directly for law references
      if (test.expectedLaw) {
        const directLegislation = await searchLegislation(searchTerm);
        if (directLegislation) {
          const analysis = analyzeResults(directLegislation, test);
          console.log(`   Direct legislation: ${analysis.score} points, ${directLegislation.member?.length || 0} results`);
          if (analysis.score > bestScore) {
            bestScore = analysis.score;
            bestResult = { ...analysis, searchTerm, method: 'legislation-direct' };
          }
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Evaluate result
    const passed = bestResult && bestResult.found;
    if (passed) {
      passedTests++;
      console.log(`✅ PASSED: ${bestResult.details}`);
      console.log(`   Method: ${bestResult.method}, Search: "${bestResult.searchTerm}"`);
      
      // Show found references
      if (bestResult.references && bestResult.references.length > 0) {
        console.log(`   📋 Found References: ${bestResult.references.join(', ')}`);
      }
      
      // Show found URLs
      if (bestResult.urls && bestResult.urls.length > 0) {
        console.log(`   🔗 Found URLs:`);
        bestResult.urls.slice(0, 2).forEach((urlInfo, i) => {
          console.log(`      ${i + 1}. ${urlInfo.title.substring(0, 50)}...`);
          console.log(`         ${urlInfo.url}`);
        });
      }
    } else {
      console.log(`❌ FAILED: ${bestResult ? bestResult.details : 'No results found'}`);
      if (bestResult && bestResult.bestMatch) {
        console.log(`   Best match: ${bestResult.bestMatch.item.headline || 'No headline'}`);
      }
      
      // Show what we were looking for
      if (test.expectedCase) {
        console.log(`   Expected: ${test.expectedCase.ecli || test.expectedCase.case_number || 'Unknown reference'}`);
      }
    }

    results.push({
      id: test.id,
      title: test.title,
      question: test.question,
      expected: test.expectedHit,
      expectedCase: test.expectedCase,
      passed,
      score: bestScore,
      details: bestResult ? bestResult.details : 'No results',
      references: bestResult ? bestResult.references : [],
      urls: bestResult ? bestResult.urls : [],
      bestSearch: bestResult ? bestResult.searchTerm : null,
      method: bestResult ? bestResult.method : null,
      difficulty: test.difficulty,
      tags: test.tags
    });
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  // Detailed results by difficulty
  console.log('\n📋 DETAILED RESULTS BY DIFFICULTY:');
  
  const byDifficulty = results.reduce((acc, result) => {
    const diff = result.difficulty || 'unknown';
    if (!acc[diff]) acc[diff] = [];
    acc[diff].push(result);
    return acc;
  }, {});
  
  Object.entries(byDifficulty).forEach(([difficulty, diffResults]) => {
    console.log(`\n🎯 ${difficulty.toUpperCase()} (${diffResults.filter(r => r.passed).length}/${diffResults.length} passed):`);
    
    diffResults.forEach((result, i) => {
      console.log(`\n${i + 1}. ${result.passed ? '✅' : '❌'} ${result.title || result.question}`);
      if (result.expectedCase) {
        console.log(`   📋 Expected: ${result.expectedCase.ecli || result.expectedCase.case_number}`);
        console.log(`   🏛️ Court: ${result.expectedCase.court} (${result.expectedCase.decision_date})`);
      }
      console.log(`   🔍 Result: ${result.details}`);
      
      if (result.references && result.references.length > 0) {
        console.log(`   📚 References Found: ${result.references.join(', ')}`);
      }
      
      if (result.urls && result.urls.length > 0) {
        console.log(`   🔗 URLs Generated: ${result.urls.length} links`);
        result.urls.slice(0, 1).forEach(url => {
          console.log(`      ${url.url}`);
        });
      }
      
      if (result.bestSearch) {
        console.log(`   🔍 Best Search: "${result.bestSearch}" (${result.method}) - Score: ${result.score}`);
      }
      
      if (result.tags) {
        console.log(`   🏷️ Tags: ${result.tags.join(', ')}`);
      }
    });
  });
  
  // URL validation summary
  console.log('\n🔗 URL VALIDATION SUMMARY:');
  const totalUrls = results.reduce((sum, r) => sum + (r.urls?.length || 0), 0);
  const resultsWithUrls = results.filter(r => r.urls && r.urls.length > 0).length;
  console.log(`📊 Total URLs generated: ${totalUrls}`);
  console.log(`📊 Tests with URLs: ${resultsWithUrls}/${results.length}`);
  
  // Reference validation summary
  console.log('\n📚 REFERENCE VALIDATION SUMMARY:');
  const totalRefs = results.reduce((sum, r) => sum + (r.references?.length || 0), 0);
  const resultsWithRefs = results.filter(r => r.references && r.references.length > 0).length;
  console.log(`📊 Total references found: ${totalRefs}`);
  console.log(`📊 Tests with references: ${resultsWithRefs}/${results.length}`);

  return {
    totalTests,
    passedTests,
    successRate: (passedTests / totalTests) * 100,
    results
  };
}

// Run the tests
runGoldenTests().catch(console.error);