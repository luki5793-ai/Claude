/**
 * Type definitions for Google Jobs IT Scraper
 */

import { z } from 'zod';

/**
 * Input schema validation using Zod
 */
export const InputSchema = z.object({
    searchQueries: z.array(z.string().min(1)).min(1),
    locations: z.array(z.string().min(1)).min(1),
    postalCodeFilter: z.array(z.string()).default(['5']), // Filter by postal code prefix (e.g., ['5'] for Köln/Bonn region)
    jobPortals: z.array(z.enum(['google', 'stepstone', 'indeed', 'all'])).default(['all']),
    maxResults: z.number().int().min(10).max(500).default(50),
    includeRemote: z.boolean().default(true),
    excludeWords: z.array(z.string()).default([]),
    excludeRecruitmentAgencies: z.boolean().default(true), // Exclude recruitment agencies by default
    maxJobAgeDays: z.number().int().min(1).max(365).default(90), // Filter jobs by age (default: 90 days)
    enableContactEnrichment: z.boolean().default(true), // Enable contact data enrichment
    maxContactsPerCompany: z.number().int().min(1).max(5).default(2), // Max contacts per company
    requestTimeout: z.number().int().min(5000).max(120000).default(30000),
    maxRetries: z.number().int().min(1).max(5).default(3),
    proxyConfiguration: z.any().optional(),
    minDelayBetweenRequests: z.number().int().min(500).max(10000).default(1000),
    maxDelayBetweenRequests: z.number().int().min(1000).max(15000).default(3000),
});

export type Input = z.infer<typeof InputSchema>;

/**
 * Salary information structure
 */
export interface Salary {
    min?: number;
    max?: number;
    currency: string;
    period?: string; // per year, per month, per hour
}

/**
 * Contact person information
 */
export interface ContactPerson {
    salutation: string; // Herr, Frau
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    position: string; // IT-Leiter, Personalentscheider, etc.
    source: string; // Where the contact was found (LinkedIn, company website, etc.)
}

/**
 * Main scraped job data structure
 */
export interface ScrapedJob {
    id: string;
    title: string;
    company: string;
    location: string;
    postalCode?: string; // Extracted postal code
    workType: string; // Vollzeit, Teilzeit, Praktikum, etc.
    experienceLevel: string;
    salary?: Salary;
    description: string;
    jobUrl: string;
    publishedDate: string;
    companySize?: string;
    industry?: string;
    isRecruitmentAgency: boolean; // Flag for recruitment agency
    recruitmentAgencyReason?: string; // Reason why it's flagged as recruitment agency
    contacts?: ContactPerson[]; // Contact persons (IT managers, HR decision-makers)
    companyWebsite?: string; // Company website URL
    scrapedAt: string;
    searchQuery: string;
    searchLocation: string;
    portal: string; // Which portal the job was found on (google, stepstone, indeed)
}

/**
 * Scraper statistics for tracking progress
 */
export interface ScraperStats {
    totalJobsFound: number;
    totalJobsScraped: number;
    duplicatesSkipped: number;
    errorsEncountered: number;
    queriesProcessed: number;
    totalQueries: number;
    startTime: Date;
    endTime?: Date;
    durationMs?: number;
}

/**
 * Request retry configuration
 */
export interface RetryConfig {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
}

/**
 * Search query combination
 */
export interface SearchQuery {
    query: string;
    location: string;
}

/**
 * Error tracking structure
 */
export interface ScraperError {
    url?: string;
    query?: string;
    location?: string;
    error: string;
    timestamp: string;
    attemptNumber?: number;
}

/**
 * HTTP Request options
 */
export interface RequestOptions {
    url: string;
    timeout: number;
    retryConfig: RetryConfig;
    proxyUrl?: string;
    headers?: Record<string, string>;
}

/**
 * Checkpoint data for resuming interrupted runs
 */
export interface CheckpointData {
    processedQueries: SearchQuery[];
    stats: ScraperStats;
    seenJobUrls: string[];
    lastProcessedIndex: number;
}
