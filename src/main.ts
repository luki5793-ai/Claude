/**
 * German IT Jobs Scraper - Main Entry Point
 * Production-ready Apify Actor for scraping IT jobs from multiple German job portals
 * with contact enrichment for IT managers and HR decision-makers
 */

import { Actor, log, ProxyConfiguration } from 'apify';
import { InputSchema, type Input, type ScrapedJob, type CheckpointData } from './types.js';
import { GoogleJobsScraper } from './scraper.js';
import {
    validateInput,
    generateSearchQueries,
    formatDuration,
    isValidContact,
} from './utils.js';
import {
    enrichJobWithContacts,
    type ContactEnrichmentConfig,
} from './contactEnricher.js';
import {
    exportToExcel,
    exportToCSV,
    generateExportSummary,
} from './excelExporter.js';

/**
 * Main actor handler
 */
await Actor.main(async () => {
    // Initialize actor
    log.info('🚀 Starting German IT Jobs Scraper (Multi-Portal with Contact Enrichment)');

    // Get and validate input
    const rawInput = await Actor.getInput<Input>();

    if (!rawInput) {
        throw new Error('No input provided. Please provide search queries and locations.');
    }

    // Validate input with Zod schema
    let input: Input;
    try {
        input = InputSchema.parse(rawInput);
        log.info('✅ Input validation successful');
    } catch (error) {
        log.error('❌ Input validation failed', { error });
        throw new Error(`Invalid input: ${error}`);
    }

    // Additional validation
    validateInput(input);

    // Initialize key-value store for checkpoints
    const kvStore = await Actor.openKeyValueStore();

    // Initialize dataset for results
    const dataset = await Actor.openDataset();

    // Setup proxy configuration
    let proxyConfiguration: ProxyConfiguration | undefined;
    if (input.proxyConfiguration) {
        try {
            proxyConfiguration = await Actor.createProxyConfiguration(input.proxyConfiguration);
            log.info('✅ Proxy configuration initialized');
        } catch (error) {
            log.warning('⚠️ Failed to initialize proxy configuration, continuing without proxy', { error });
        }
    }

    // Generate all search query combinations
    const searchQueries = generateSearchQueries(input.searchQueries, input.locations);

    // Initialize scraper
    const scraper = new GoogleJobsScraper(input);
    scraper.setTotalQueries(searchQueries.length);

    // Try to load checkpoint for resuming
    const checkpointKey = 'SCRAPER_CHECKPOINT';
    const checkpoint = await kvStore.getValue<CheckpointData>(checkpointKey);

    if (checkpoint) {
        log.info('📌 Resuming from checkpoint', {
            processedQueries: checkpoint.processedQueries.length,
            totalQueries: searchQueries.length,
        });
        scraper.loadCheckpoint(checkpoint.seenJobUrls, checkpoint.stats);
    }

    // Get processed query indices from checkpoint
    const processedQuerySet = new Set(
        checkpoint?.processedQueries.map((q) => `${q.query}|${q.location}`) || [],
    );

    // Track all scraped jobs for final export
    const allJobs: ScrapedJob[] = [];
    let processedCount = 0;

    // Process each search query
    for (const query of searchQueries) {
        const queryKey = `${query.query}|${query.location}`;

        // Skip if already processed (checkpoint)
        if (processedQuerySet.has(queryKey)) {
            log.info(`⏭️ Skipping already processed query: ${query.query} in ${query.location}`);
            processedCount++;
            continue;
        }

        try {
            // Get proxy URL if proxy is configured
            const proxyUrl = proxyConfiguration
                ? await proxyConfiguration.newUrl()
                : undefined;

            // Scrape jobs from all configured portals
            const jobs = await scraper.scrapeAllPortals(query, proxyUrl);

            // Save jobs to dataset
            if (jobs.length > 0) {
                await dataset.pushData(jobs);
                allJobs.push(...jobs);
                log.info(`💾 Saved ${jobs.length} jobs to dataset`);
            }

            // Update progress
            processedCount++;
            const stats = scraper.getStats();
            const progress = (processedCount / searchQueries.length) * 100;

            log.info(`📊 Progress: ${processedCount}/${searchQueries.length} queries (${progress.toFixed(1)}%)`, {
                totalJobsFound: stats.totalJobsFound,
                totalJobsScraped: stats.totalJobsScraped,
                duplicatesSkipped: stats.duplicatesSkipped,
                errorsEncountered: stats.errorsEncountered,
            });

            // Save checkpoint every 5 queries
            if (processedCount % 5 === 0) {
                processedQuerySet.add(queryKey);
                const checkpointData: CheckpointData = {
                    processedQueries: Array.from(processedQuerySet).map((key) => {
                        const [q, l] = key.split('|');
                        return { query: q, location: l };
                    }),
                    stats: scraper.getStats(),
                    seenJobUrls: scraper.getSeenUrls(),
                    lastProcessedIndex: processedCount,
                };
                await kvStore.setValue(checkpointKey, checkpointData);
                log.debug('💾 Checkpoint saved');
            }

            // Add to processed set
            processedQuerySet.add(queryKey);
        } catch (error) {
            log.error(`❌ Failed to process query: ${query.query} in ${query.location}`, { error });
            // Continue with next query (graceful degradation)
        }
    }

    // Finalize statistics
    scraper.finalizeStats();
    const finalStats = scraper.getStats();
    const errors = scraper.getErrors();

    // Contact enrichment phase
    if (input.enableContactEnrichment && allJobs.length > 0) {
        log.info('🔍 Starting contact enrichment phase...');

        const contactConfig: ContactEnrichmentConfig = {
            maxContactsPerCompany: input.maxContactsPerCompany,
            timeout: input.requestTimeout,
            enableWebScraping: true,
            enableEmailGeneration: true,
        };

        // Get unique companies
        const uniqueCompanies = Array.from(new Set(allJobs.map(job => job.company)));
        log.info(`Enriching contacts for ${uniqueCompanies.length} unique companies...`);

        let enrichedCount = 0;

        // Process companies in parallel batches for better performance
        const BATCH_SIZE = 5; // Process 5 companies at a time
        const batches: string[][] = [];

        for (let i = 0; i < uniqueCompanies.length; i += BATCH_SIZE) {
            batches.push(uniqueCompanies.slice(i, i + BATCH_SIZE));
        }

        log.info(`Processing ${batches.length} batches of up to ${BATCH_SIZE} companies in parallel...`);

        for (const batch of batches) {
            // Process batch in parallel
            const batchResults = await Promise.allSettled(
                batch.map(async (company) => {
                    try {
                        // Find all jobs for this company
                        const companyJobs = allJobs.filter(job => job.company === company);

                        // Enrich contact data
                        const { contacts, website } = await enrichJobWithContacts(company, contactConfig);

                        // Update all jobs for this company with contact data
                        for (const job of companyJobs) {
                            job.contacts = contacts;
                            job.companyWebsite = website;
                        }

                        return { company, success: contacts.length > 0 };
                    } catch (error) {
                        log.warning(`Failed to enrich contacts for ${company}`, { error });
                        return { company, success: false };
                    }
                })
            );

            // Count successes
            batchResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value.success) {
                    enrichedCount++;
                }
            });

            log.info(`Progress: ${enrichedCount}/${uniqueCompanies.length} companies enriched`);

            // Reduced delay between batches (from 3s to 1s)
            if (batches.indexOf(batch) < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        log.info(`✅ Contact enrichment completed: ${enrichedCount}/${uniqueCompanies.length} companies enriched`);

        // CRITICAL: Filter out jobs without valid contact information
        // Only keep jobs that have at least one valid contact with name AND email
        const jobsBeforeContactFilter = allJobs.length;
        const jobsWithValidContacts = allJobs.filter(job => {
            if (!job.contacts || job.contacts.length === 0) {
                return false;
            }

            // Check if at least one contact has valid information (real name + email)
            return job.contacts.some(contact => isValidContact(contact));
        });

        log.info(`📧 Contact validation filter: ${jobsBeforeContactFilter} -> ${jobsWithValidContacts.length} jobs`);
        log.info(`   Removed ${jobsBeforeContactFilter - jobsWithValidContacts.length} jobs without valid contact information`);

        // Replace allJobs with filtered list
        allJobs.length = 0;
        allJobs.push(...jobsWithValidContacts);

        // Update dataset with enriched and filtered jobs
        const datasetClient = await Actor.openDataset();
        await datasetClient.drop(); // Clear old data
        await datasetClient.pushData(allJobs); // Push enriched and filtered data
    } else {
        // If contact enrichment is disabled, warn user and filter out all jobs
        log.warning('⚠️ Contact enrichment is DISABLED. This actor requires contact information, so NO jobs will be exported!');
        allJobs.length = 0; // Clear all jobs since we need contact info
    }

    // Export to Excel/CSV
    log.info('📊 Generating Excel and CSV exports...');

    try {
        // Generate Excel file
        const excelBuffer = exportToExcel(allJobs);
        await kvStore.setValue('jobs_export.xlsx', excelBuffer, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        log.info('✅ Excel export saved to key-value store: jobs_export.xlsx');

        // Generate CSV file
        const csvBuffer = exportToCSV(allJobs);
        await kvStore.setValue('jobs_export.csv', csvBuffer, { contentType: 'text/csv' });
        log.info('✅ CSV export saved to key-value store: jobs_export.csv');

        // Generate export summary
        const exportSummary = generateExportSummary(allJobs);
        await kvStore.setValue('EXPORT_SUMMARY', exportSummary);
        log.info('✅ Export summary saved');

    } catch (error) {
        log.error('Failed to generate exports', { error });
    }

    // Log final statistics
    log.info('✅ Scraping completed!');
    log.info('📈 Final Statistics:', {
        totalJobsFound: finalStats.totalJobsFound,
        totalJobsScraped: finalStats.totalJobsScraped,
        duplicatesSkipped: finalStats.duplicatesSkipped,
        errorsEncountered: finalStats.errorsEncountered,
        queriesProcessed: finalStats.queriesProcessed,
        totalQueries: finalStats.totalQueries,
        duration: formatDuration(finalStats.durationMs || 0),
    });

    // Save final statistics to key-value store
    await kvStore.setValue('FINAL_STATS', {
        stats: finalStats,
        errors,
        input: {
            searchQueries: input.searchQueries,
            locations: input.locations,
            maxResults: input.maxResults,
        },
        scrapedAt: new Date().toISOString(),
    });

    // Save errors if any
    if (errors.length > 0) {
        log.warning(`⚠️ Encountered ${errors.length} errors during scraping`);
        await kvStore.setValue('SCRAPING_ERRORS', errors);
    }

    // Generate summary report
    const summary = {
        title: 'Google Jobs IT Scraper - Run Summary',
        generatedAt: new Date().toISOString(),
        input: {
            searchQueries: input.searchQueries,
            locations: input.locations,
            maxResults: input.maxResults,
            includeRemote: input.includeRemote,
            excludeWords: input.excludeWords,
        },
        statistics: finalStats,
        topCompanies: getTopCompanies(allJobs, 10),
        topLocations: getTopLocations(allJobs, 10),
        workTypeDistribution: getWorkTypeDistribution(allJobs),
        experienceLevelDistribution: getExperienceLevelDistribution(allJobs),
        jobsWithSalary: allJobs.filter((job) => job.salary).length,
        averageSalary: calculateAverageSalary(allJobs),
    };

    await kvStore.setValue('RUN_SUMMARY', summary);
    log.info('📄 Summary report saved to key-value store');

    // Clear checkpoint on successful completion
    await kvStore.setValue(checkpointKey, null);

    // Log completion message with export info
    log.info('🎉 Actor finished successfully!');
    log.info(`📊 Results: ${finalStats.totalJobsScraped} jobs from ${input.jobPortals.join(', ')} portals`);
    log.info(`📁 Exports: Excel and CSV files saved to key-value store`);
    log.info(`⏱️ Duration: ${formatDuration(finalStats.durationMs || 0)}`);
    log.info('💾 Download exports from the key-value store: jobs_export.xlsx, jobs_export.csv');
});

/**
 * Helper function to get top companies by job count
 */
function getTopCompanies(jobs: ScrapedJob[], limit: number): Array<{ company: string; count: number }> {
    const companyCounts = new Map<string, number>();

    for (const job of jobs) {
        const count = companyCounts.get(job.company) || 0;
        companyCounts.set(job.company, count + 1);
    }

    return Array.from(companyCounts.entries())
        .map(([company, count]) => ({ company, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

/**
 * Helper function to get top locations by job count
 */
function getTopLocations(jobs: ScrapedJob[], limit: number): Array<{ location: string; count: number }> {
    const locationCounts = new Map<string, number>();

    for (const job of jobs) {
        const count = locationCounts.get(job.location) || 0;
        locationCounts.set(job.location, count + 1);
    }

    return Array.from(locationCounts.entries())
        .map(([location, count]) => ({ location, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

/**
 * Helper function to get work type distribution
 */
function getWorkTypeDistribution(jobs: ScrapedJob[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const job of jobs) {
        distribution[job.workType] = (distribution[job.workType] || 0) + 1;
    }

    return distribution;
}

/**
 * Helper function to get experience level distribution
 */
function getExperienceLevelDistribution(jobs: ScrapedJob[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const job of jobs) {
        distribution[job.experienceLevel] = (distribution[job.experienceLevel] || 0) + 1;
    }

    return distribution;
}

/**
 * Helper function to calculate average salary
 */
function calculateAverageSalary(jobs: ScrapedJob[]): { min: number; max: number; currency: string } | null {
    const jobsWithSalary = jobs.filter((job) => job.salary);

    if (jobsWithSalary.length === 0) return null;

    const totalMin = jobsWithSalary.reduce((sum, job) => sum + (job.salary?.min || 0), 0);
    const totalMax = jobsWithSalary.reduce((sum, job) => sum + (job.salary?.max || 0), 0);

    return {
        min: Math.round(totalMin / jobsWithSalary.length),
        max: Math.round(totalMax / jobsWithSalary.length),
        currency: '€',
    };
}
