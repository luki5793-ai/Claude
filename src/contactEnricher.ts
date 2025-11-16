/**
 * Contact Enrichment Module
 * Finds contact information for IT managers and HR decision-makers
 */

import { log } from 'apify';
import { gotScraping } from 'got-scraping';
import * as cheerio from 'cheerio';
import type { ContactPerson } from './types.js';
import { sleep, getUserAgent } from './utils.js';

/**
 * Position keywords for IT managers and HR decision-makers
 */
const IT_MANAGER_KEYWORDS = [
    'it-leiter',
    'it leiter',
    'cio',
    'chief information officer',
    'it-direktor',
    'it direktor',
    'head of it',
    'head of technology',
    'cto',
    'chief technology officer',
    'it-manager',
    'it manager',
];

const HR_KEYWORDS = [
    'personalleiter',
    'hr-leiter',
    'hr leiter',
    'chief people officer',
    'head of hr',
    'head of people',
    'personalchef',
    'hr-direktor',
    'hr direktor',
    'chro',
    'chief human resources officer',
];

/**
 * Common German email patterns
 * Currently unused but kept for future use
 */
// const EMAIL_PATTERNS = [
//     '{firstname}.{lastname}@{domain}',
//     '{first}.{last}@{domain}',
//     '{f}.{lastname}@{domain}',
//     '{firstname}{lastname}@{domain}',
//     '{lastname}@{domain}',
// ];

/**
 * Configuration for contact enrichment
 */
export interface ContactEnrichmentConfig {
    maxContactsPerCompany: number;
    timeout: number;
    enableWebScraping: boolean;
    enableEmailGeneration: boolean;
}

/**
 * Find company website from company name
 */
async function findCompanyWebsite(companyName: string, timeout: number): Promise<string | undefined> {
    try {
        // Try multiple search strategies
        const searchStrategies = [
            `${companyName} offizielle website`,
            `${companyName} Deutschland`,
            `${companyName} karriere`,
            companyName,
        ];

        for (const searchTerm of searchStrategies) {
            try {
                const searchQuery = encodeURIComponent(searchTerm);
                const searchUrl = `https://www.google.com/search?q=${searchQuery}`;

                const response = await gotScraping({
                    url: searchUrl,
                    headers: {
                        'User-Agent': getUserAgent(),
                        'Accept': 'text/html',
                        'Accept-Language': 'de-DE,de;q=0.9',
                    },
                    timeout: { request: Math.min(timeout, 15000) }, // Max 15s per attempt
                    http2: true,
                    throwHttpErrors: false,
                });

                if (response.statusCode !== 200) {
                    continue;
                }

                const $ = cheerio.load(response.body);

                // Try multiple selectors for finding links
                const linkSelectors = [
                    'div.g a[href^="http"]',
                    'a[href^="http"]',
                    'cite',
                ];

                for (const selector of linkSelectors) {
                    const elements = $(selector);

                    for (let i = 0; i < Math.min(elements.length, 5); i++) {
                        const element = elements.eq(i);
                        let link = element.attr('href') || element.text();

                        if (!link) continue;

                        // Clean up the link
                        if (!link.startsWith('http')) {
                            link = 'https://' + link;
                        }

                        // Filter out unwanted domains
                        const excludedDomains = [
                            'google.com', 'facebook.com', 'linkedin.com',
                            'xing.com', 'indeed.com', 'stepstone.de',
                            'youtube.com', 'twitter.com', 'instagram.com'
                        ];

                        if (!excludedDomains.some(domain => link.includes(domain))) {
                            log.debug(`Found company website: ${link} for ${companyName}`);
                            return link;
                        }
                    }
                }

                // Small delay between search attempts
                await sleep(500);
            } catch (error) {
                log.debug(`Search attempt failed for "${searchTerm}"`, { error });
                continue;
            }
        }

        return undefined;
    } catch (error) {
        log.warning(`Failed to find company website for ${companyName}`, { error });
        return undefined;
    }
}

/**
 * Extract contacts from company website
 */
async function scrapeCompanyContacts(
    websiteUrl: string,
    config: ContactEnrichmentConfig,
): Promise<ContactPerson[]> {
    const contacts: ContactPerson[] = [];

    try {
        // First, try to find Impressum or Contact page
        const contactPageUrls = [
            `${websiteUrl}/impressum`,
            `${websiteUrl}/kontakt`,
            `${websiteUrl}/contact`,
            `${websiteUrl}/team`,
            `${websiteUrl}/about`,
            `${websiteUrl}/ueber-uns`,
        ];

        for (const pageUrl of contactPageUrls) {
            if (contacts.length >= config.maxContactsPerCompany) break;

            try {
                await sleep(1000); // Respectful delay

                const response = await gotScraping({
                    url: pageUrl,
                    headers: {
                        'User-Agent': getUserAgent(),
                        'Accept': 'text/html',
                    },
                    timeout: { request: config.timeout },
                    http2: true,
                    throwHttpErrors: false,
                });

                if (response.statusCode !== 200) continue;

                const $ = cheerio.load(response.body);
                const pageText = $('body').text().toLowerCase();

                // Look for IT manager or HR keywords
                const foundContacts = extractContactsFromPage($, pageText);
                contacts.push(...foundContacts);

            } catch (error) {
                log.debug(`Failed to scrape ${pageUrl}`, { error });
                continue;
            }
        }
    } catch (error) {
        log.warning(`Failed to scrape company contacts from ${websiteUrl}`, { error });
    }

    return contacts.slice(0, config.maxContactsPerCompany);
}

/**
 * Extract contacts from page HTML
 */
function extractContactsFromPage($: cheerio.CheerioAPI, pageText: string): ContactPerson[] {
    const contacts: ContactPerson[] = [];

    // Look for email addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = $('body').text().match(emailRegex) || [];

    // Look for phone numbers (German format)
    const phoneRegex = /(?:\+49|0049|0)\s*\d{2,5}\s*\d{3,}\s*\d{3,}/g;
    const phones = $('body').text().match(phoneRegex) || [];

    // Try to find names with positions
    const namePatterns = [
        /(?:herr|frau)\s+([A-ZÄÖÜ][a-zäöüß]+)\s+([A-ZÄÖÜ][a-zäöüß]+)/gi,
        /([A-ZÄÖÜ][a-zäöüß]+)\s+([A-ZÄÖÜ][a-zäöüß]+)(?:,|\s+-\s+)(?:IT-Leiter|CIO|CTO|HR-Leiter|Personalleiter)/gi,
    ];

    for (const pattern of namePatterns) {
        const matches = pageText.matchAll(pattern);
        for (const match of matches) {
            if (contacts.length >= 2) break;

            const salutation = match[0].toLowerCase().includes('herr') ? 'Herr' :
                             match[0].toLowerCase().includes('frau') ? 'Frau' : 'N/A';
            const firstName = match[1] || 'N/A';
            const lastName = match[2] || 'N/A';

            // Determine position based on context
            let position = 'N/A';
            const contextText = match[0].toLowerCase();

            if (IT_MANAGER_KEYWORDS.some(kw => contextText.includes(kw))) {
                position = 'IT-Leiter';
            } else if (HR_KEYWORDS.some(kw => contextText.includes(kw))) {
                position = 'Personalentscheider';
            }

            contacts.push({
                salutation,
                firstName,
                lastName,
                email: emails[0] || undefined,
                phone: phones[0] || undefined,
                position,
                source: 'Company Website',
            });
        }
    }

    return contacts;
}

/**
 * Generate email addresses using common patterns
 * Currently unused but kept for future use
 */
// function generateEmailAddresses(
//     firstName: string,
//     lastName: string,
//     domain: string,
// ): string[] {
//     const emails: string[] = [];
//     const f = firstName.toLowerCase();
//     const l = lastName.toLowerCase();
//     const first = f.charAt(0);

//     for (const pattern of EMAIL_PATTERNS) {
//         const email = pattern
//             .replace('{firstname}', f)
//             .replace('{lastname}', l)
//             .replace('{first}', f)
//             .replace('{last}', l)
//             .replace('{f}', first)
//             .replace('{domain}', domain);
//         emails.push(email);
//     }

//     return emails;
// }

/**
 * Extract domain from company website URL
 */
function extractDomain(websiteUrl: string): string {
    try {
        const url = new URL(websiteUrl);
        return url.hostname.replace('www.', '');
    } catch {
        return websiteUrl.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0];
    }
}

/**
 * Main function to enrich job with contact information
 */
export async function enrichJobWithContacts(
    companyName: string,
    config: ContactEnrichmentConfig,
): Promise<{ contacts: ContactPerson[]; website?: string }> {
    log.info(`Enriching contacts for company: ${companyName}`);

    const contacts: ContactPerson[] = [];
    let website: string | undefined;

    try {
        // Step 1: Find company website
        if (config.enableWebScraping) {
            website = await findCompanyWebsite(companyName, config.timeout);

            if (website) {
                // Step 2: Scrape company contacts from website
                const scrapedContacts = await scrapeCompanyContacts(website, config);
                contacts.push(...scrapedContacts);
            }
        }

        // Step 3: If no contacts found and email generation is enabled, create placeholder contacts
        if (contacts.length === 0 && config.enableEmailGeneration && website) {
            const domain = extractDomain(website);

            // Create placeholder contacts for IT manager and HR
            const placeholderContacts: ContactPerson[] = [
                {
                    salutation: 'N/A',
                    firstName: 'N/A',
                    lastName: 'N/A',
                    email: `it-leitung@${domain}`,
                    phone: undefined,
                    position: 'IT-Leiter',
                    source: 'Generated (not verified)',
                },
                {
                    salutation: 'N/A',
                    firstName: 'N/A',
                    lastName: 'N/A',
                    email: `personal@${domain}`,
                    phone: undefined,
                    position: 'Personalentscheider',
                    source: 'Generated (not verified)',
                },
            ];

            contacts.push(...placeholderContacts.slice(0, config.maxContactsPerCompany));
        }

    } catch (error) {
        log.error(`Failed to enrich contacts for ${companyName}`, { error });
    }

    // If still no contacts, return empty array with note
    if (contacts.length === 0) {
        log.warning(`No contacts found for ${companyName}`);
    } else {
        log.info(`Found ${contacts.length} contact(s) for ${companyName}`);
    }

    return {
        contacts: contacts.slice(0, config.maxContactsPerCompany),
        website,
    };
}

/**
 * Batch enrich jobs with contacts (with rate limiting)
 */
export async function batchEnrichContacts(
    companies: string[],
    config: ContactEnrichmentConfig,
    delayBetweenRequests: number = 2000,
): Promise<Map<string, { contacts: ContactPerson[]; website?: string }>> {
    const results = new Map<string, { contacts: ContactPerson[]; website?: string }>();

    for (const company of companies) {
        try {
            const result = await enrichJobWithContacts(company, config);
            results.set(company, result);

            // Rate limiting
            await sleep(delayBetweenRequests);
        } catch (error) {
            log.error(`Failed to enrich ${company}`, { error });
            results.set(company, { contacts: [] });
        }
    }

    return results;
}
