# Batch Download Scripts

Scripts for bulk downloading legislation from rechtsinformationen.bund.de

## Social Services Batch Download

Download all relevant federal legislation for social services, youth welfare, and related areas.

### Usage

```bash
# Run the batch download
node scripts/batch-download-social-laws.js
```

### What it downloads

**Core Social Security Laws (SGB I-XIV):**
- SGB I: General Part
- SGB II: Basic Income Support (Bürgergeld, Jobcenter)
- SGB III: Employment Promotion
- SGB IV: Common Provisions for Social Insurance
- SGB V: Statutory Health Insurance
- SGB VI: Statutory Pension Insurance
- SGB VII: Statutory Accident Insurance
- **SGB VIII: Child and Youth Welfare** ⭐ KEY for Youth Ministry
- SGB IX: Rehabilitation and Participation of Disabled Persons
- SGB X: Social Administrative Procedure
- SGB XI: Long-term Care Insurance
- SGB XII: Social Assistance (Sozialhilfe)
- SGB XIV: Social Compensation Law

**Youth and Family Law:**
- Youth Protection Act (Jugendschutzgesetz)
- Federal Child Benefit Act
- Parental Leave and Benefits Act (BEEG)
- Maintenance Advance Act
- Family law provisions

**Social Assistance:**
- Asylum Seekers Benefits Act
- Federal Training Assistance Act (BAföG)
- Housing Benefit Act
- Education and Participation provisions

**Disability and Inclusion:**
- Disability Equality Act
- Federal Participation Act
- General Equal Treatment Act

**Employment Support:**
- Employment Promotion laws
- Participation Opportunities Act
- Minimum Wage Act

**Healthcare and Insurance:**
- Care Insurance
- Sickness Benefits
- Maternity Benefits

**Administrative Law:**
- Administrative Procedure Act
- Social Court Act
- Appeals Procedure

### Output Structure

```
downloads/social-services/
├── 01_Core_Social_Security_SGB/
│   ├── SGB_I_Allgemeiner_Teil_metadata.json
│   ├── SGB_I_Allgemeiner_Teil_full.json
│   ├── SGB_II_Bürgergeld_metadata.json
│   └── ...
├── 02_Youth_Family_Law/
│   ├── Jugendschutzgesetz_metadata.json
│   └── ...
├── 03_Social_Assistance/
├── 04_Disability_Inclusion/
├── 05_Employment_Support/
├── 06_Healthcare_Insurance/
├── 07_Administrative_Law/
└── download_report.md
```

### File Formats

**Metadata files (`*_metadata.json`):**
```json
{
  "name": "Sozialgesetzbuch (SGB) - Achtes Buch (VIII)",
  "headline": "Kinder- und Jugendhilfe",
  "eli": "eli/bund/bgbl-1/...",
  "abbreviation": "SGB VIII",
  "legislationDate": "1990-06-26",
  "apiUrl": "https://testphase.rechtsinformationen.bund.de/v1/legislation/...",
  "textMatches": [...],
  "downloadedAt": "2025-10-07T..."
}
```

**Full document files (`*_full.json`):**
- Complete law text
- All paragraphs and sections
- Amendment history
- Related documents

### Customization

Edit the search terms in the script:

```javascript
const SOCIAL_LAW_TERMS = [
  'SGB VIII',  // Add or modify terms
  'Jugendschutz',
  // ... your terms
];
```

### Rate Limiting

The script includes rate limiting to be respectful of the API:
- 500ms between searches
- 300ms between downloads

### Error Handling

- **403 errors**: Some documents have metadata but no full text (API restriction)
- **Network errors**: Script continues and reports errors in summary
- **Deduplication**: Same document from multiple searches only downloaded once

## Important Notes

### Federal vs State Law

⚠️ **This script downloads FEDERAL law only.**

For **Baden-Württemberg state law** (Landesrecht), you need separate access to:
- State legislation portals
- State-specific youth welfare regulations
- State social assistance implementations

Federal laws provide the framework, but states implement them with variations.

### Data Freshness

Laws change frequently. Recommended update schedule:
- **Monthly**: For active areas (SGB II, employment)
- **Quarterly**: For stable areas (SGB VIII structure)
- **When notified**: For specific amendments

### Legal Disclaimer

This data is from the official federal legal information portal but:
- ✅ Use for research and reference
- ✅ Build applications and tools
- ⚠️ Always cite official sources
- ⚠️ Verify critical information with current official sources
- ❌ Not a substitute for legal advice

## Advanced Usage

### Download Specific Categories Only

Modify the `categories` array in the script to select specific areas:

```javascript
const categories = [
  {
    name: '01_Core_Social_Security_SGB',
    terms: ['SGB VIII', 'SGB XII']  // Only these
  }
];
```

### Increase Download Limits

Adjust the `limit` parameter:

```javascript
const results = await this.searchLegislation(term, 200); // Increased from 100
```

### Export to Different Formats

Add conversion functions:

```javascript
// Convert JSON to Markdown
function jsonToMarkdown(data) {
  // Your conversion logic
}

// Convert JSON to PDF
function jsonToPdf(data) {
  // Your conversion logic
}
```

## Integration with MCP Server

The batch downloader uses the same API as the MCP server. You can:

1. **Build local search index** from downloaded data
2. **Offline legal research** when internet unavailable
3. **Custom analytics** on law structure and relationships
4. **Training data** for legal AI models (with appropriate licensing)

## Troubleshooting

### No Results Found

```bash
# Test API connectivity
curl https://testphase.rechtsinformationen.bund.de/v1/legislation?searchTerm=SGB+VIII
```

### Download Failures

- Check internet connection
- Verify API status
- Review error messages in console
- Check `download_report.md` for details

### Large Downloads

For complete downloads (1000+ documents):
- Increase timeout values
- Run in batches (one category at a time)
- Monitor disk space

## Future Enhancements

Potential improvements:
- [ ] Resume capability for interrupted downloads
- [ ] Incremental updates (only download changed docs)
- [ ] Parallel downloads (respect rate limits)
- [ ] HTML/PDF export formats
- [ ] Full-text search index builder
- [ ] Automated update notifications
- [ ] State law integration (when APIs available)

## Support

For issues or questions:
- GitHub Issues: [Your repo]
- API Documentation: https://docs.rechtsinformationen.bund.de
- MCP Server docs: See main README.md
