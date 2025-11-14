/**
 * StepStone Job Scraper
 * Scrapes IT jobs from StepStone.de
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
 * Build StepStone search URL
 */
export function buildStepStoneUrl(query: string, location: string, page: number = 1): string {
    const encodedQuery = encodeURIComponent(query);
    const encodedLocation = encodeURIComponent(location);

    // StepStone URL pattern
    return `https://www.stepstone.de/jobs/${encodedQuery}/in-${encodedLocation}?page=${page}`;
}

/**
 * Scrape jobs from StepStone
 */
export async function scrapeStepStone(
    query: SearchQuery,
    maxResults: number,
    timeout: number,
    proxyUrl?: string,
): Promise<ScrapedJob[]> {
    log.info(`Scraping StepStone for: ${query.query} in ${query.location}`);

    const jobs: ScrapedJob[] = [];
    const seenUrls = new Set<string>();
    let currentPage = 1;
    const maxPages = Math.ceil(maxResults / 25); // StepStone shows ~25 jobs per page

    try {
        while (jobs.length < maxResults && currentPage <= maxPages) {
            const url = buildStepStoneUrl(query.query, query.location, currentPage);
            log.debug(`Fetching StepStone page ${currentPage}: ${url}`);

            // Add delay between requests
            if (currentPage > 1) {
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
                            'Referer': 'https://www.stepstone.de/',
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
            const pageJobs = parseStepStoneJobListings($, query, seenUrls);

            if (pageJobs.length === 0) {
                log.info(`No more jobs found on page ${currentPage}, stopping`);
                break;
            }

            jobs.push(...pageJobs);
            currentPage++;

            log.info(`StepStone: Found ${pageJobs.length} jobs on page ${currentPage - 1}, total: ${jobs.length}`);
        }
    } catch (error) {
        log.error('Error scraping StepStone', { error, query });
    }

    const limitedJobs = jobs.slice(0, maxResults);
    log.info(`StepStone scraping completed: ${limitedJobs.length} jobs found`);
    return limitedJobs;
}

/**
 * Parse StepStone job listings from HTML
 */
function parseStepStoneJobListings(
    $: cheerio.CheerioAPI,
    query: SearchQuery,
    seenUrls: Set<string>,
): ScrapedJob[] {
    const jobs: ScrapedJob[] = [];

    try {
        // StepStone job cards (selectors may need updates as StepStone changes their HTML)
        const jobCards = $('article[data-at="job-item"]');

        if (jobCards.length === 0) {
            // Try alternative selectors
            const altCards = $('.res-1vq8gty, [data-testid="job-card"]');
            if (altCards.length > 0) {
                log.debug(`Using alternative selector, found ${altCards.length} cards`);
                return parseAlternativeStepStoneCards($, altCards, query, seenUrls);
            }
            log.warning('No job cards found on StepStone page');
            return jobs;
        }

        log.debug(`Found ${jobCards.length} job cards on StepStone`);

        jobCards.each((index, element) => {
            try {
                const $card = $(element);

                // Extract job title
                const titleElement = $card.find('h2, [data-at="job-item-title"]');
                const title = cleanText(titleElement.text());

                if (!title) {
                    return;
                }

                // Extract company name
                const companyElement = $card.find('[data-at="job-item-company-name"]');
                const company = cleanText(companyElement.text()) || 'Unknown Company';

                // Extract location
                const locationElement = $card.find('[data-at="job-item-location"]');
                const location = cleanText(locationElement.text()) || query.location;

                // Extract postal code
                const postalCode = extractPostalCode(location);

                // Extract job URL
                const linkElement = $card.find('a[data-at="job-item-title-link"]');
                let jobUrl = linkElement.attr('href') || '';

                if (!jobUrl) {
                    // Try alternative selector
                    jobUrl = $card.find('a').first().attr('href') || '';
                }

                if (!jobUrl) {
                    log.warning(`No URL found for job: ${title}`);
                    return;
                }

                // Make URL absolute
                if (!jobUrl.startsWith('http')) {
                    jobUrl = `https://www.stepstone.de${jobUrl}`;
                }

                // Check for duplicates
                if (seenUrls.has(jobUrl)) {
                    return;
                }
                seenUrls.add(jobUrl);

                // Extract description snippet
                const descriptionElement = $card.find('[data-at="job-item-teaser"]');
                const description = cleanText(descriptionElement.text());

                // Detect recruitment agency
                const recruitmentDetection = detectRecruitmentAgency(company, description, jobUrl);

                // Extract work type (Vollzeit, Teilzeit, etc.)
                const workTypeElement = $card.find('[data-at="job-item-employment-type"]');
                const workType = cleanText(workTypeElement.text()) || 'Vollzeit';

                // Extract salary if available
                const salaryElement = $card.find('[data-at="job-item-salary"]');
                const salaryText = cleanText(salaryElement.text());
                const salary = parseSalary(salaryText);

                // Extract published date
                const dateElement = $card.find('[data-at="job-item-publish-date"]');
                const dateText = cleanText(dateElement.text());
                const publishedDate = parsePublishedDate(dateText);

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
                    portal: 'StepStone',
                };

                jobs.push(job);
            } catch (error) {
                log.error(`Error parsing StepStone job card ${index}`, { error });
            }
        });
    } catch (error) {
        log.error('Error parsing StepStone job listings', { error });
    }

    return jobs;
}

/**
 * Parse alternative StepStone card structure
 */
function parseAlternativeStepStoneCards(
    $: cheerio.CheerioAPI,
    cards: cheerio.Cheerio<any>,
    query: SearchQuery,
    seenUrls: Set<string>,
): ScrapedJob[] {
    const jobs: ScrapedJob[] = [];

    cards.each((index, element) => {
        try {
            const $card = $(element);

            const title = cleanText($card.find('h2, h3').first().text());
            if (!title) return;

            const company = cleanText($card.find('[class*="company"], [class*="employer"]').first().text()) || 'Unknown Company';
            const location = cleanText($card.find('[class*="location"]').first().text()) || query.location;
            const postalCode = extractPostalCode(location);

            let jobUrl = $card.find('a').first().attr('href') || '';
            if (!jobUrl.startsWith('http')) {
                jobUrl = `https://www.stepstone.de${jobUrl}`;
            }

            if (seenUrls.has(jobUrl)) return;
            seenUrls.add(jobUrl);

            const description = cleanText($card.text());
            const recruitmentDetection = detectRecruitmentAgency(company, description, jobUrl);

            const job: ScrapedJob = {
                id: generateJobId(jobUrl),
                title,
                company,
                location,
                postalCode,
                workType: 'Vollzeit',
                experienceLevel: extractExperienceLevel(title, description),
                description,
                jobUrl,
                publishedDate: new Date().toISOString(),
                isRecruitmentAgency: recruitmentDetection.isRecruitmentAgency,
                recruitmentAgencyReason: recruitmentDetection.reason,
                scrapedAt: new Date().toISOString(),
                searchQuery: query.query,
                searchLocation: query.location,
                portal: 'StepStone',
            };

            jobs.push(job);
        } catch (error) {
            log.error(`Error parsing alternative StepStone card ${index}`, { error });
        }
    });

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
