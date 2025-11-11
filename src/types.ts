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
    maxResults: z.number().int().min(10).max(500).default(50),
    includeRemote: z.boolean().default(true),
    excludeWords: z.array(z.string()).default([]),
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
 * Main scraped job data structure
 */
export interface ScrapedJob {
    id: string;
    title: string;
    company: string;
    location: string;
    workType: string; // Vollzeit, Teilzeit, Praktikum, etc.
    experienceLevel: string;
    salary?: Salary;
    description: string;
    jobUrl: string;
    publishedDate: string;
    companySize?: string;
    industry?: string;
    scrapedAt: string;
    searchQuery: string;
    searchLocation: string;
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
