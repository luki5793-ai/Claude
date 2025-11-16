/**
 * Recruitment Agency Detection Module
 * Identifies and filters out jobs from recruitment agencies, headhunters, and temp agencies
 */

import { log } from 'apify';

/**
 * Known recruitment agency keywords (German)
 */
const RECRUITMENT_KEYWORDS = [
    // General terms
    'personalvermittlung',
    'personalberatung',
    'personaldienstleist',
    'headhunter',
    'zeitarbeit',
    'arbeitnehmerüberlassung',
    'leiharbeit',
    'vermittlung',
    'recruiting',
    'staffing',
    'talentschmiede',
    'jobvermittlung',
    'executive search',
    'talent acquisition',
    'recruitment service',
    'outsourcing',
    'contractor',
    'freelance vermittlung',

    // Common phrases indicating agency work
    'im auftrag',
    'für unseren kunden',
    'für einen kunden',
    'für unsere mandanten',
    'für einen mandanten',
    'im auftrag unseres kunden',
    'namhaftes unternehmen',
    'bekanntes unternehmen',
    'anonymisiert',
    'vertraulich',
    'diskretion',
    'unser kunde',
    'unser mandant',
    'beim kunden vor ort',
    'direktvermittlung',
    'fremdpersonal',
    'arbeitnehmerverleih',

    // Legal forms
    'arbeitnehmerüberlassungserlaubnis',
    'anü erlaubnis',
];

/**
 * Known recruitment agency company names
 */
const RECRUITMENT_AGENCIES = [
    // Large international agencies
    'randstad',
    'adecco',
    'manpower',
    'hays',
    'kelly services',
    'robert half',
    'michael page',
    'amadeus fire',
    'robert walters',
    'page personnel',
    'kienbaum',
    'Page Group',
    'Morgan Philips',
    'Alexander Mann Solutions',

    // German agencies
    'orizon',
    'avantgarde experts',
    'gulp',
    'brunel',
    'ferchau',
    'bertrandt',
    'experts',
    'gulp information services',
    'delphi hr',
    'consult',
    'k&k personalberatung',
    'quantum',
    'aviation',
    'I.K. Hofmann',
    'DIS AG',
    'START NRW',
    'Hofmann Personal',
    'Trenkwalder',
    'PERMACON',
    'Progressive Recruitment',
    'Huxley',
    'Computer Futures',
    'Frank Recruitment Group',
    'EPOS',
    'ARTS',
    'SOLCOM',
    'TARUK',
    'HAYS',

    // Common patterns
    'headhunting',
    'executive search',
    'talent solutions',
    'recruitment gmbh',
    'personal gmbh',
    'zeitarbeit gmbh',
    'personalberatung gmbh',
    'personalvermittlung gmbh',
    'staffing',
    'recruiting',
    'hr-consulting',
    'personalservice',
];

/**
 * Result of recruitment agency detection
 */
export interface RecruitmentDetectionResult {
    isRecruitmentAgency: boolean;
    reason?: string;
    matchedKeywords?: string[];
}

/**
 * Detect if a job posting is from a recruitment agency
 */
export function detectRecruitmentAgency(
    company: string,
    description: string,
    jobUrl: string = '',
): RecruitmentDetectionResult {
    const combined = `${company} ${description} ${jobUrl}`.toLowerCase();
    const matchedKeywords: string[] = [];

    // Check company name against known agencies
    const companyLower = company.toLowerCase();
    for (const agency of RECRUITMENT_AGENCIES) {
        if (companyLower.includes(agency)) {
            matchedKeywords.push(agency);
            log.debug(`Recruitment agency detected: ${company} matches ${agency}`);
            return {
                isRecruitmentAgency: true,
                reason: `Company name matches known recruitment agency: ${agency}`,
                matchedKeywords,
            };
        }
    }

    // Check for recruitment keywords in combined text
    for (const keyword of RECRUITMENT_KEYWORDS) {
        if (combined.includes(keyword)) {
            matchedKeywords.push(keyword);
        }
    }

    // If multiple keywords found, likely a recruitment agency
    if (matchedKeywords.length >= 2) {
        log.debug(`Recruitment agency detected: ${company} has keywords: ${matchedKeywords.join(', ')}`);
        return {
            isRecruitmentAgency: true,
            reason: `Multiple recruitment keywords found: ${matchedKeywords.slice(0, 3).join(', ')}`,
            matchedKeywords,
        };
    }

    // Check for specific patterns
    if (combined.includes('für unseren kunden') || combined.includes('im auftrag unseres kunden')) {
        log.debug(`Recruitment agency detected: ${company} uses client language`);
        return {
            isRecruitmentAgency: true,
            reason: 'Job posting indicates placement for a client',
            matchedKeywords: ['client placement pattern'],
        };
    }

    // Not detected as recruitment agency
    return {
        isRecruitmentAgency: false,
    };
}

/**
 * Extract postal code from location string
 * German postal codes are 5 digits
 */
export function extractPostalCode(location: string): string | undefined {
    // Try to find 5-digit postal code
    const plzMatch = location.match(/\b(\d{5})\b/);
    if (plzMatch) {
        return plzMatch[1];
    }

    // Try to find postal code in format "PLZ City" or "City (PLZ)"
    const plzCityMatch = location.match(/(?:^|[\s,])(\d{5})[\s,]/);
    if (plzCityMatch) {
        return plzCityMatch[1];
    }

    return undefined;
}

/**
 * Check if postal code matches filter criteria
 */
export function matchesPostalCodeFilter(postalCode: string | undefined, filter: string[]): boolean {
    if (!postalCode || filter.length === 0) {
        return true; // No filter or no postal code, include by default
    }

    // Check if postal code starts with any of the filter prefixes
    return filter.some(prefix => postalCode.startsWith(prefix));
}

/**
 * Get city name for postal code (common Köln/Bonn region codes)
 */
export const POSTAL_CODE_CITIES: Record<string, string> = {
    // Köln region
    '50667': 'Köln',
    '50668': 'Köln',
    '50670': 'Köln',
    '50672': 'Köln',
    '50674': 'Köln',
    '50676': 'Köln',
    '50678': 'Köln',
    '50679': 'Köln',

    // Bonn region
    '53111': 'Bonn',
    '53113': 'Bonn',
    '53115': 'Bonn',
    '53117': 'Bonn',
    '53119': 'Bonn',
    '53121': 'Bonn',
    '53123': 'Bonn',
    '53125': 'Bonn',
    '53127': 'Bonn',

    // Extended region (5xxxx)
    '51': 'Region Köln',
    '52': 'Region Aachen',
    '53': 'Region Bonn',
    '54': 'Region Koblenz',
    '55': 'Region Mainz',
    '56': 'Region Koblenz',
    '57': 'Region Siegen',
    '58': 'Region Hagen',
    '59': 'Region Arnsberg',
};
