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

const w = { waitUntil: 'domcontentloaded', timeout: 60000 }; // Faster navigation with 'domcontentloaded'

async function scrapeTable(page, tableURL, tbl_name) {
    try {
        await page.goto(`${process.env.TAMS_BASE_URL}/filing/${tableURL}`, w); // Navigate to table URL
        await page.waitForSelector(`table#tbl_${tbl_name}`);
    } catch (error) {
        console.error(`Error navigating to ${tableURL}: ${error.message}`);
        return;
    }

    // Split scraping into separate asynchronous tasks
    const tableData = await page.evaluate(async (tbl_name) => {
        const cleanText = (input) => input.replace(/[^\x20-\x7E]/g, '').replace(/[^a-zA-Z0-9\s.,!?():-]/g, '').replace(/\s+/g, ' ').trim();

        const parseDate = (dateStr) => {
            if (dateStr.includes(',')) return moment(dateStr, "YYYY-MM-DD, ddd, h:mm a").toDate().toUTCString();
            if (dateStr.includes('PM') || dateStr.includes('AM')) return moment(dateStr, "YYYY-MM-DD h:mma").toDate().toUTCString();
            return moment(dateStr).toDate().toUTCString();
        };

        const formatDuration = (durationStr) => {
            const sep = ' to ';
            if (durationStr.includes(sep)) return durationStr.split(sep).map(parseDate).join(sep);
            const [hours, minutes] = durationStr.split(':').map(Number);
            const period = hours < 12 ? 'AM' : 'PM';
            return `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${period}`;
        };

        const table = document.querySelector(`table#tbl_${tbl_name}`);
        if (!table) return null;

        const rows = Array.from(table.querySelectorAll('tr'));
        const headers = Array.from(rows.shift().querySelectorAll('th')).map(header => cleanText(header.textContent)).filter(header => header !== 'Action');

        // Function to scrape a chunk of the table
        const scrapeChunk = (startIndex, endIndex) => {
            return rows.slice(startIndex, endIndex).map(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                return headers.reduce((rowData, header, index) => {
                    const cleaned = cleanText(cells[index].textContent);
                    rowData[header] = header.toLowerCase().includes('date') ? parseDate(cleaned) : header.toLowerCase().includes('duration') ? formatDuration(cleaned) : cleaned;
                    return rowData;
                }, {});
            });
        };

        const chunkSize = Math.ceil(rows.length / 3); // Split table into 3 chunks
        const chunks = await Promise.all([
            scrapeChunk(0, chunkSize),
            scrapeChunk(chunkSize, chunkSize * 2),
            scrapeChunk(chunkSize * 2, rows.length)
        ]);

        return chunks.flat(); // Merge chunks into one array
    }, tbl_name);

    if (tableData) {
        const short_name = tbl_name === 'overtime' ? 'ot' : (tbl_name === 'leaves' ? 'lv' : tbl_name);
        const filename = `${short_name}-data.json`;
        fs.writeFileSync(path.resolve(resultsDir, filename), JSON.stringify(tableData, null, 2));
        console.log(`Scraped ${tbl_name} data saved to ${filename}`);
    } else {
        console.error(`${tbl_name} table not found on ${tableURL}`);
    }
}

async function loginAndScrape() {
    const browser = await puppeteer.launch({
        ignoreHTTPSErrors: true,
        devtools: false,
        args: [
          '--headless=new',
          '--disable-infobars',
          '--enable-automation',
          '--start-maximized',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-accelerated-2d-canvas',
          '--no-zygote',
          '--no-first-run',
          '--disable-web-security',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--mute-audio',
          '--incognito',
          '--ignore-certificate-errors',
          '--disable-blink-features=AutomationControlled'
        ]
    })
    
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
    await page.goto(`${process.env.TAMS_BASE_URL}/Auth`, w);
    await page.type('input[name="username"]', process.env.ZEE_USERNAME);
    await page.type('input[name="password"]', process.env.ZEE_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation(w);

    // Open new tabs for each table to be scraped
    const filings = {
        overtime: 'overtime',
        officialbusiness: 'ob',
        leave: 'leaves',
    };

    const pages = await Promise.all(Object.keys(filings).map(() => browser.newPage())); // Create one tab for each filing

    // Start scraping in parallel
    const scrapePromises = Object.entries(filings).map(async ([key, tbl_name], index) => {
        const page = pages[index];
        await scrapeTable(page, key, tbl_name); // Scrape each table in its respective tab
        await page.close(); // Close the tab after scraping
    });

    await Promise.all(scrapePromises); // Wait for all scrape operations to complete

    await browser.close(); // Close the browser
}

loginAndScrape().catch(console.error);