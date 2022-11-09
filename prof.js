const puppeteer = require('puppeteer');
const fs = require('fs');
const csvHeader = 'Title,Number,Commercial name or trade designation,Tyre size designation,Tyre class,Load-capacity index,Speed category symbol,Fuel efficiency class,Wet grip class,External rolling noise class and level,Tyre for use in severe snow conditions,Tyre for use in severe ice conditions,Load version,Additional information, Label URL\n';
const minimal_args = [ // Used for faster process
    '--autoplay-policy=user-gesture-required',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-dev-shm-usage',
    '--disable-domain-reliability',
    '--disable-extensions',
    '--disable-features=AudioServiceOutOfProcess',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-notifications',
    '--disable-offer-store-unmasked-wallet-cards',
    '--disable-popup-blocking',
    '--disable-print-preview',
    '--disable-prompt-on-repost',
    '--disable-renderer-backgrounding',
    '--disable-setuid-sandbox',
    '--disable-speech-api',
    '--disable-sync',
    '--hide-scrollbars',
    '--ignore-gpu-blacklist',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check',
    '--no-first-run',
    '--no-pings',
    '--no-sandbox',
    '--no-zygote',
    '--password-store=basic',
    '--use-gl=swiftshader',
    '--use-mock-keychain',
  ];

const mainUrl = "https://eprel.ec.europa.eu/screen/product/tyres";

const main = async () => {
    let browser = await puppeteer.launch({headless: false, args: minimal_args}); // Launch a browser
    let page = await browser.newPage(); // Add a page
    await page.goto(mainUrl); // Go to URL

    await scrapTyresData(page, browser); // Get slots on the page
}

// Function to scrap data of tyres
const scrapTyresData = async (page, browser) => {
    let slots;
    let detailsBtn;

    while(true) { // Keep going while you are able to visit next page
        await page.waitForSelector("article"); // Wait for "article" tag to appear on the page
        slots = await page.$$("article"); // Get slots from the page

        for(let i = 0; i < slots.length; i++) {
            detailsBtn = await slots[i].$(".ecl-button--primary.pull-right.ecl-button"); // Get a "Details" button to click on
            await detailsBtn.evaluate(btn => btn.click()); // Call "Click" function
    
            await pushSlotDataToScraper(page); // Push data from slot
    
            page.goBack(); // Go back to the tyre list

            await page.waitForSelector("article"); // Wait for "article" tag (tyres slots) to appear on the page
            slots = await page.$$("article"); // Update the configuration of the slots
        }
    
        if(await goToNextPage(page) !== true) { // If there are no pages left to go to, break from the loop
            break;
        }
    }

    browser.close(); // Close the browser
}

// Function to record tyre data to .csv file
const pushSlotDataToScraper = async (page) => {
    await page.waitForSelector(".ecl-u-type-l.ecl-u-type-color-grey-75.ecl-u-type-family-alt"); // Wait for details to appear
    let content = ""; // Variable to store information

    let title = await page.$eval(".ecl-u-type-l.ecl-u-type-color-grey-75.ecl-u-type-family-alt span", el => el.textContent); // Get title of the slot
    let number = await page.$eval(".ecl-u-d-inline-block.ecl-u-type-2xl.ecl-u-type-bold.ecl-u-type-color-blue.ecl-u-type-family-alt.ecl-u-mt-xs span", el => el.textContent); // Get description (ID) of the slot
    content += title + "," + number + ",";
    let infoValues = await page.$$(".ecl-u-type-bold.ecl-u-pl-lg-xl.ecl-u-pr-2xs.text-right"); // Get all info values
    let dbValue = await page.$$(".ecl-u-type-bold.ecl-u-pr-2xs.text-right.ng-star-inserted"); // Get dB value (being separate from all info values)
    let eightInfoValue = await page.$eval(".ecl-u-type-bold.ecl-u-pr-2xs.text-right.ecl-u-pl-lg-xl.ng-star-inserted", el => el.textContent) + "/" + await dbValue[1].evaluate(el => el.textContent); // Combine 8th info value with dB value
    
    //page.waitForSelector("img[alt='Label']", {visible: true});
    //let label = await page.$eval("img[alt='Label']", el => el.src); // Get label source link
    let label = "https://eprel.ec.europa.eu/label/Label_" + page.url().substring(48) + ".svg";

    for(let i = 0; i < infoValues.length; i++) {
        if(i == 7) {
            content += eightInfoValue + ",";
            continue;
        }

        content += await infoValues[i].evaluate(el => el.textContent) + ",";
    } 

    content += label + "\n";

    writeToFile("output.csv", content); // Write to file
}

// Function to switch to the next page
const goToNextPage = async (page) => {
    let nextPageBtns = await page.$$(".ecl-pagination__link.ecl-link.ecl-link--standalone.ecl-link--icon.ecl-link--icon-after.ng-star-inserted"); // Get navigation buttons

    if(nextPageBtns.length == 2) { // If there are 2 buttons
        await nextPageBtns[1].evaluate(btn => btn.click()); // Click on the second one, what is "Next", and return true
        return true;
    }
    else { // If there is only one button, check their text
        if(await nextPageBtns[0].evaluate(btn => btn.textContent) === " Previous ") { // If it is "Previous", return false
            return false;
        }
        else { // If it is "Next", click on the button and return true
            await nextPageBtns[0].evaluate(btn => btn.click()); 
            return true;
        }
    }
}

const writeToFile = (file, content) => {
    var logStream = fs.createWriteStream(file, {flags: 'a'}); // Create write stream for easy IO operation
    // use {flags: 'a'} to append and {flags: 'w'} to erase and write a new file
    if(!fs.existsSync('./' + file)) { // If file doesn't exist
        logStream.write(csvHeader); // Add header
        logStream.write(content); // And append record
    }
    else { // If file exists
        logStream.write(content); // Append records
    }
}

main();