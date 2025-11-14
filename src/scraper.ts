/**
 * Main scraping logic for Google Jobs IT Scraper
 */

import { log } from 'apify';
import { gotScraping } from 'got-scraping';
import * as cheerio from 'cheerio';
import type {
    Input,
    ScrapedJob,
    SearchQuery,
    RetryConfig,
    ScraperStats,
    ScraperError,
} from './types.js';
import {
    retryWithBackoff,
    buildGoogleJobsUrl,
    generateJobId,
    shouldExcludeJob,
    parseSalary,
    cleanText,
    parsePublishedDate,
    normalizeUrl,
    getUserAgent,
    sleep,
    randomDelay,
    logError,
} from './utils.js';
import { detectRecruitmentAgency, extractPostalCode, matchesPostalCodeFilter } from './recruitmentDetector.js';
import { scrapeStepStone } from './stepStoneScraper.js';
import { scrapeIndeed } from './indeedScraper.js';

/**
 * Google Jobs Scraper class
 */
export class GoogleJobsScraper {
    private input: Input;
    private stats: ScraperStats;
    private seenJobUrls: Set<string>;
    private errors: ScraperError[];
    private retryConfig: RetryConfig;

    constructor(input: Input) {
        this.input = input;
        this.seenJobUrls = new Set();
        this.errors = [];
        this.stats = {
            totalJobsFound: 0,
            totalJobsScraped: 0,
            duplicatesSkipped: 0,
            errorsEncountered: 0,
            queriesProcessed: 0,
            totalQueries: 0,
            startTime: new Date(),
        };

        this.retryConfig = {
            maxRetries: input.maxRetries,
            initialDelayMs: 2000,
            maxDelayMs: 30000,
            backoffMultiplier: 2,
        };
    }

    /**
     * Fetch HTML content from URL with retry logic
     */
    private async fetchPage(url: string, proxyUrl?: string): Promise<string> {
        const headers = {
            'User-Agent': getUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0',
        };

        return await retryWithBackoff(
            async () => {
                const response = await gotScraping({
                    url,
                    headers,
                    timeout: {
                        request: this.input.requestTimeout,
                    },
                    ...(proxyUrl && { proxyUrl }),
                    http2: true,
                    throwHttpErrors: false,
                });

                if (response.statusCode !== 200) {
                    throw new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`);
                }

                return response.body;
            },
            this.retryConfig,
            url,
        );
    }

    /**
     * Parse Google Jobs search results page
     */
    private parseJobListings($: cheerio.CheerioAPI, query: SearchQuery): ScrapedJob[] {
        const jobs: ScrapedJob[] = [];

        try {
            // Google Jobs results are typically in specific divs
            // NOTE: Google's HTML structure changes frequently, these selectors may need updates
            const jobCards = $('[data-ved]').filter((_, el) => {
                const $el = $(el);
                const text = $el.text().toLowerCase();
                // Filter for job-related containers
                return text.includes('vollzeit') || text.includes('teilzeit') ||
                       text.includes('bewerbung') || text.includes('stelle');
            });

            log.info(`Found ${jobCards.length} potential job cards for query: ${query.query} in ${query.location}`);

            jobCards.each((index, element) => {
                try {
                    const $card = $(element);

                    // Extract job title
                    const title = cleanText(
                        $card.find('h3').first().text() ||
                        $card.find('[role="heading"]').first().text() ||
                        ''
                    );

                    if (!title) return;

                    // Check if job should be excluded
                    if (shouldExcludeJob(title, this.input.excludeWords)) {
                        log.debug(`Excluding job: ${title}`);
                        return;
                    }

                    // Extract company name
                    const company = cleanText(
                        $card.find('.vNEEBe').first().text() ||
                        $card.find('[data-company]').text() ||
                        'Unknown Company'
                    );

                    // Extract location
                    const location = cleanText(
                        $card.find('.Qk80Jf').first().text() ||
                        query.location
                    );

                    // Extract postal code
                    const postalCode = extractPostalCode(location);

                    // Extract job URL
                    const linkElement = $card.find('a[href*="/search"]').first();
                    let jobUrl = linkElement.attr('href') || '';

                    if (!jobUrl) {
                        // Try alternative selectors
                        jobUrl = $card.find('a').first().attr('href') || '';
                    }

                    if (!jobUrl) {
                        log.warning(`No URL found for job: ${title}`);
                        return;
                    }

                    jobUrl = normalizeUrl(jobUrl);
                    const jobId = generateJobId(jobUrl);

                    // Check for duplicates
                    if (this.seenJobUrls.has(jobUrl)) {
                        this.stats.duplicatesSkipped++;
                        return;
                    }

                    this.seenJobUrls.add(jobUrl);

                    // Extract work type
                    const workType = cleanText(
                        $card.find('.LL4CDc').first().text() ||
                        'Vollzeit'
                    );

                    // Extract salary if available
                    const salaryText = $card.find('[data-salary]').text() ||
                                     $card.text().match(/\d+[.,]?\d*\s*€/)?.[0] || '';
                    const salary = parseSalary(salaryText);

                    // Extract description
                    const description = cleanText(
                        $card.find('.HBvzbc').first().text() ||
                        $card.text().substring(0, 300)
                    );

                    // Extract published date
                    const dateText = $card.find('.L6xAje').first().text() ||
                                   $card.text().match(/vor\s+\d+\s+(tag|stunde)/i)?.[0] || '';
                    const publishedDate = parsePublishedDate(dateText);

                    // Extract experience level
                    const experienceLevel = this.extractExperienceLevel(title, description);

                    // Extract company size and industry (often not available in Google Jobs)
                    const companySize = undefined;
                    const industry = this.extractIndustry(company, description);

                    // Detect recruitment agency
                    const recruitmentDetection = detectRecruitmentAgency(company, description, jobUrl);

                    const job: ScrapedJob = {
                        id: jobId,
                        title,
                        company,
                        location,
                        postalCode,
                        workType,
                        experienceLevel,
                        salary: salary,
                        description,
                        jobUrl,
                        publishedDate,
                        companySize: companySize,
                        industry: industry,
                        isRecruitmentAgency: recruitmentDetection.isRecruitmentAgency,
                        recruitmentAgencyReason: recruitmentDetection.reason,
                        scrapedAt: new Date().toISOString(),
                        searchQuery: query.query,
                        searchLocation: query.location,
                        portal: 'Google Jobs',
                    };

                    jobs.push(job);
                    this.stats.totalJobsFound++;

                    log.debug(`Parsed job: ${title} at ${company}`);
                } catch (error) {
                    const err = logError(error, `Parsing job card ${index}`);
                    this.errors.push(err);
                    this.stats.errorsEncountered++;
                }
            });
        } catch (error) {
            const err = logError(error, `Parsing job listings for ${query.query}`);
            this.errors.push(err);
            this.stats.errorsEncountered++;
        }

        return jobs;
    }

    /**
     * Extract experience level from title and description
     */
    private extractExperienceLevel(title: string, description: string): string {
        const combined = `${title} ${description}`.toLowerCase();

        if (combined.includes('senior') || combined.includes('lead') || combined.includes('principal')) {
            return 'Senior';
        } else if (combined.includes('junior') || combined.includes('einstieg') || combined.includes('berufseinsteiger')) {
            return 'Junior';
        } else if (combined.includes('mid-level') || combined.includes('erfahren')) {
            return 'Mid-Level';
        } else if (combined.includes('praktikum') || combined.includes('intern')) {
            return 'Internship';
        } else if (combined.includes('student') || combined.includes('werkstudent')) {
            return 'Student';
        }

        return 'Not Specified';
    }

    /**
     * Extract industry from company name and description
     */
    private extractIndustry(company: string, description: string): string | undefined {
        const combined = `${company} ${description}`.toLowerCase();

        const industries = {
            'E-Commerce': ['e-commerce', 'online shop', 'onlineshop', 'marketplace'],
            'FinTech': ['fintech', 'banking', 'payment', 'finance', 'versicherung'],
            'Healthcare': ['healthcare', 'health', 'medical', 'gesundheit', 'medizin'],
            'Automotive': ['automotive', 'automobil', 'fahrzeug'],
            'Gaming': ['gaming', 'game', 'spiel'],
            'SaaS': ['saas', 'software as a service', 'cloud platform'],
            'Consulting': ['consulting', 'beratung'],
            'Agency': ['agency', 'agentur'],
            'Startup': ['startup', 'start-up'],
        };

        for (const [industry, keywords] of Object.entries(industries)) {
            if (keywords.some((keyword) => combined.includes(keyword))) {
                return industry;
            }
        }

        return undefined;
    }

    /**
     * Scrape jobs for a single search query
     */
    public async scrapeQuery(
        query: SearchQuery,
        proxyUrl?: string,
    ): Promise<ScrapedJob[]> {
        log.info(`Scraping jobs for: ${query.query} in ${query.location}`);

        try {
            const url = buildGoogleJobsUrl(query.query, query.location);
            log.debug(`Fetching URL: ${url}`);

            // Add random delay between requests
            const delay = randomDelay(
                this.input.minDelayBetweenRequests,
                this.input.maxDelayBetweenRequests,
            );
            await sleep(delay);

            const html = await this.fetchPage(url, proxyUrl);
            const $ = cheerio.load(html);

            const jobs = this.parseJobListings($, query);

            // Limit results per query
            const limitedJobs = jobs.slice(0, this.input.maxResults);
            this.stats.totalJobsScraped += limitedJobs.length;
            this.stats.queriesProcessed++;

            log.info(`Scraped ${limitedJobs.length} jobs for: ${query.query} in ${query.location}`);

            return limitedJobs;
        } catch (error) {
            const err = logError(error, `${query.query} - ${query.location}`);
            this.errors.push({
                ...err,
                query: query.query,
                location: query.location,
            });
            this.stats.errorsEncountered++;
            return [];
        }
    }

    /**
     * Get current scraper statistics
     */
    public getStats(): ScraperStats {
        return { ...this.stats };
    }

    /**
     * Get encountered errors
     */
    public getErrors(): ScraperError[] {
        return [...this.errors];
    }

    /**
     * Update total queries count
     */
    public setTotalQueries(count: number): void {
        this.stats.totalQueries = count;
    }

    /**
     * Finalize statistics
     */
    public finalizeStats(): void {
        this.stats.endTime = new Date();
        this.stats.durationMs = this.stats.endTime.getTime() - this.stats.startTime.getTime();
    }

    /**
     * Load checkpoint data (for resuming)
     */
    public loadCheckpoint(seenUrls: string[], stats: Partial<ScraperStats>): void {
        this.seenJobUrls = new Set(seenUrls);
        this.stats = { ...this.stats, ...stats };
        log.info('Loaded checkpoint data', {
            seenUrls: this.seenJobUrls.size,
            queriesProcessed: this.stats.queriesProcessed,
        });
    }

    /**
     * Get seen job URLs for checkpoint
     */
    public getSeenUrls(): string[] {
        return Array.from(this.seenJobUrls);
    }

    /**
     * Scrape from multiple portals based on configuration
     */
    public async scrapeAllPortals(
        query: SearchQuery,
        proxyUrl?: string,
    ): Promise<ScrapedJob[]> {
        const allJobs: ScrapedJob[] = [];
        const portals = this.input.jobPortals || ['all'];

        // Determine which portals to scrape
        const shouldScrapeGoogle = portals.includes('all') || portals.includes('google');
        const shouldScrapeStepStone = portals.includes('all') || portals.includes('stepstone');
        const shouldScrapeIndeed = portals.includes('all') || portals.includes('indeed');

        try {
            // Scrape Google Jobs
            if (shouldScrapeGoogle) {
                log.info('Scraping Google Jobs...');
                const googleJobs = await this.scrapeQuery(query, proxyUrl);
                allJobs.push(...googleJobs);
            }

            // Scrape StepStone
            if (shouldScrapeStepStone) {
                log.info('Scraping StepStone...');
                try {
                    const stepStoneJobs = await scrapeStepStone(
                        query,
                        this.input.maxResults,
                        this.input.requestTimeout,
                        proxyUrl,
                    );
                    allJobs.push(...stepStoneJobs);
                    this.stats.totalJobsScraped += stepStoneJobs.length;
                } catch (error) {
                    log.error('Error scraping StepStone', { error });
                }
            }

            // Scrape Indeed
            if (shouldScrapeIndeed) {
                log.info('Scraping Indeed...');
                try {
                    const indeedJobs = await scrapeIndeed(
                        query,
                        this.input.maxResults,
                        this.input.requestTimeout,
                        proxyUrl,
                    );
                    allJobs.push(...indeedJobs);
                    this.stats.totalJobsScraped += indeedJobs.length;
                } catch (error) {
                    log.error('Error scraping Indeed', { error });
                }
            }

            // Filter jobs based on configuration
            const filteredJobs = this.filterJobs(allJobs);

            log.info(`Total jobs after filtering: ${filteredJobs.length} (from ${allJobs.length} raw jobs)`);
            return filteredJobs;

        } catch (error) {
            log.error('Error scraping portals', { error });
            return [];
        }
    }

    /**
     * Filter jobs based on configuration (PLZ, recruitment agencies, etc.)
     */
    private filterJobs(jobs: ScrapedJob[]): ScrapedJob[] {
        let filtered = jobs;

        // Filter by postal code if specified
        if (this.input.postalCodeFilter && this.input.postalCodeFilter.length > 0) {
            const beforeCount = filtered.length;
            filtered = filtered.filter(job =>
                matchesPostalCodeFilter(job.postalCode, this.input.postalCodeFilter)
            );
            log.info(`PLZ filter: ${beforeCount} -> ${filtered.length} jobs`);
        }

        // Filter out recruitment agencies if specified
        if (this.input.excludeRecruitmentAgencies) {
            const beforeCount = filtered.length;
            filtered = filtered.filter(job => !job.isRecruitmentAgency);
            log.info(`Recruitment agency filter: ${beforeCount} -> ${filtered.length} jobs`);
        }

        // Remove duplicates based on URL
        const seenUrls = new Set<string>();
        filtered = filtered.filter(job => {
            if (seenUrls.has(job.jobUrl)) {
                return false;
            }
            seenUrls.add(job.jobUrl);
            return true;
        });

        return filtered;
    }
}
