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

async function loginAndScrape() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36',
    });

    const w = { waitUntil: 'networkidle0' };

    await page.goto(`${process.env.TAMS_BASE_URL}/Auth`, w);

    // Fill in login form
    await page.type('input[name="username"]', process.env.ZEE_USERNAME);
    await page.type('input[name="password"]', process.env.ZEE_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForNavigation(w);

    // Check if login was successful
    const loginSuccess = await page.$('input[name="employee_id"]');
    if (!loginSuccess) {
        throw new Error('Login failed');
    }

    const tableURLs = {
        overtime: 'overtime',
        officialbusiness: 'ob',
        leave: 'leaves'
    };

    for (const tableURL of Object.keys(tableURLs)) {
        const tbl_name = tableURLs[tableURL];
        // Go to the filing table page
        await page.goto(`${process.env.TAMS_BASE_URL}/filing/${tableURL}`, w);
        
        // Scrape data only if the table exists
        const table = await page.$(`table#tbl_${tbl_name}`);
        if (table) {
            const tableData = await page.evaluate((table) => {
                // Function to clean text inside the browser context
                function cleanText(input) {
                    return input.replace(/[^\x20-\x7E]/g, '') // Remove non-printable characters
                        .replace(/[^a-zA-Z0-9\s.,!?():-]/g, '') // Allow colons and other characters
                        .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
                        .trim(); // Trim leading and trailing spaces
                }

                function parseDate(dateStr) {
                    let resolvedDate;
                    // Handling different formats
                    if (dateStr.includes(',')) {
                        // Format: "2024-08-27, Tue, 9:09 am"
                        resolvedDate = moment(dateStr, "YYYY-MM-DD, ddd, h:mm a").toDate();
                    } else if (dateStr.includes('PM') || dateStr.includes('AM')) {
                        // Format: "2024-08-15 6:00PM" or "2024-08-15 8:00PM"
                        resolvedDate = moment(dateStr, "YYYY-MM-DD h:mma").toDate();
                    } else {
                        // Fallback
                        resolvedDate = moment(dateStr).toDate();
                    }
                    return resolvedDate.toUTCString();
                }

                function formatDuration(durationStr) {
                    const sep = ' to ';
                    if (durationStr.includes(sep)) {
                        // Format: "2024-08-15 6:00PM to 2024-08-15 8:00PM"
                        return durationStr.split(sep).map((dateStr) => parseDate(dateStr)).join(sep);
                    }
                    // Handle cases with or without seconds
                    const parts = durationStr.split(':').map(Number);
                    const hours = parts[0];
                    const minutes = parts[1];

                    // Convert 24-hour format to 12-hour format
                    const formattedHours = hours % 12 || 12; // Convert 24-hour to 12-hour format
                    const formattedMinutes = minutes.toString().padStart(2, '0'); // Ensure two digits
                    const period = hours < 12 ? 'AM' : 'PM'; // Determine AM or PM

                    // Format the result
                    return `${formattedHours}:${formattedMinutes} ${period}`;
                }

                const rows = Array.from(table.querySelectorAll("tr"));

                // Extract headers and clean them
                const headers = Array.from(rows.shift().querySelectorAll("th"))
                    .map(header => cleanText(header.textContent))
                    .filter(header => header !== 'Action'); // Exclude 'Action' column if necessary

                // Map each row's data to corresponding headers
                return rows.map((row) => {
                    const cells = Array.from(row.querySelectorAll("td"));
                    const rowData = {};
                    headers.forEach((header, index) => {
                        const headLower = header.toLowerCase();
                        const cleaned = cleanText(cells[index].textContent);
                        const resolved = headLower.includes('date') ?
                            parseDate(cleaned) : (headLower.includes('duration') ?
                                formatDuration(cleaned) : cleaned);
                        rowData[header] = resolved;
                    });
                    return rowData;
                });
            }, table);
            
            const short_name = tbl_name === 'overtime' ? 'ot' : (tbl_name === 'leaves' ? 'lv' : tbl_name);

            // Save the scraped data to a JSON file
            const filename = `${short_name}-${moment().format('YYYYMMDD-HHmmss')}.json`;
            fs.writeFileSync(path.resolve(resultsDir, filename), JSON.stringify(tableData, null, 2)); // Pretty print JSON
            console.log(`Scraped ${tbl_name} data saved to ${filename}`);
        } else {
            console.error(`${tbl_name} table not found on the page`);
        }
    }

    await browser.close();
}

loginAndScrape().catch(console.error);
