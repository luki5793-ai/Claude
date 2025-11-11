# Project Structure

This document provides an overview of the Google Jobs IT Scraper project structure.

```
google-jobs-it-scraper/
│
├── .actor/                          # Apify Actor configuration
│   ├── actor.json                   # Actor metadata and settings
│   ├── input_schema.json            # Input parameter schema with validation
│   └── INPUT.json                   # Example input for local testing
│
├── src/                             # Source code (TypeScript)
│   ├── main.ts                      # Main entry point and Apify SDK integration
│   ├── types.ts                     # TypeScript type definitions and Zod schemas
│   ├── utils.ts                     # Utility functions (retry, validation, etc.)
│   └── scraper.ts                   # Core scraping logic with cheerio
│
├── dist/                            # Compiled JavaScript output (generated)
│   └── ...                          # (created after npm run build)
│
├── node_modules/                    # NPM dependencies (generated)
│   └── ...                          # (created after npm install)
│
├── package.json                     # NPM package configuration
├── tsconfig.json                    # TypeScript compiler configuration
├── Dockerfile                       # Docker container configuration
├── .eslintrc.json                   # ESLint configuration
├── .actorignore                     # Files to exclude from Actor build
├── .gitignore                       # Files to exclude from Git
│
├── README.md                        # Main documentation
├── DEPLOYMENT.md                    # Deployment guide
├── PROJECT_STRUCTURE.md             # This file
└── LICENSE                          # Apache 2.0 license
```

## File Descriptions

### Configuration Files

#### `.actor/actor.json`
- Defines actor metadata (name, version, description)
- Configures dataset views for result display
- Links to input schema and Dockerfile
- Specifies actor template type

#### `.actor/input_schema.json`
- JSON Schema for input validation
- Defines all input parameters with types, defaults, and constraints
- Used by Apify Console to generate input UI
- Includes descriptions and examples for each parameter

#### `.actor/INPUT.json`
- Example input configuration for local testing
- Pre-configured with sensible defaults
- Modify this file when testing locally

#### `package.json`
- NPM package configuration
- Lists all dependencies (@apify/sdk, got-scraping, cheerio, zod)
- Defines build and run scripts
- Specifies ES modules configuration

#### `tsconfig.json`
- TypeScript compiler options
- Configured for ES2022 with strict mode
- Outputs to `dist/` directory
- Enables source maps for debugging

#### `Dockerfile`
- Uses official Apify Node.js base image
- Installs dependencies and builds TypeScript
- Optimized for production deployment

#### `.eslintrc.json`
- ESLint configuration for code quality
- TypeScript-specific rules
- Enforces consistent code style

#### `.actorignore`
- Specifies files to exclude from Actor build
- Reduces build size and deployment time
- Excludes development files and source TypeScript

#### `.gitignore`
- Standard Git ignore patterns
- Excludes node_modules, build artifacts, environment files

### Source Code Files

#### `src/main.ts` (Main Entry Point)
**Purpose**: Orchestrates the entire scraping process using Apify SDK

**Key Responsibilities**:
- Initialize Apify Actor
- Validate and parse input using Zod schema
- Set up proxy configuration
- Generate search query combinations
- Initialize dataset and key-value store
- Manage checkpoint system for resuming
- Coordinate scraping across all queries
- Generate statistics and summary reports
- Handle errors and logging

**Key Functions**:
- `Actor.main()` - Main actor handler
- `getTopCompanies()` - Analyze company distribution
- `getTopLocations()` - Analyze location distribution
- `calculateAverageSalary()` - Calculate salary statistics

**Integrations**:
- Apify Dataset API
- Apify Key-Value Store
- Apify Proxy Configuration
- Structured logging with `@apify/log`

---

#### `src/types.ts` (Type Definitions)
**Purpose**: Define TypeScript types and validation schemas

**Key Types**:
- `Input` - Input parameters (validated with Zod)
- `ScrapedJob` - Job data structure (main output)
- `Salary` - Salary information structure
- `ScraperStats` - Statistics tracking
- `RetryConfig` - Retry mechanism configuration
- `SearchQuery` - Query/location combination
- `ScraperError` - Error tracking structure
- `CheckpointData` - Checkpoint persistence

**Validation**:
- Uses Zod for runtime type validation
- Ensures type safety throughout the application
- Provides clear error messages for invalid inputs

---

#### `src/utils.ts` (Utility Functions)
**Purpose**: Provide reusable helper functions

**Key Functions**:

**Delay & Timing**:
- `randomDelay()` - Generate random delay between min/max
- `sleep()` - Promise-based sleep function
- `formatDuration()` - Human-readable duration formatting

**Validation**:
- `validateInput()` - Additional input validation beyond Zod
- `shouldExcludeJob()` - Check if job should be filtered

**Data Processing**:
- `generateSearchQueries()` - Create query combinations
- `generateJobId()` - Generate unique job identifiers (MD5 hash)
- `parseSalary()` - Parse German salary formats
- `parsePublishedDate()` - Parse relative dates ("vor 2 Tagen")
- `cleanText()` - Normalize whitespace and newlines

**Retry Logic**:
- `retryWithBackoff()` - Exponential backoff retry mechanism

**URL Handling**:
- `buildGoogleJobsUrl()` - Construct Google Jobs search URLs
- `normalizeUrl()` - Ensure URLs are absolute
- `getUserAgent()` - Random user agent selection

**Error Handling**:
- `logError()` - Structured error logging

---

#### `src/scraper.ts` (Scraping Logic)
**Purpose**: Core web scraping implementation

**GoogleJobsScraper Class**:

**Constructor**:
- Initializes statistics tracking
- Sets up deduplication (Set of seen URLs)
- Configures retry mechanism
- Prepares error collection

**Private Methods**:
- `fetchPage()` - HTTP request with got-scraping and retry logic
- `parseJobListings()` - Parse HTML with cheerio, extract job data
- `extractExperienceLevel()` - Determine seniority from text
- `extractIndustry()` - Identify industry from keywords

**Public Methods**:
- `scrapeQuery()` - Main scraping method for a single query
- `getStats()` - Return current statistics
- `getErrors()` - Return encountered errors
- `setTotalQueries()` - Set total query count for progress tracking
- `finalizeStats()` - Calculate final statistics
- `loadCheckpoint()` - Restore state from checkpoint
- `getSeenUrls()` - Get seen URLs for checkpoint

**Data Extraction**:
- Job title, company, location
- Work type (Vollzeit, Teilzeit, etc.)
- Experience level (Junior, Mid, Senior)
- Salary (with intelligent parsing)
- Description and publish date
- Company size and industry (when available)

**Features**:
- Deduplication based on job URL
- Configurable result limits
- Rate limiting with random delays
- Proxy support
- Comprehensive error handling

---

### Documentation Files

#### `README.md`
- Main documentation
- Features overview
- Input/output specifications
- Usage examples
- Deployment instructions
- Troubleshooting guide

#### `DEPLOYMENT.md`
- Detailed deployment guide
- Three deployment methods (Console, CLI, GitHub)
- Configuration recommendations
- Monitoring and maintenance
- Cost estimation
- Production best practices

#### `PROJECT_STRUCTURE.md` (This File)
- Project organization overview
- Detailed file descriptions
- Code architecture explanation
- Developer reference

#### `LICENSE`
- Apache 2.0 license text
- Copyright information
- Terms and conditions

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        User Input                            │
│  (searchQueries, locations, maxResults, filters, etc.)      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    src/main.ts                               │
│  - Validate input with Zod                                   │
│  - Initialize Apify SDK (Dataset, KV Store, Proxy)          │
│  - Generate search query combinations                        │
│  - Load checkpoint (if resuming)                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  For Each Query                              │
│  ┌────────────────────────────────────────────────┐         │
│  │          src/scraper.ts                        │         │
│  │  - Build Google Jobs URL                       │         │
│  │  - Fetch HTML with got-scraping + proxy        │         │
│  │  - Parse with cheerio                          │         │
│  │  - Extract job data                            │         │
│  │  - Deduplicate                                 │         │
│  │  - Apply filters                               │         │
│  └────────────────────┬───────────────────────────┘         │
│                       │                                      │
│                       ▼                                      │
│  ┌────────────────────────────────────────────────┐         │
│  │          src/utils.ts                          │         │
│  │  - Retry with backoff (if needed)              │         │
│  │  - Parse salary, dates                         │         │
│  │  - Generate job IDs                            │         │
│  │  - Clean/normalize data                        │         │
│  └────────────────────┬───────────────────────────┘         │
└────────────────────────┼────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Apify Dataset                              │
│  - Store all scraped jobs                                    │
│  - Export as JSON/CSV                                        │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               Apify Key-Value Store                          │
│  - FINAL_STATS: Statistics summary                          │
│  - RUN_SUMMARY: Detailed report                             │
│  - SCRAPING_ERRORS: Error log                               │
│  - SCRAPER_CHECKPOINT: Resume data                          │
└─────────────────────────────────────────────────────────────┘
```

## Build Process

```
1. npm install          → Install dependencies
2. npm run build        → TypeScript compilation (src/ → dist/)
3. npm start            → Run compiled code (node dist/main.js)
```

## Development Workflow

```
1. Edit TypeScript files in src/
2. npm run dev          → Run with tsx (no build needed)
3. npm run lint         → Check code quality
4. Test locally with .actor/INPUT.json
5. npm run build        → Build for production
6. Deploy to Apify
```

## Key Dependencies

### Production Dependencies
- `@apify/sdk` - Apify platform SDK
- `got-scraping` - HTTP client with anti-bot evasion
- `cheerio` - Fast HTML parser
- `zod` - Runtime type validation

### Development Dependencies
- `typescript` - TypeScript compiler
- `tsx` - TypeScript execution for development
- `eslint` - Code quality tool
- `@typescript-eslint/*` - TypeScript ESLint plugins

## Architecture Highlights

### Modular Design
- **Separation of Concerns**: Each file has a single, clear responsibility
- **Type Safety**: Comprehensive TypeScript types throughout
- **Reusability**: Utility functions are independent and testable

### Error Resilience
- **Retry Logic**: Exponential backoff for failed requests
- **Checkpoints**: Resume from interruptions
- **Graceful Degradation**: Continue on partial failures
- **Structured Logging**: All errors logged with context

### Performance
- **Deduplication**: Prevents re-scraping same jobs
- **Rate Limiting**: Configurable delays prevent blocking
- **Proxy Rotation**: Supports Apify Proxy for better success rate
- **Efficient Parsing**: Cheerio is fast and memory-efficient

### Maintainability
- **Well Commented**: Inline comments explain complex logic
- **Consistent Naming**: Clear, descriptive variable names
- **Linting**: ESLint ensures code quality
- **Documentation**: Comprehensive README and guides

---

**For questions or contributions, please refer to the main README.md**
