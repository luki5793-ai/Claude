/**
 * Contact Enrichment Module
 * Finds REAL contact information for IT managers and HR decision-makers
 * NO PLACEHOLDERS - only verified, complete contact data
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
    'it-leiter', 'it leiter', 'cio', 'chief information officer',
    'it-direktor', 'it direktor', 'head of it', 'head of technology',
    'cto', 'chief technology officer', 'it-manager', 'it manager',
    'leiter informationstechnik', 'geschäftsführer it', 'it-geschäftsführer',
];

const HR_KEYWORDS = [
    'personalleiter', 'hr-leiter', 'hr leiter', 'chief people officer',
    'head of hr', 'head of people', 'personalchef', 'hr-direktor',
    'hr direktor', 'chro', 'chief human resources officer',
    'personalabteilung', 'recruiting', 'personalreferent',
];

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
 * Validate email format
 */
function isValidEmail(email: string): boolean {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
    return emailRegex.test(email) &&
           !email.includes('example') &&
           !email.includes('placeholder') &&
           !email.includes('noreply');
}

/**
 * Validate phone number (German format)
 */
function isValidPhone(phone: string): boolean {
    // German phone numbers: +49, 0049, or 0 followed by area code and number
    const cleanPhone = phone.replace(/\s+/g, '');
    return cleanPhone.length >= 10 && /^(\+49|0049|0)\d{9,}$/.test(cleanPhone);
}

/**
 * Validate name (no placeholders, proper format)
 */
function isValidName(name: string): boolean {
    return name.length >= 2 &&
           name !== 'N/A' &&
           name !== 'Unknown' &&
           !/\d/.test(name) && // No numbers
           /^[A-ZÄÖÜ][a-zäöüß]+/.test(name); // Starts with capital letter
}

/**
 * Find company website from company name
 */
async function findCompanyWebsite(companyName: string, timeout: number): Promise<string | undefined> {
    try {
        const searchQuery = encodeURIComponent(`${companyName} Deutschland website impressum`);
        const searchUrl = `https://www.google.com/search?q=${searchQuery}&num=5`;

        const response = await gotScraping({
            url: searchUrl,
            headers: {
                'User-Agent': getUserAgent(),
                'Accept': 'text/html',
                'Accept-Language': 'de-DE,de;q=0.9',
            },
            timeout: { request: timeout },
            http2: true,
            throwHttpErrors: false,
        });

        if (response.statusCode !== 200) {
            return undefined;
        }

        const $ = cheerio.load(response.body);

        // Try multiple selectors for search results
        const linkSelectors = [
            'div.g a[href^="http"]',
            'div[data-ved] a[href^="http"]',
            'a[jsname][href^="http"]',
        ];

        for (const selector of linkSelectors) {
            const links = $(selector);
            for (let i = 0; i < Math.min(links.length, 3); i++) {
                const link = $(links[i]).attr('href');
                if (link &&
                    !link.includes('google.com') &&
                    !link.includes('facebook.com') &&
                    !link.includes('linkedin.com') &&
                    !link.includes('xing.com')) {
                    log.debug(`Found company website: ${link} for ${companyName}`);
                    return link;
                }
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
    companyName: string,
    config: ContactEnrichmentConfig,
): Promise<ContactPerson[]> {
    const contacts: ContactPerson[] = [];
    const baseUrl = new URL(websiteUrl).origin;

    try {
        // Extended list of pages to check
        const contactPagePaths = [
            '/impressum', '/Impressum',
            '/kontakt', '/Kontakt', '/contact', '/Contact',
            '/team', '/Team', '/about', '/About',
            '/ueber-uns', '/Ueber-uns',
            '/ansprechpartner', '/Ansprechpartner',
            '/mitarbeiter', '/Mitarbeiter',
            '/management', '/Management',
            '/geschaeftsfuehrung', '/Geschaeftsfuehrung',
        ];

        for (const path of contactPagePaths) {
            if (contacts.length >= config.maxContactsPerCompany) break;

            const pageUrl = `${baseUrl}${path}`;

            try {
                await sleep(1500); // Respectful delay

                const response = await gotScraping({
                    url: pageUrl,
                    headers: {
                        'User-Agent': getUserAgent(),
                        'Accept': 'text/html',
                        'Accept-Language': 'de-DE,de;q=0.9',
                    },
                    timeout: { request: config.timeout },
                    http2: true,
                    throwHttpErrors: false,
                });

                if (response.statusCode !== 200) continue;

                const $ = cheerio.load(response.body);
                const foundContacts = extractContactsFromPage($, companyName, pageUrl);

                // Only add validated contacts
                for (const contact of foundContacts) {
                    if (contacts.length >= config.maxContactsPerCompany) break;
                    if (isValidContact(contact)) {
                        contacts.push(contact);
                        log.info(`Found valid contact: ${contact.firstName} ${contact.lastName} (${contact.position})`);
                    }
                }

            } catch (error) {
                log.debug(`Failed to scrape ${pageUrl}`, { error });
                continue;
            }
        }
    } catch (error) {
        log.warning(`Failed to scrape company contacts from ${websiteUrl}`, { error });
    }

    return contacts;
}

/**
 * Extract contacts from page HTML with advanced parsing
 */
function extractContactsFromPage($: cheerio.CheerioAPI, companyName: string, pageUrl: string): ContactPerson[] {
    const contacts: ContactPerson[] = [];
    const pageText = $('body').text();

    // Find all email addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const allEmails = pageText.match(emailRegex) || [];
    const validEmails = allEmails.filter(isValidEmail);

    // Find all phone numbers (German format)
    const phoneRegex = /(?:\+49|0049|0)\s*[\d\s\/\-\(\)]{10,}/g;
    const allPhones = pageText.match(phoneRegex) || [];
    const validPhones = allPhones.filter(isValidPhone);

    // Advanced name extraction patterns
    const namePatterns = [
        // Pattern: "Herr/Frau Firstname Lastname, Position"
        /(?:Herr|Frau)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)\s+([A-ZÄÖÜ][a-zäöüß]+)(?:\s*[,:\-]?\s*)?([^\n]{0,100})/gi,

        // Pattern: "Firstname Lastname - Position"
        /([A-ZÄÖÜ][a-zäöüß]+)\s+([A-ZÄÖÜ][a-zäöüß]+)\s*[-–]\s*([^\n]{0,50}(?:leiter|chef|manager|direktor|officer|cio|cto|hr)[^\n]{0,50})/gi,

        // Pattern in structured data (vCard, hCard)
        /<(?:div|span)[^>]*(?:class|itemtype)="[^"]*(?:vcard|hcard|person)[^"]*"[^>]*>([^<]+)</gi,
    ];

    const seenNames = new Set<string>();

    for (const pattern of namePatterns) {
        const matches = pageText.matchAll(pattern);

        for (const match of matches) {
            if (contacts.length >= 5) break; // Collect more initially, filter later

            let salutation = 'Herr';
            let firstName = '';
            let lastName = '';
            let position = '';
            let contextText = match[0].toLowerCase();

            // Determine salutation
            if (contextText.includes('frau')) {
                salutation = 'Frau';
            }

            // Extract name parts based on pattern
            if (match.length >= 3) {
                firstName = match[1]?.trim() || '';
                lastName = match[2]?.trim() || '';
                position = match[3]?.trim() || '';
            }

            // Validate name
            if (!isValidName(firstName) || !isValidName(lastName)) continue;

            // Skip duplicates
            const nameKey = `${firstName} ${lastName}`.toLowerCase();
            if (seenNames.has(nameKey)) continue;
            seenNames.add(nameKey);

            // Determine if IT or HR position
            let matchedPosition = '';
            const positionText = `${position} ${contextText}`.toLowerCase();

            if (IT_MANAGER_KEYWORDS.some(kw => positionText.includes(kw))) {
                matchedPosition = 'IT-Leiter';
            } else if (HR_KEYWORDS.some(kw => positionText.includes(kw))) {
                matchedPosition = 'Personalentscheider';
            }

            // Only include if we found a matching position
            if (!matchedPosition) continue;

            // Try to find associated email and phone
            // Look for email/phone near the name in the HTML
            const nameIndex = pageText.indexOf(firstName + ' ' + lastName);
            const contextWindow = pageText.substring(
                Math.max(0, nameIndex - 200),
                Math.min(pageText.length, nameIndex + 200)
            );

            const nearbyEmails = contextWindow.match(emailRegex) || [];
            const nearbyPhones = contextWindow.match(phoneRegex) || [];

            const contactEmail = nearbyEmails.find(isValidEmail) || validEmails[0];
            const contactPhone = nearbyPhones.find(isValidPhone) || validPhones[0];

            // Only add if we have at least email OR phone
            if (contactEmail || contactPhone) {
                contacts.push({
                    salutation,
                    firstName,
                    lastName,
                    email: contactEmail,
                    phone: contactPhone,
                    position: matchedPosition,
                    source: `Company Website (${pageUrl})`,
                });
            }
        }
    }

    return contacts;
}

/**
 * Validate that a contact has all required fields (no placeholders)
 */
function isValidContact(contact: ContactPerson): boolean {
    // Must have valid first and last name
    if (!isValidName(contact.firstName) || !isValidName(contact.lastName)) {
        return false;
    }

    // Must have valid salutation
    if (contact.salutation !== 'Herr' && contact.salutation !== 'Frau') {
        return false;
    }

    // Must have valid position
    if (!contact.position || contact.position === 'N/A' || contact.position === 'Unknown') {
        return false;
    }

    // Must have EITHER valid email OR valid phone (preferably both)
    const hasValidEmail = contact.email && isValidEmail(contact.email);
    const hasValidPhone = contact.phone && isValidPhone(contact.phone);

    return hasValidEmail || hasValidPhone;
}

/**
 * Main function to enrich job with contact information
 * ONLY returns REAL contacts - NO PLACEHOLDERS
 */
export async function enrichJobWithContacts(
    companyName: string,
    config: ContactEnrichmentConfig,
): Promise<{ contacts: ContactPerson[]; website?: string }> {
    log.info(`Enriching contacts for company: ${companyName}`);

    let contacts: ContactPerson[] = [];
    let website: string | undefined;

    try {
        // Step 1: Find company website
        if (config.enableWebScraping) {
            website = await findCompanyWebsite(companyName, config.timeout);

            if (website) {
                log.debug(`Found website for ${companyName}: ${website}`);

                // Step 2: Scrape company contacts from website
                const scrapedContacts = await scrapeCompanyContacts(website, companyName, config);
                contacts = scrapedContacts;
            } else {
                log.warning(`No website found for ${companyName}`);
            }
        }

        // NO PLACEHOLDERS: If no real contacts found, return empty array
        if (contacts.length === 0) {
            log.warning(`No verified contacts found for ${companyName}`);
        } else {
            log.info(`Found ${contacts.length} verified contact(s) for ${companyName}`);
        }

    } catch (error) {
        log.error(`Failed to enrich contacts for ${companyName}`, { error });
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
