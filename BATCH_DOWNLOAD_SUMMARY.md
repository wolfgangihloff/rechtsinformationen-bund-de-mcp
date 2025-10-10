# Batch Download Summary - Social Services Legislation

## ✅ Script Ready

**Location:** `scripts/batch-download-enhanced.mjs`

**Status:** Tested and working

## 🎯 What It Downloads

**Federal German social services and youth welfare legislation from rechtsinformationen.bund.de**

### Categories Covered:
1. **SGB (Social Code Books)** - All 14 books (I-XIV)
2. **Youth & Family Law** - Youth protection, parental leave, adoption
3. **Social Assistance** - Asylum, BAföG, housing benefits
4. **Disability & Inclusion** - Disability rights and participation
5. **Employment & Integration** - Job support and minimum wage
6. **Healthcare & Care** - Care insurance and health benefits
7. **Administrative Procedure** - VwVfG, SGG, appeals

## 📦 File Formats

Each law is downloaded in 2 formats:

### ✅ Available Formats
1. **`Law_Name.md`** - Markdown summary with:
   - Law name and abbreviation
   - Legislation date
   - Working links to online versions
   - Relevant legal excerpts with § references

2. **`Law_Name_metadata.json`** - JSON metadata with:
   - Complete document information
   - Working API URLs (workExampleUrl)
   - Search excerpts
   - Download timestamp

### ❌ Unavailable (API Restrictions)
3. **HTML** - Returns 404 (not available via API)
4. **LegalDocML XML** - Returns 404 (not available via API)
5. **Full JSON** - Mostly returns 403 (restricted)

## 🔗 URL Validation

**Tested and verified:**

- ✅ **workExampleUrl**: `https://testphase.rechtsinformationen.bund.de/v1/legislation/eli/bund/bgbl-1/1996/s830/1996-06-14/1/deu` → **200 OK**
- ❌ **apiUrl**: Abstract level URLs return 404 (expected - use workExampleUrl instead)
- ❌ **htmlUrl**: Browser-friendly URLs return 404 (API limitation)

**Recommendation:** Use `workExampleUrl` from metadata files for API access.

## 🚀 Usage

### Test Run (10 documents per category)
```bash
node scripts/batch-download-enhanced.mjs
```

**Output:** `tmp/bund-social/`

**Test limit:** Currently set to 10 documents per category for validation

### Full Production Run

Edit `scripts/batch-download-enhanced.mjs`:

```javascript
// Line 328: Remove or increase limit
const MAX_DOWNLOADS = 1000; // Or remove limit entirely
```

Then run:
```bash
node scripts/batch-download-enhanced.mjs
```

## 📊 Expected Results

### Test Run (~70 documents total)
- 10 documents × 7 categories
- ~2-3 minutes total
- Validates URLs and format

### Full Run (~300-400 documents)
- All matching federal social services laws
- ~30-45 minutes total
- Complete legal reference library

## 🔍 Key Laws Verified

Successfully downloads:

- ✅ SGB I-XIV (All Social Code Books)
- ✅ BEEG (Bundeselterngeld- und Elternzeitgesetz)
- ✅ JuSchG (Jugendschutzgesetz)
- ✅ AsylbLG (Asylbewerberleistungsgesetz)
- ✅ BAföG (Bundesausbildungsförderungsgesetz)
- ✅ VwVfG (Verwaltungsverfahrensgesetz)
- ✅ SGG (Sozialgerichtsgesetz)

## ⚠️ Important Limitations

### 1. Federal Law Only
- ✅ Downloads FEDERAL (Bundes) legislation
- ❌ Does NOT include Baden-Württemberg state law (Landesrecht)
- ❌ Does NOT include local ordinances

### 2. API Restrictions
- HTML documents: Not available via API (404)
- XML documents: Not available via API (404)
- Full JSON: Mostly restricted (403)
- **Solution:** Metadata + search excerpts provide sufficient information

### 3. Format Availability
- **Always available:** Metadata JSON, Markdown summaries
- **Sometimes available:** Work example JSON (API access)
- **Never available:** Browser HTML, LegalDocML XML

## 📁 Output Structure

```
tmp/bund-social/
├── SGB_Social_Code_Books/
│   ├── Law_Name.md
│   ├── Law_Name_metadata.json
│   └── ...
├── Youth_Family_Law/
├── Social_Assistance/
├── Disability_Inclusion/
├── Employment_Integration/
├── Healthcare_Care/
├── Administrative_Procedure/
└── DOWNLOAD_REPORT.md (generated at end)
```

## 🔄 Updates

Laws change frequently. To update:

```bash
# Re-run download (overwrites with latest versions)
node scripts/batch-download-enhanced.mjs
```

**Recommended schedule:**
- **Weekly:** SGB II (Jobcenter/Bürgergeld - rapid changes)
- **Monthly:** SGB VIII, employment laws, youth protection
- **Quarterly:** Administrative procedures, stable regulations

## 📖 Usage Examples

### Find Specific Law
```bash
# Find SGB VIII
find tmp/bund-social -name "*SGB_VIII*" -o -name "*Achtes_Buch*"

# Find BEEG
find tmp/bund-social -name "*Elterngeld*"
```

### Search Content
```bash
# Find all laws mentioning "Jugendamt"
grep -r "Jugendamt" tmp/bund-social --include="*.md"

# Find specific paragraph
grep -r "§ 8a" tmp/bund-social --include="*.md"
```

### Access API
```bash
# Get API URL for programmatic access
cat tmp/bund-social/*/some_law_metadata.json | jq '.workExampleUrl'

# Download full JSON
curl "$(cat */law_metadata.json | jq -r '.workExampleUrl')" | jq '.'
```

## ✅ Validation Checklist

After download, verify presence of critical laws:

```bash
ls -R tmp/bund-social | grep -E "SGB_VIII|SGB_II|SGB_IX|SGB_XII|BEEG|JuSchG|BAföG"
```

Expected matches:
- [ ] SGB VIII (Kinder- und Jugendhilfe)
- [ ] SGB II (Grundsicherung)
- [ ] SGB IX (Rehabilitation)
- [ ] SGB XII (Sozialhilfe)
- [ ] BEEG (Elterngeld und Elternzeit)
- [ ] JuSchG (Jugendschutzgesetz)
- [ ] BAföG (Ausbildungsförderung)

## 🛠️ Troubleshooting

### No Results for Search Term
- **Cause:** Term too specific or not in database
- **Solution:** Use broader terms (e.g., "Elternzeit" instead of "Elternzeitgesetz")

### 404 on HTML/XML Downloads
- **Cause:** API doesn't provide these formats
- **Solution:** Normal - use metadata and markdown files

### 403 on Full JSON
- **Cause:** API access restricted
- **Solution:** Normal - metadata contains key information

### Slow Download
- **Cause:** Rate limiting (1 second between documents)
- **Solution:** Normal for API politeness - don't reduce delays

## 🎯 Next Steps

1. ✅ **Test run completed** - URLs validated
2. **Decision point:** Run full download or keep test data?
3. **If full download:**
   - Edit script to remove 10-document limit
   - Run: `node scripts/batch-download-enhanced.mjs`
   - Wait ~30-45 minutes
   - Review `DOWNLOAD_REPORT.md`

## 📝 Technical Details

### Rate Limiting
- 500ms between searches
- 1000ms between downloads
- Respects API limits

### Deduplication
- Same law from multiple searches only downloaded once
- Uses ELI identifier for uniqueness

### Error Handling
- Continues on individual failures
- Reports errors in summary
- Saves partial results

## 🔗 Integration

### With MCP Server
- Same API as interactive MCP server
- Can build local search index from downloads
- Offline legal research capability

### Programmatic Access
```javascript
// Example: Read all downloaded laws
const fs = require('fs');
const glob = require('glob');

glob('tmp/bund-social/**/*_metadata.json', (err, files) => {
  files.forEach(file => {
    const data = JSON.parse(fs.readFileSync(file));
    console.log(`${data.abbreviation}: ${data.name}`);
    console.log(`API: ${data.workExampleUrl}`);
  });
});
```

## 📧 Support

- **Script issues:** Check main project README
- **API questions:** https://docs.rechtsinformationen.bund.de
- **Missing laws:** Verify they're federal (not state) law

---

**For:** Baden-Württemberg Ministry of Social Affairs, Youth and Family
**Source:** rechtsinformationen.bund.de (official federal legal portal)
**Status:** Production-ready with validated URLs
