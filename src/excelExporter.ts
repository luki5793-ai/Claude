/**
 * Excel Export Module
 * Exports scraped job data to Excel/CSV format with required columns
 */

import { log } from 'apify';
import * as XLSX from 'xlsx';
import type { ScrapedJob } from './types.js';

/**
 * Excel row structure matching requirements
 */
export interface ExcelRow {
    'Job-Titel': string;
    'Unternehmen': string;
    'Standort': string;
    'PLZ': string;
    'Anrede IT-Leiter/Personalentscheider 1': string;
    'Vorname IT-Leiter/Personalentscheider 1': string;
    'Nachname IT-Leiter/Personalentscheider 1': string;
    'Email IT-Leiter/Personalentscheider 1': string;
    'Telefon IT-Leiter/Personalentscheider 1': string;
    'Position IT-Leiter/Personalentscheider 1': string;
    'Anrede IT-Leiter/Personalentscheider 2': string;
    'Vorname IT-Leiter/Personalentscheider 2': string;
    'Nachname IT-Leiter/Personalentscheider 2': string;
    'Email IT-Leiter/Personalentscheider 2': string;
    'Telefon IT-Leiter/Personalentscheider 2': string;
    'Position IT-Leiter/Personalentscheider 2': string;
    'Job-URL': string;
    'Firmenwebsite': string;
    'Quelle': string;
    'Arbeitszeit': string;
    'Erfahrungslevel': string;
    'Gehalt Min': string;
    'Gehalt Max': string;
    'Veröffentlicht am': string;
    'Gescraped am': string;
}

/**
 * Convert scraped jobs to Excel rows
 */
export function convertJobsToExcelRows(jobs: ScrapedJob[]): ExcelRow[] {
    const rows: ExcelRow[] = [];

    for (const job of jobs) {
        // Get first two contacts
        const contact1 = job.contacts?.[0];
        const contact2 = job.contacts?.[1];

        const row: ExcelRow = {
            'Job-Titel': job.title || 'N/A',
            'Unternehmen': job.company || 'N/A',
            'Standort': job.location || 'N/A',
            'PLZ': job.postalCode || 'N/A',

            // Contact 1
            'Anrede IT-Leiter/Personalentscheider 1': contact1?.salutation || 'N/A',
            'Vorname IT-Leiter/Personalentscheider 1': contact1?.firstName || 'N/A',
            'Nachname IT-Leiter/Personalentscheider 1': contact1?.lastName || 'N/A',
            'Email IT-Leiter/Personalentscheider 1': contact1?.email || 'N/A',
            'Telefon IT-Leiter/Personalentscheider 1': contact1?.phone || 'N/A',
            'Position IT-Leiter/Personalentscheider 1': contact1?.position || 'N/A',

            // Contact 2
            'Anrede IT-Leiter/Personalentscheider 2': contact2?.salutation || 'N/A',
            'Vorname IT-Leiter/Personalentscheider 2': contact2?.firstName || 'N/A',
            'Nachname IT-Leiter/Personalentscheider 2': contact2?.lastName || 'N/A',
            'Email IT-Leiter/Personalentscheider 2': contact2?.email || 'N/A',
            'Telefon IT-Leiter/Personalentscheider 2': contact2?.phone || 'N/A',
            'Position IT-Leiter/Personalentscheider 2': contact2?.position || 'N/A',

            // Additional info
            'Job-URL': job.jobUrl || 'N/A',
            'Firmenwebsite': job.companyWebsite || 'N/A',
            'Quelle': job.portal || 'N/A',
            'Arbeitszeit': job.workType || 'N/A',
            'Erfahrungslevel': job.experienceLevel || 'N/A',
            'Gehalt Min': job.salary?.min?.toString() || 'N/A',
            'Gehalt Max': job.salary?.max?.toString() || 'N/A',
            'Veröffentlicht am': job.publishedDate ? new Date(job.publishedDate).toLocaleDateString('de-DE') : 'N/A',
            'Gescraped am': job.scrapedAt ? new Date(job.scrapedAt).toLocaleDateString('de-DE') : 'N/A',
        };

        rows.push(row);
    }

    log.info(`Converted ${rows.length} jobs to Excel rows`);
    return rows;
}

/**
 * Create Excel workbook from jobs
 */
export function createExcelWorkbook(jobs: ScrapedJob[]): XLSX.WorkBook {
    const rows = convertJobsToExcelRows(jobs);
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Set column widths for better readability
    const columnWidths = [
        { wch: 40 }, // Job-Titel
        { wch: 30 }, // Unternehmen
        { wch: 25 }, // Standort
        { wch: 8 },  // PLZ
        { wch: 10 }, // Anrede 1
        { wch: 15 }, // Vorname 1
        { wch: 15 }, // Nachname 1
        { wch: 30 }, // Email 1
        { wch: 20 }, // Telefon 1
        { wch: 25 }, // Position 1
        { wch: 10 }, // Anrede 2
        { wch: 15 }, // Vorname 2
        { wch: 15 }, // Nachname 2
        { wch: 30 }, // Email 2
        { wch: 20 }, // Telefon 2
        { wch: 25 }, // Position 2
        { wch: 50 }, // Job-URL
        { wch: 40 }, // Firmenwebsite
        { wch: 15 }, // Quelle
        { wch: 15 }, // Arbeitszeit
        { wch: 15 }, // Erfahrungslevel
        { wch: 12 }, // Gehalt Min
        { wch: 12 }, // Gehalt Max
        { wch: 15 }, // Veröffentlicht am
        { wch: 15 }, // Gescraped am
    ];

    worksheet['!cols'] = columnWidths;

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IT Jobs');

    log.info('Created Excel workbook');
    return workbook;
}

/**
 * Export jobs to Excel file (buffer)
 */
export function exportToExcel(jobs: ScrapedJob[]): Buffer {
    const workbook = createExcelWorkbook(jobs);
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    log.info(`Exported ${jobs.length} jobs to Excel buffer`);
    return buffer;
}

/**
 * Export jobs to CSV (buffer)
 */
export function exportToCSV(jobs: ScrapedJob[]): Buffer {
    const rows = convertJobsToExcelRows(jobs);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' }); // German CSV format uses semicolon
    const buffer = Buffer.from(csv, 'utf-8');
    log.info(`Exported ${jobs.length} jobs to CSV buffer`);
    return buffer;
}

/**
 * Create summary statistics for the export
 */
export interface ExportSummary {
    totalJobs: number;
    jobsWithContacts: number;
    jobsWithoutContacts: number;
    jobsWithFullContacts: number; // Both contacts filled
    companiesCount: number;
    portalsDistribution: Record<string, number>;
    postalCodesDistribution: Record<string, number>;
    avgContactsPerJob: number;
}

/**
 * Generate export summary statistics
 */
export function generateExportSummary(jobs: ScrapedJob[]): ExportSummary {
    const companies = new Set<string>();
    const portals: Record<string, number> = {};
    const postalCodes: Record<string, number> = {};
    let jobsWithContacts = 0;
    let jobsWithFullContacts = 0;
    let totalContacts = 0;

    for (const job of jobs) {
        companies.add(job.company);

        // Count portals
        portals[job.portal] = (portals[job.portal] || 0) + 1;

        // Count postal codes
        if (job.postalCode) {
            const prefix = job.postalCode.substring(0, 2);
            postalCodes[prefix] = (postalCodes[prefix] || 0) + 1;
        }

        // Count contacts
        if (job.contacts && job.contacts.length > 0) {
            jobsWithContacts++;
            totalContacts += job.contacts.length;

            if (job.contacts.length >= 2) {
                jobsWithFullContacts++;
            }
        }
    }

    const summary: ExportSummary = {
        totalJobs: jobs.length,
        jobsWithContacts,
        jobsWithoutContacts: jobs.length - jobsWithContacts,
        jobsWithFullContacts,
        companiesCount: companies.size,
        portalsDistribution: portals,
        postalCodesDistribution: postalCodes,
        avgContactsPerJob: jobs.length > 0 ? totalContacts / jobs.length : 0,
    };

    log.info('Generated export summary', summary);
    return summary;
}
