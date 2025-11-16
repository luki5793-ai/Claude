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
        // Normalize website URL
        let baseUrl = websiteUrl;
        if (!baseUrl.startsWith('http')) {
            baseUrl = 'https://' + baseUrl;
        }
        // Remove trailing slash
        baseUrl = baseUrl.replace(/\/$/, '');

        // Comprehensive list of pages where contacts might be found
        const contactPageUrls = [
            `${baseUrl}/impressum`,
            `${baseUrl}/kontakt`,
            `${baseUrl}/contact`,
            `${baseUrl}/team`,
            `${baseUrl}/about`,
            `${baseUrl}/ueber-uns`,
            `${baseUrl}/about-us`,
            `${baseUrl}/unternehmen`,
            `${baseUrl}/company`,
            `${baseUrl}/karriere`,
            `${baseUrl}/career`,
            `${baseUrl}/jobs`,
            `${baseUrl}/ansprechpartner`,
            `${baseUrl}/mitarbeiter`,
            `${baseUrl}`, // Try main page too
        ];

        for (const pageUrl of contactPageUrls) {
            if (contacts.length >= config.maxContactsPerCompany) break;

            try {
                await sleep(800); // Respectful delay

                const response = await gotScraping({
                    url: pageUrl,
                    headers: {
                        'User-Agent': getUserAgent(),
                        'Accept': 'text/html',
                        'Accept-Language': 'de-DE,de;q=0.9',
                    },
                    timeout: { request: Math.min(config.timeout, 10000) }, // Max 10s per page
                    http2: true,
                    throwHttpErrors: false,
                });

                if (response.statusCode !== 200) continue;

                const $ = cheerio.load(response.body);
                const pageText = $('body').text();

                // Look for IT manager or HR keywords
                const foundContacts = extractContactsFromPage($, pageText);

                // Add unique contacts only
                for (const contact of foundContacts) {
                    const isDuplicate = contacts.some(c =>
                        c.email === contact.email ||
                        (c.firstName === contact.firstName && c.lastName === contact.lastName)
                    );

                    if (!isDuplicate) {
                        contacts.push(contact);
                    }

                    if (contacts.length >= config.maxContactsPerCompany) break;
                }

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
    const emailMatches = pageText.match(emailRegex) || [];

    // Filter out common non-personal emails
    const emails = emailMatches.filter(email => {
        const emailLower = email.toLowerCase();
        return !emailLower.startsWith('info@') &&
               !emailLower.startsWith('kontakt@') &&
               !emailLower.startsWith('contact@') &&
               !emailLower.startsWith('office@') &&
               !emailLower.startsWith('mail@') &&
               !emailLower.startsWith('support@') &&
               !emailLower.startsWith('service@') &&
               !emailLower.includes('noreply') &&
               !emailLower.includes('no-reply');
    });

    // Look for phone numbers (German format)
    const phoneRegex = /(?:\+49|0049|0)\s*\d{2,5}[\s\-/]*\d{3,}[\s\-/]*\d{3,}/g;
    const phones = pageText.match(phoneRegex) || [];

    // Enhanced name patterns - try to find names with positions or near IT/HR keywords
    const namePatterns = [
        // Herr/Frau with name
        /(?:herr|frau)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+von|\s+de)?)\s+([A-ZÄÖÜ][a-zäöüß]+)/gi,
        // Name with position (Title - Name)
        /([A-ZÄÖÜ][a-zäöüß]+)\s+([A-ZÄÖÜ][a-zäöüß]+)\s*[-–,]\s*(?:IT-Leiter|CIO|CTO|HR-Leiter|Personalleiter|Geschäftsführer|Director|Manager)/gi,
        // Position: Name format
        /(?:IT-Leiter|CIO|CTO|HR-Leiter|Personalleiter|Geschäftsführer):\s*(?:herr|frau)?\s*([A-ZÄÖÜ][a-zäöüß]+)\s+([A-ZÄÖÜ][a-zäöüß]+)/gi,
        // Email with name nearby (within 50 chars)
    ];

    // Try structured data first (vCard, schema.org)
    $('[itemtype*="Person"], .vcard, .person, .team-member, .staff-member').each((_, element) => {
        const $person = $(element);

        const firstName = $person.find('[itemprop="givenName"], .given-name, .first-name').text().trim() ||
                         $person.find('.name').text().split(' ')[0]?.trim();
        const lastName = $person.find('[itemprop="familyName"], .family-name, .last-name').text().trim() ||
                        $person.find('.name').text().split(' ').slice(1).join(' ').trim();
        const email = $person.find('[itemprop="email"], a[href^="mailto:"], .email').text().trim() ||
                     $person.find('a[href^="mailto:"]').attr('href')?.replace('mailto:', '');
        const phone = $person.find('[itemprop="telephone"], .phone, .tel').text().trim();
        const position = $person.find('[itemprop="jobTitle"], .title, .position, .role').text().trim();

        if (firstName && lastName && email && firstName !== 'N/A' && lastName !== 'N/A') {
            contacts.push({
                salutation: 'N/A',
                firstName,
                lastName,
                email,
                phone: phone || undefined,
                position: position || 'N/A',
                source: 'Company Website (Structured Data)',
            });
        }
    });

    // Try pattern matching if no structured data found
    if (contacts.length === 0) {
        for (const pattern of namePatterns) {
            const matches = [...pageText.matchAll(pattern)];

            for (const match of matches) {
                if (contacts.length >= 5) break; // Collect more candidates

                const salutation = match[0].toLowerCase().includes('herr') ? 'Herr' :
                                 match[0].toLowerCase().includes('frau') ? 'Frau' : 'N/A';
                const firstName = match[1]?.trim();
                const lastName = match[2]?.trim();

                if (!firstName || !lastName || firstName.length < 2 || lastName.length < 2) continue;

                // Determine position based on context
                let position = 'N/A';
                const contextText = match[0].toLowerCase();

                if (IT_MANAGER_KEYWORDS.some(kw => contextText.includes(kw))) {
                    position = 'IT-Leiter';
                } else if (HR_KEYWORDS.some(kw => contextText.includes(kw))) {
                    position = 'Personalentscheider';
                } else {
                    // Try to find position in surrounding text
                    const matchIndex = pageText.indexOf(match[0]);
                    const surroundingText = pageText.substring(Math.max(0, matchIndex - 100), matchIndex + 200).toLowerCase();

                    if (IT_MANAGER_KEYWORDS.some(kw => surroundingText.includes(kw))) {
                        position = 'IT-Leiter';
                    } else if (HR_KEYWORDS.some(kw => surroundingText.includes(kw))) {
                        position = 'Personalentscheider';
                    }
                }

                // Try to find email near this name
                const nameIndex = pageText.indexOf(match[0]);
                const nearbyText = pageText.substring(Math.max(0, nameIndex - 200), nameIndex + 200);
                const nearbyEmails = nearbyText.match(emailRegex) || [];
                const relevantEmail = nearbyEmails.find(e => emails.includes(e));

                contacts.push({
                    salutation,
                    firstName,
                    lastName,
                    email: relevantEmail || emails[0] || undefined,
                    phone: phones[0] || undefined,
                    position,
                    source: 'Company Website',
                });
            }
        }
    }

    // Filter out invalid contacts (those without real names or emails)
    return contacts.filter(c =>
        c.firstName && c.lastName &&
        c.firstName !== 'N/A' && c.lastName !== 'N/A' &&
        c.firstName.length > 1 && c.lastName.length > 1 &&
        c.email && c.email.includes('@')
    );
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

        // Step 3: Do NOT generate placeholder contacts - only real contacts are acceptable
        // If we can't find real contact information, we should return empty array
        // This ensures only jobs with verified contacts are included in results
        if (contacts.length === 0) {
            log.debug(`No real contacts found for ${companyName}, skipping placeholder generation`);
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
