/**
 * Utility functions for the Google Jobs IT Scraper
 */

import { log } from 'apify';
import crypto from 'crypto';
import type { Input, RetryConfig, ScraperError, SearchQuery } from './types.js';

/**
 * Generate a random delay between min and max milliseconds
 */
export function randomDelay(minMs: number, maxMs: number): number {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Sleep for a specified number of milliseconds
 */
export async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate input parameters
 */
export function validateInput(input: Input): void {
    if (!input.searchQueries || input.searchQueries.length === 0) {
        throw new Error('At least one search query is required');
    }

    if (!input.locations || input.locations.length === 0) {
        throw new Error('At least one location is required');
    }

    if (input.maxResults < 10 || input.maxResults > 500) {
        throw new Error('maxResults must be between 10 and 500');
    }

    if (input.minDelayBetweenRequests >= input.maxDelayBetweenRequests) {
        throw new Error('minDelayBetweenRequests must be less than maxDelayBetweenRequests');
    }

    log.info('Input validation passed', {
        searchQueries: input.searchQueries.length,
        locations: input.locations.length,
        maxResults: input.maxResults,
    });
}

/**
 * Generate all search query combinations
 */
export function generateSearchQueries(searchQueries: string[], locations: string[]): SearchQuery[] {
    const queries: SearchQuery[] = [];

    for (const query of searchQueries) {
        for (const location of locations) {
            queries.push({ query, location });
        }
    }

    log.info(`Generated ${queries.length} search query combinations`);
    return queries;
}

/**
 * Generate a unique ID for a job based on URL
 */
export function generateJobId(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
}

/**
 * Check if a job title should be excluded based on exclude words
 */
export function shouldExcludeJob(title: string, excludeWords: string[]): boolean {
    if (excludeWords.length === 0) return false;

    const lowerTitle = title.toLowerCase();
    return excludeWords.some((word) => lowerTitle.includes(word.toLowerCase()));
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    config: RetryConfig,
    context?: string,
): Promise<T> {
    let lastError: Error | undefined;
    let delay = config.initialDelayMs;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (attempt === config.maxRetries) {
                log.error(`Failed after ${config.maxRetries} attempts${context ? ` (${context})` : ''}`, {
                    error: lastError.message,
                });
                throw lastError;
            }

            log.warning(`Attempt ${attempt}/${config.maxRetries} failed${context ? ` (${context})` : ''}. Retrying in ${delay}ms...`, {
                error: lastError.message,
            });

            await sleep(delay);
            delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
        }
    }

    throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Build Google Jobs search URL
 */
export function buildGoogleJobsUrl(query: string, location: string): string {
    const encodedQuery = encodeURIComponent(query);
    const encodedLocation = encodeURIComponent(location);

    // Google Jobs search URL pattern
    return `https://www.google.com/search?q=${encodedQuery}+${encodedLocation}&ibp=htl;jobs`;
}

/**
 * Parse salary string to structured format
 * Handles various German salary formats
 */
export function parseSalary(salaryText: string): { min?: number; max?: number; currency: string; period?: string } | undefined {
    if (!salaryText) return undefined;

    const result: { min?: number; max?: number; currency: string; period?: string } = {
        currency: '€',
    };

    // Match patterns like "50.000 € - 70.000 €" or "50k - 70k"
    const rangeMatch = salaryText.match(/(\d+[.,]?\d*)\s*k?\s*€?\s*[-–]\s*(\d+[.,]?\d*)\s*k?\s*€?/i);
    if (rangeMatch) {
        result.min = parseFloat(rangeMatch[1].replace(/\./g, '').replace(',', '.')) * (rangeMatch[1].includes('k') || rangeMatch[0].includes('k') ? 1000 : 1);
        result.max = parseFloat(rangeMatch[2].replace(/\./g, '').replace(',', '.')) * (rangeMatch[2].includes('k') || rangeMatch[0].includes('k') ? 1000 : 1);
    } else {
        // Single value like "60.000 €" or "60k"
        const singleMatch = salaryText.match(/(\d+[.,]?\d*)\s*k?\s*€?/i);
        if (singleMatch) {
            const value = parseFloat(singleMatch[1].replace(/\./g, '').replace(',', '.')) * (singleMatch[0].includes('k') ? 1000 : 1);
            result.min = value;
            result.max = value;
        }
    }

    // Determine period
    if (salaryText.toLowerCase().includes('jahr') || salaryText.toLowerCase().includes('year')) {
        result.period = 'per year';
    } else if (salaryText.toLowerCase().includes('monat') || salaryText.toLowerCase().includes('month')) {
        result.period = 'per month';
    } else if (salaryText.toLowerCase().includes('stunde') || salaryText.toLowerCase().includes('hour')) {
        result.period = 'per hour';
    }

    return result.min || result.max ? result : undefined;
}

/**
 * Clean and normalize text
 */
export function cleanText(text: string): string {
    return text
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, ' ')
        .trim();
}

/**
 * Extract date string and parse to ISO format
 */
export function parsePublishedDate(dateText: string): string {
    if (!dateText) return new Date().toISOString();

    const now = new Date();

    // Handle "vor X Tagen/Stunden" format
    const daysMatch = dateText.match(/vor\s+(\d+)\s+tag/i);
    if (daysMatch) {
        const days = parseInt(daysMatch[1], 10);
        const date = new Date(now);
        date.setDate(date.getDate() - days);
        return date.toISOString();
    }

    const hoursMatch = dateText.match(/vor\s+(\d+)\s+stunde/i);
    if (hoursMatch) {
        const hours = parseInt(hoursMatch[1], 10);
        const date = new Date(now);
        date.setHours(date.getHours() - hours);
        return date.toISOString();
    }

    // Default to current date if parsing fails
    return now.toISOString();
}

/**
 * Log error with context
 */
export function logError(error: unknown, context?: string): ScraperError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const scraperError: ScraperError = {
        error: errorMessage,
        timestamp: new Date().toISOString(),
        ...(context && { query: context }),
    };

    log.error('Scraper error', scraperError);
    return scraperError;
}

/**
 * Calculate statistics duration
 */
export function calculateDuration(startTime: Date, endTime: Date): number {
    return endTime.getTime() - startTime.getTime();
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(durationMs: number): string {
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Create user agent string
 */
export function getUserAgent(): string {
    const agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    ];
    return agents[Math.floor(Math.random() * agents.length)];
}

/**
 * Validate and normalize URL
 */
export function normalizeUrl(url: string): string {
    if (!url.startsWith('http')) {
        return `https://www.google.com${url.startsWith('/') ? '' : '/'}${url}`;
    }
    return url;
}

/**
 * Check if a job is within the last N days
 */
export function isJobRecent(publishedDate: string, maxDaysOld: number = 90): boolean {
    try {
        const jobDate = new Date(publishedDate);
        const now = new Date();
        const diffMs = now.getTime() - jobDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        return diffDays <= maxDaysOld;
    } catch (error) {
        // If date parsing fails, assume it's recent to avoid filtering out valid jobs
        log.warning(`Failed to parse date: ${publishedDate}`, { error });
        return true;
    }
}
