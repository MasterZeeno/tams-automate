const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const moment = require('moment');
const dotenv = require('dotenv');
dotenv.config();

// Ensure the results directory exists
const resultsDir = path.resolve(__dirname, 'results');
if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
}

// Navigation and timeout configuration
const w = { waitUntil: 'domcontentloaded', timeout: 30000 }; // Reduced timeout for faster operation

// Function to scrape the table data
async function scrapeTable(page, tableURL, tbl_name) {
    const baseURL = process.env.TAMS_BASE_URL || 'https://hcc-tams.com.ph/tams';
    const siteURL = tableURL === 'attendance' ? `${baseURL}/${tableURL}` : `${baseURL}/filing/${tableURL}`;
    
    try {
        await page.goto(siteURL, w); // Navigate to table URL
        await page.waitForSelector('table', { timeout: 15000 }); // Reduced timeout for selector
    } catch (error) {
        console.error(`Error navigating to ${siteURL}: ${error.message}`);
        return;
    }

    // Scraping logic
    try {
        const tableData = await page.evaluate((tbl_name) => {
            const cleanText = (input) => input.replace(/[^\x20-\x7E]/g, '') // Remove non-printable characters
                .replace(/[^a-zA-Z0-9\s.,!?():-]/g, '') // Retain alphanumeric and common punctuation
                .replace(/\s+/g, ' ').trim(); // Collapse and trim spaces

            const parseDate = (dateStr) => moment(dateStr).isValid() ? moment(dateStr).toDate().toUTCString() : dateStr;
            const formatDuration = (durationStr) => {
                const [start, end] = durationStr.split(' to ');
                return `${moment(start).format('h:mm A')} to ${moment(end).format('h:mm A')}`;
            };

            const table = document.querySelector('table');
            if (!table) return null;

            const headers = Array.from(table.querySelectorAll('th'))
                .map(header => cleanText(header.textContent).replace(/\s+/g, '_').toLowerCase())
                .filter(header => header !== 'action');

            return Array.from(table.querySelectorAll('tr')).slice(1).map(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                return headers.reduce((rowData, header, index) => {
                    const cleaned = cleanText(cells[index]?.textContent || ''); // Safely handle empty cells
                    rowData[header] = header.includes('date') ? parseDate(cleaned) :
                        header.includes('duration') ? formatDuration(cleaned) : cleaned;
                    return rowData;
                }, {});
            });
        }, tbl_name);

        if (tableData) {
            const filename = `${tableURL}-data.json`;
            fs.writeFileSync(path.resolve(resultsDir, filename), JSON.stringify(tableData, null, 2));
            console.log(`Scraped ${tbl_name} data saved to ${filename}`);
        } else {
            console.error(`No data found in ${tbl_name} table at ${siteURL}`);
        }
    } catch (error) {
        console.error(`Error scraping table ${tbl_name}: ${error.message}`);
    }
}

// Main function to log in and scrape
async function loginAndScrape() {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome-stable',
        headless: 'new',
        devtools: false,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    const context = browser.defaultBrowserContext();

    try {
        // Override geolocation and timezone
        await context.overridePermissions(process.env.HCC_BASE_URL || 'https://hcc-tams.com.ph', ['geolocation']);
        await page.setGeolocation({ latitude: 14.5995, longitude: 120.9842, accuracy: 100 });
        await page.emulateTimezone('Asia/Manila');

        // Set custom User-Agent
        await page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36',
        });

        // Navigate to login page
        const loginURL = `${process.env.TAMS_BASE_URL}/Auth`;
        await page.goto(loginURL, { timeout: 6000 });

        // Perform login
        await page.type('input[name="username"]', process.env.ZEE_USERNAME || '15913');
        await page.type('input[name="password"]', process.env.ZEE_PASSWORD || '546609529');
        await page.click('button[type="submit"]');
        await page.waitForNavigation(w);

        // Define filings
        const filings = {
            attendance: 'attendance',
            overtime: 'overtime',
            officialbusiness: 'ob',
            leave: 'leaves'
        };

        // Scrape all tables
        for (const [key, tbl_name] of Object.entries(filings)) {
            await scrapeTable(page, key, tbl_name); // Scrape each table in sequence
        }
    } catch (error) {
        console.error(`Error during login and scraping: ${error.message}`);
    } finally {
        await browser.close(); // Ensure the browser is closed
    }
}

// Start the scraping process
loginAndScrape().catch(console.error);