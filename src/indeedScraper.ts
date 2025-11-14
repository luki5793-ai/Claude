/**
 * Indeed Job Scraper
 * Scrapes IT jobs from Indeed.de
 */

import { log } from 'apify';
import { gotScraping } from 'got-scraping';
import * as cheerio from 'cheerio';
import type { ScrapedJob, SearchQuery } from './types.js';
import {
    retryWithBackoff,
    getUserAgent,
    sleep,
    randomDelay,
    cleanText,
    parsePublishedDate,
    parseSalary,
    generateJobId,
} from './utils.js';
import { detectRecruitmentAgency, extractPostalCode } from './recruitmentDetector.js';

/**
 * Build Indeed search URL
 */
export function buildIndeedUrl(query: string, location: string, start: number = 0): string {
    const encodedQuery = encodeURIComponent(query);
    const encodedLocation = encodeURIComponent(location);

    // Indeed URL pattern (de.indeed.com for Germany)
    return `https://de.indeed.com/jobs?q=${encodedQuery}&l=${encodedLocation}&start=${start}`;
}

/**
 * Scrape jobs from Indeed
 */
export async function scrapeIndeed(
    query: SearchQuery,
    maxResults: number,
    timeout: number,
    proxyUrl?: string,
): Promise<ScrapedJob[]> {
    log.info(`Scraping Indeed for: ${query.query} in ${query.location}`);

    const jobs: ScrapedJob[] = [];
    const seenUrls = new Set<string>();
    let start = 0;
    const resultsPerPage = 15; // Indeed shows ~15 jobs per page
    const maxPages = Math.ceil(maxResults / resultsPerPage);
    let currentPage = 0;

    try {
        while (jobs.length < maxResults && currentPage < maxPages) {
            const url = buildIndeedUrl(query.query, query.location, start);
            log.debug(`Fetching Indeed page ${currentPage + 1}: ${url}`);

            // Add delay between requests
            if (currentPage > 0) {
                await sleep(randomDelay(2000, 4000));
            }

            const html = await retryWithBackoff(
                async () => {
                    const response = await gotScraping({
                        url,
                        headers: {
                            'User-Agent': getUserAgent(),
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Referer': 'https://de.indeed.com/',
                        },
                        timeout: { request: timeout },
                        ...(proxyUrl && { proxyUrl }),
                        http2: true,
                        throwHttpErrors: false,
                    });

                    if (response.statusCode !== 200) {
                        throw new Error(`HTTP ${response.statusCode}`);
                    }

                    return response.body;
                },
                {
                    maxRetries: 3,
                    initialDelayMs: 2000,
                    maxDelayMs: 10000,
                    backoffMultiplier: 2,
                },
                url,
            );

            const $ = cheerio.load(html);

            // Parse job listings
            const pageJobs = parseIndeedJobListings($, query, seenUrls);

            if (pageJobs.length === 0) {
                log.info(`No more jobs found on Indeed page ${currentPage + 1}, stopping`);
                break;
            }

            jobs.push(...pageJobs);
            start += resultsPerPage;
            currentPage++;

            log.info(`Indeed: Found ${pageJobs.length} jobs on page ${currentPage}, total: ${jobs.length}`);
        }
    } catch (error) {
        log.error('Error scraping Indeed', { error, query });
    }

    const limitedJobs = jobs.slice(0, maxResults);
    log.info(`Indeed scraping completed: ${limitedJobs.length} jobs found`);
    return limitedJobs;
}

/**
 * Parse Indeed job listings from HTML
 */
function parseIndeedJobListings(
    $: cheerio.CheerioAPI,
    query: SearchQuery,
    seenUrls: Set<string>,
): ScrapedJob[] {
    const jobs: ScrapedJob[] = [];

    try {
        // Indeed uses different selectors - try multiple approaches
        let jobCards = $('div.job_seen_beacon, div.jobsearch-SerpJobCard, div[data-jk]');

        if (jobCards.length === 0) {
            // Try alternative selectors for newer Indeed layout
            jobCards = $('div[class*="job"], article[data-jk]');
            log.debug(`Using alternative selector, found ${jobCards.length} cards`);
        }

        if (jobCards.length === 0) {
            log.warning('No job cards found on Indeed page');
            return jobs;
        }

        log.debug(`Found ${jobCards.length} job cards on Indeed`);

        jobCards.each((index, element) => {
            try {
                const $card = $(element);

                // Extract job ID (Indeed uses data-jk attribute)
                const jobKey = $card.attr('data-jk') || $card.find('[data-jk]').attr('data-jk');

                // Extract job title
                const titleElement = $card.find('h2.jobTitle, h2 a, .jobtitle, [class*="jobTitle"]');
                const title = cleanText(titleElement.text());

                if (!title) {
                    return;
                }

                // Extract company name
                const companyElement = $card.find('.companyName, [data-testid="company-name"], [class*="companyName"]');
                const company = cleanText(companyElement.text()) || 'Unknown Company';

                // Extract location
                const locationElement = $card.find('.companyLocation, [data-testid="text-location"], [class*="companyLocation"]');
                const location = cleanText(locationElement.text()) || query.location;

                // Extract postal code
                const postalCode = extractPostalCode(location);

                // Build job URL
                let jobUrl = '';
                if (jobKey) {
                    jobUrl = `https://de.indeed.com/viewjob?jk=${jobKey}`;
                } else {
                    const linkElement = titleElement.find('a').first();
                    const href = linkElement.attr('href') || '';
                    if (href) {
                        jobUrl = href.startsWith('http') ? href : `https://de.indeed.com${href}`;
                    }
                }

                if (!jobUrl) {
                    log.warning(`No URL found for job: ${title}`);
                    return;
                }

                // Check for duplicates
                if (seenUrls.has(jobUrl)) {
                    return;
                }
                seenUrls.add(jobUrl);

                // Extract description snippet
                const descriptionElement = $card.find('.job-snippet, [class*="snippet"], .summary');
                const description = cleanText(descriptionElement.text());

                // Detect recruitment agency
                const recruitmentDetection = detectRecruitmentAgency(company, description, jobUrl);

                // Extract salary if available
                const salaryElement = $card.find('.salary-snippet, [class*="salary"]');
                const salaryText = cleanText(salaryElement.text());
                const salary = parseSalary(salaryText);

                // Extract published date
                const dateElement = $card.find('.date, [class*="date"]');
                const dateText = cleanText(dateElement.text());
                const publishedDate = parsePublishedDate(dateText);

                // Extract work type (often in metadata)
                const metadataText = $card.find('.metadata, .jobMetadata').text().toLowerCase();
                let workType = 'Vollzeit';
                if (metadataText.includes('teilzeit')) {
                    workType = 'Teilzeit';
                } else if (metadataText.includes('praktikum')) {
                    workType = 'Praktikum';
                } else if (metadataText.includes('befristet')) {
                    workType = 'Befristet';
                }

                // Determine experience level
                const experienceLevel = extractExperienceLevel(title, description);

                const job: ScrapedJob = {
                    id: generateJobId(jobUrl),
                    title,
                    company,
                    location,
                    postalCode,
                    workType,
                    experienceLevel,
                    ...(salary && { salary }),
                    description,
                    jobUrl,
                    publishedDate,
                    isRecruitmentAgency: recruitmentDetection.isRecruitmentAgency,
                    recruitmentAgencyReason: recruitmentDetection.reason,
                    scrapedAt: new Date().toISOString(),
                    searchQuery: query.query,
                    searchLocation: query.location,
                    portal: 'Indeed',
                };

                jobs.push(job);
            } catch (error) {
                log.error(`Error parsing Indeed job card ${index}`, { error });
            }
        });
    } catch (error) {
        log.error('Error parsing Indeed job listings', { error });
    }

    return jobs;
}

/**
 * Extract experience level from title and description
 */
function extractExperienceLevel(title: string, description: string): string {
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
