# Changelog

All notable changes to the Google Jobs IT Scraper will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-11

### Added

#### Core Features
- **Multi-query scraping**: Support for multiple search queries and locations simultaneously
- **Advanced filtering**: Exclude jobs by keywords in title
- **Proxy support**: Integration with Apify Proxy (residential and datacenter)
- **Checkpoint system**: Automatic resume from interruptions
- **Deduplication**: Automatic removal of duplicate job listings based on URL
- **Rate limiting**: Configurable delays between requests (1-3 seconds default)

#### Data Extraction
- Job title extraction
- Company name extraction
- Location/region extraction
- Work type extraction (Vollzeit, Teilzeit, Praktikum, etc.)
- Experience level detection (Junior, Mid-Level, Senior, etc.)
- Salary parsing (supports German formats)
- Job description extraction
- Job URL normalization
- Published date parsing (handles relative dates like "vor 2 Tagen")
- Company size detection (when available)
- Industry classification (10+ industries)
- Search query and location tracking

#### Error Handling & Resilience
- Exponential backoff retry mechanism (configurable, default 3 retries)
- Comprehensive error logging with context
- Graceful degradation on partial failures
- Input validation with Zod schemas
- Structured error reports in Key-Value Store
- HTTP timeout configuration

#### Statistics & Reporting
- Real-time progress tracking
- Total jobs found/scraped counters
- Duplicate detection and counting
- Error counting
- Processing duration calculation
- Top companies analysis (by job count)
- Top locations analysis (by job count)
- Work type distribution
- Experience level distribution
- Salary statistics (average, jobs with salary)
- Detailed summary reports

#### Data Storage
- Apify Dataset integration (JSON/CSV export)
- Key-Value Store for statistics and checkpoints
- Checkpoint persistence every 5 queries
- Final statistics export
- Error log export
- Summary report generation

#### Development Features
- Full TypeScript implementation with strict mode
- Zod runtime type validation
- ESLint configuration
- Comprehensive inline documentation
- Modular architecture
- Production-ready code structure

#### Documentation
- Comprehensive README with examples
- Detailed deployment guide (3 methods)
- Project structure documentation
- Usage examples for different scenarios
- Troubleshooting guide
- Cost estimation
- Best practices guide

#### Configuration
- Flexible input schema with 10+ parameters
- Default values for all optional parameters
- Min/max validation for numeric inputs
- Proxy configuration support
- Timeout configuration
- Retry configuration
- Delay configuration

### Technical Details

#### Dependencies
- @apify/sdk: ^3.8.0
- cheerio: ^1.0.0-rc.12
- got-scraping: ^4.1.3
- zod: ^3.22.4
- TypeScript: ^5.3.3

#### Performance
- Average: 50-100 jobs per minute
- Memory usage: ~512-1024 MB
- Proxy support for avoiding rate limits
- Efficient HTML parsing with cheerio

#### Compatibility
- Node.js 20+
- Apify Platform compatible
- Docker containerized
- Cross-platform (Linux, macOS, Windows)

### Known Limitations

- Google's HTML structure changes frequently; selectors may need updates
- Some job data (salary, company size) not always available
- Focused on German job market
- Maximum 500 results per query (by design)

### Future Enhancements (Planned)

- [ ] Email notifications on completion
- [ ] HTML report generation
- [ ] Advanced salary range filtering
- [ ] Regular expression support for search queries
- [ ] Company rating extraction
- [ ] Benefits/perks extraction
- [ ] Skills/requirements extraction
- [ ] Application deadline tracking
- [ ] Multi-language support
- [ ] Integration with job boards beyond Google Jobs
- [ ] Machine learning for job classification
- [ ] Duplicate detection across runs
- [ ] Historical data tracking
- [ ] Webhook support for real-time notifications

---

## Version Guidelines

**Major version (X.0.0)**: Breaking changes to input/output format or major architecture changes
**Minor version (0.X.0)**: New features, non-breaking changes
**Patch version (0.0.X)**: Bug fixes, documentation updates

---

[1.0.0]: https://github.com/your-repo/google-jobs-it-scraper/releases/tag/v1.0.0
