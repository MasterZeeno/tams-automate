const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
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
    const siteURL = tableURL === 'attendance' ? `${process.env.TAMS_BASE_URL}/${tableURL}` : `${process.env.TAMS_BASE_URL}/filing/${tableURL}`;
    try {
        await page.goto(siteURL, w); // Navigate to table URL
        await page.waitForSelector('table', { timeout: 15000 }); // Reduced timeout for selector
    } catch (error) {
        console.error(`Error navigating to ${tableURL}: ${error.message}`);
        return;
    }

    // Scraping logic
    const tableData = await page.evaluate((tbl_name) => {
        const cleanText = (input) => input.replace(/[^\x20-\x7E]/g, '').replace(/[^a-zA-Z0-9\s.,!?():-]/g, '').replace(/\s+/g, ' ').trim();
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
                const cleaned = cleanText(cells[index].textContent);
                rowData[header] = header.toLowerCase().includes('date') ? parseDate(cleaned) :
                    header.toLowerCase().includes('duration') ? formatDuration(cleaned) : cleaned;
                return rowData;
            }, {});
        });
    }, tbl_name);

    if (tableData) {
        const filename = `${tableURL}-data.json`;
        fs.writeFileSync(path.resolve(resultsDir, filename), JSON.stringify(tableData, null, 2));
        console.log(`Scraped ${tbl_name} data saved to ${filename}`);
        return;
    }
    console.error(`${tbl_name} table not found on ${tableURL}`);
}

// Main function to log in and scrape
async function loginAndScrape() {
    const browser = await puppeteer.launch({
        headless: 'new',
        devtools: false,
        args: [
            '--no-sandbox',
            '--disable-dev-shm-usage'
        ]
    });

    const page = await browser.newPage();
    const context = browser.defaultBrowserContext();

    await context.overridePermissions(process.env.HCC_BASE_URL, ['geolocation']);
    await page.setGeolocation({
        latitude: 14.5995,
        longitude: 120.9842,
        accuracy: 100
    });
    await page.emulateTimezone('Asia/Manila');
    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36',
    });

    // Login
    try {
        // Try to navigate to the page with the specified timeout
        await page.goto(`${process.env.TAMS_BASE_URL}/Auth`, { timeout: 6000 }); // Timeout set to 5 seconds
    } catch (error) {
        if (error instanceof puppeteer.errors.TimeoutError) {
            // Take a screenshot upon timeout
            await page.screenshot({ path: `${resultsDir}/timeout-screenshot.png`, fullPage: true });
        } else {
            console.log('An error occurred:', error);
        }
    }
    
    await page.type('input[name="username"]', process.env.ZEE_USERNAME);
    await page.type('input[name="password"]', process.env.ZEE_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation(w);

    // Filings object
    const filings = {
        attendance: 'attendance',
        overtime: 'overtime',
        officialbusiness: 'ob',
        leave: 'leaves',
    };

    // Scrape all tables in sequence on the same page
    for (const [key, tbl_name] of Object.entries(filings)) {
        await scrapeTable(page, key, tbl_name); // Scrape each table in sequence
    }

    await browser.close(); // Close the browser
}

// Start the scraping process
loginAndScrape().catch(console.error);