# Google Jobs IT Scraper (Germany)

Production-ready Apify Actor for scraping IT jobs from Google Jobs in Germany. This actor supports multiple search queries, locations, proxy rotation, advanced filtering, and provides detailed statistics.

## 🚀 Features

- **Multi-Query Support**: Search for multiple job titles and locations simultaneously
- **Advanced Filtering**: Exclude jobs by keywords, filter by work type and experience level
- **Proxy Support**: Built-in support for Apify Proxy (residential and datacenter)
- **Resilience**: Automatic retry with exponential backoff, checkpoint system for resuming
- **Deduplication**: Automatic removal of duplicate job listings
- **Rich Data Extraction**: Extracts 12+ data points per job including salary, company, location, etc.
- **Statistics & Reporting**: Detailed statistics and summary reports
- **Rate Limiting**: Configurable delays between requests to avoid blocking
- **Production-Ready**: TypeScript, comprehensive error handling, structured logging

## 📋 Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `searchQueries` | Array<string> | ✅ Yes | - | IT job search terms (e.g., "Software Developer", "DevOps Engineer") |
| `locations` | Array<string> | ✅ Yes | - | German cities/regions (e.g., "Berlin", "München", "Remote") |
| `maxResults` | number | No | 50 | Maximum results per search query (10-500) |
| `includeRemote` | boolean | No | true | Include remote/home office positions |
| `excludeWords` | Array<string> | No | [] | Filter out jobs containing these words in title |
| `requestTimeout` | number | No | 30000 | HTTP request timeout in milliseconds |
| `maxRetries` | number | No | 3 | Maximum retry attempts for failed requests |
| `proxyConfiguration` | object | No | - | Apify Proxy configuration |
| `minDelayBetweenRequests` | number | No | 1000 | Minimum delay between requests (ms) |
| `maxDelayBetweenRequests` | number | No | 3000 | Maximum delay between requests (ms) |

## 📊 Output Data

Each job listing contains the following fields:

```typescript
{
  id: string;                    // Unique job identifier
  title: string;                 // Job title
  company: string;               // Company name
  location: string;              // Job location
  workType: string;              // Vollzeit, Teilzeit, Praktikum, etc.
  experienceLevel: string;       // Junior, Mid-Level, Senior, etc.
  salary?: {                     // Salary information (if available)
    min: number;
    max: number;
    currency: string;
    period: string;
  };
  description: string;           // Job description
  jobUrl: string;                // Direct link to job posting
  publishedDate: string;         // ISO 8601 date string
  companySize?: string;          // Company size (if available)
  industry?: string;             // Industry classification
  scrapedAt: string;             // Scrape timestamp (ISO 8601)
  searchQuery: string;           // Original search query used
  searchLocation: string;        // Original search location used
}
```

## 🔧 Usage Examples

### Example 1: Basic Usage

```json
{
  "searchQueries": ["Software Developer", "DevOps Engineer"],
  "locations": ["Berlin", "München"],
  "maxResults": 50
}
```

### Example 2: Advanced Filtering

```json
{
  "searchQueries": [
    "IT-Sicherheit",
    "Cybersecurity Engineer",
    "Penetration Tester"
  ],
  "locations": ["Berlin", "Hamburg", "Frankfurt", "Remote"],
  "maxResults": 100,
  "includeRemote": true,
  "excludeWords": ["Praktikum", "Werkstudent"],
  "minDelayBetweenRequests": 2000,
  "maxDelayBetweenRequests": 5000
}
```

### Example 3: With Proxy Configuration

```json
{
  "searchQueries": ["Full Stack Developer", "Backend Engineer"],
  "locations": ["München", "Stuttgart", "Nürnberg"],
  "maxResults": 75,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  },
  "requestTimeout": 60000,
  "maxRetries": 5
}
```

### Example 4: Salary-Focused Search

```json
{
  "searchQueries": [
    "Senior Software Engineer",
    "Lead Developer",
    "Principal Engineer"
  ],
  "locations": ["Berlin", "München"],
  "maxResults": 100,
  "excludeWords": ["junior", "praktikum", "student"]
}
```

## 🏃‍♂️ Running Locally

1. **Clone the repository**:
```bash
git clone <repository-url>
cd google-jobs-it-scraper
```

2. **Install dependencies**:
```bash
npm install
```

3. **Create input file** (`.actor/INPUT.json`):
```json
{
  "searchQueries": ["Software Developer"],
  "locations": ["Berlin"],
  "maxResults": 20
}
```

4. **Run the actor**:
```bash
npm start
```

5. **Development mode** (with auto-reload):
```bash
npm run dev
```

## 🐳 Docker Deployment

Build and run using Docker:

```bash
# Build the image
docker build -t google-jobs-scraper .

# Run the container
docker run -e APIFY_TOKEN=<your-token> google-jobs-scraper
```

## 📦 Deploying to Apify Platform

1. **Via Apify Console**:
   - Create a new Actor in Apify Console
   - Copy all files to the Actor's source code editor
   - Build and run the Actor

2. **Via Apify CLI**:
```bash
# Install Apify CLI
npm install -g apify-cli

# Login to Apify
apify login

# Push to Apify
apify push
```

## 📈 Output & Reports

The actor provides multiple output formats:

### 1. Dataset (Main Output)
All scraped jobs are saved to the default dataset in JSON/CSV format.

### 2. Statistics Report
Saved in Key-Value Store under `FINAL_STATS`:
- Total jobs found/scraped
- Duplicates skipped
- Errors encountered
- Processing duration
- Query statistics

### 3. Summary Report
Saved in Key-Value Store under `RUN_SUMMARY`:
- Top companies by job count
- Top locations
- Work type distribution
- Experience level distribution
- Salary statistics

### 4. Error Log
If errors occur, they are saved under `SCRAPING_ERRORS` in the Key-Value Store.

## 🔄 Checkpoint & Resume

The actor automatically saves checkpoints every 5 queries. If the actor is interrupted:
- Progress is saved automatically
- On restart, it resumes from the last checkpoint
- No duplicate scraping of already processed queries

## ⚙️ Configuration Files

### ESLint Configuration (`.eslintrc.json`)
```json
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "rules": {
    "semi": ["error", "always"],
    "quotes": ["error", "single"],
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

### TypeScript Configuration (`tsconfig.json`)
Production-ready TypeScript configuration with strict mode enabled.

## 🛡️ Error Handling

The actor implements multiple layers of error handling:

1. **Input Validation**: Zod schema validation for all inputs
2. **Request Retries**: Exponential backoff (2s, 4s, 8s, ...)
3. **Graceful Degradation**: Continues processing even if individual queries fail
4. **Structured Logging**: All errors logged with context
5. **Error Reports**: Comprehensive error reports in Key-Value Store

## 📊 Performance Tips

- **Proxy Usage**: Use Apify Residential Proxy for better success rate
- **Request Delays**: Increase delays (3-5s) for more stable scraping
- **Batch Size**: Process 50-100 jobs per query for optimal performance
- **Concurrent Runs**: Avoid running multiple instances simultaneously on same queries

## 🤝 Best Practices

1. **Start Small**: Test with 1-2 queries before scaling up
2. **Use Proxies**: Always use proxies for production runs
3. **Monitor Logs**: Check actor logs for warnings and errors
4. **Respect Rate Limits**: Use appropriate delays between requests
5. **Review Results**: Check dataset for quality before exporting

## 📝 Notes

- Google's HTML structure changes frequently; selectors may need updates
- Some job data (salary, company size) is not always available
- Remote positions are included by default (use `includeRemote: false` to exclude)
- Actor is optimized for German job market

## 🐛 Troubleshooting

**Problem**: No jobs found
- **Solution**: Check if search queries are valid, try broader terms

**Problem**: Many errors/timeouts
- **Solution**: Increase `requestTimeout` and use residential proxies

**Problem**: Duplicate jobs
- **Solution**: Built-in deduplication should handle this; check logs for issues

**Problem**: Actor runs too slowly
- **Solution**: Reduce delays or increase timeout values

## 📄 License

Apache-2.0

## 👥 Support

For issues and questions:
1. Check the actor logs for error messages
2. Review the error reports in Key-Value Store
3. Ensure input parameters are valid
4. Contact Apify support if issues persist

## 🔄 Version History

- **1.0.0** (2025-01-11): Initial release
  - Multi-query support
  - Advanced filtering
  - Checkpoint system
  - Comprehensive error handling
  - Rich statistics and reporting

---

**Happy Scraping! 🎉**
