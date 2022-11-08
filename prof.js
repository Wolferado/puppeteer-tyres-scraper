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

    await getSlots(page, browser); // Get slots on the page
}

// Function to get all tyres that are currently on the page
const getSlots = async (page, browser) => {
    let slots;
    await page.waitForSelector("article"); // Wait for "article" tag to appear on the page
    slots = await page.$$("article"); // Get all slots on the current page
    openDetails(page, slots, browser); 
}

// Function to open Details of the tyre
const openDetails = async (page, slots, browser) => {
    for(let i = 0; i < slots.length; i++) {
        let detailsBtn = await slots[i].$(".ecl-button--primary.pull-right.ecl-button"); // Get a "Details" button to click on
        await detailsBtn.evaluate(btn => btn.click()); // Call "Click" function

        await pushSlotDataToScraper(page); // Push data from slot

        page.goBack();
        await page.waitForSelector("article"); // Wait for "article" tag to appear on the page
        slots = await page.$$("article"); // Update the configuration of the slots
    }

    if(await goToNextPage(page) === true) { // If it is possible to go to next page, do it and return true
        await getSlots(page, browser); // Repeat process
    }
    else {
        browser.close(); // Otherwise - close the browser
    }
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
    let label = await page.$eval("img[alt='Label']", el => el.src); // Get label source link

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
    //await page.waitForNavigation();
    //await page.waitForSelector(".ecl-pagination__list");
    let nextPageBtn = await page.$(".ecl-pagination__link.ecl-link.ecl-link--standalone.ecl-link--icon.ecl-link--icon-after.ng-star-inserted"); // Get "Next" button

    if(nextPageBtn) { // If it exists
        await nextPageBtn.evaluate(btn => btn.click()); // Click on it
        return true; // And return true
    }
    else { // Otherwise return false
        return false;
    }
}

const writeToFile = (file, content) => {
    var logStream = fs.createWriteStream(file, {flags: 'a'}); // Create write stream for easy IO operation
    // use {flags: 'a'} to append and {flags: 'w'} to erase and write a new file
    if(!fs.existsSync('./' + file)) { // If file doesn't exist
        logStream.write(csvHeader); // Add header
        logStream.write(content); // And write content
    }
    else { // If file exists
        logStream.write(content); // Append records
    }
}

main();

// Other implemantations
/*const pushSlotDataToScraper = async (page) => {
    await page.waitForSelector(".ecl-u-type-l.ecl-u-type-color-grey-75.ecl-u-type-family-alt");
    let content = "";

    let title = await page.$eval(".ecl-u-type-l.ecl-u-type-color-grey-75.ecl-u-type-family-alt span", el => el.textContent); // Get title of the slot
    let description = await page.$eval(".ecl-u-d-inline-block.ecl-u-type-2xl.ecl-u-type-bold.ecl-u-type-color-blue.ecl-u-type-family-alt.ecl-u-mt-xs span", el => el.textContent); // Get description (ID) of the slot
    content += title + " " + description + "\n";

    let infoLabels = await page.$$(".ecl-u-flex-grow-1.ecl-u-border-lg-bottom.ecl-u-border-style-lg-dotted.ecl-u-border-color-lg-grey-15");
    let infoValues = await page.$$(".ecl-u-type-bold.ecl-u-pl-lg-xl.ecl-u-pr-2xs.text-right");
    let dbValue = await page.$$(".ecl-u-type-bold.ecl-u-pr-2xs.text-right.ng-star-inserted");
    let eightInfoValue = await page.$eval(".ecl-u-type-bold.ecl-u-pr-2xs.text-right.ecl-u-pl-lg-xl.ng-star-inserted", el => el.textContent) + "/" + await dbValue[1].evaluate(el => el.textContent);
    for(let i = 0; i < infoLabels.length; i++) {
        content += await infoLabels[i].evaluate(el => el.textContent) + " ";
        if(i == 7) {
            content += eightInfoValue + "\n";
            continue;
        }
        content += await infoValues[i].evaluate(el => el.textContent) + "\n";
    } 

    content += "\n";

    writeToFile("output.txt", content);
}*/

/*const goToNextPage = async (page) => {
    let pages = await page.$$(".ecl-pagination__link.ecl-link.ecl-link--standalone.ng-star-inserted");

    for(let i = 0; i < pages.length; i++) {
        let selectedPageIndex = await page.$eval(".ecl-pagination__text.ecl-pagination__text--summary.ng-star-inserted", el => el.textContent);
        let pageToCompareIndex = await page.evaluate(el => el.textContent, pages[i]);

        if(pageToCompareIndex > selectedPageIndex) {
            console.log(selectedPageIndex + " > " + pageToCompareIndex);
            await pages[i].evaluate(link => link.click());
            await page.waitForNavigation();
            await page.waitForSelector(".ecl-pagination__link.ecl-link.ecl-link--standalone.ng-star-inserted");
            pages = await page.$$(".ecl-pagination__link.ecl-link.ecl-link--standalone.ng-star-inserted");
            break;
        }
    }
}*/

/*const goToNextPage = async (page) => {
    await page.waitForNavigation();
    await page.waitForSelector(".ecl-pagination__link.ecl-link.ecl-link--standalone.ecl-link--icon.ecl-link--icon-after.ng-star-inserted");
    let navBtn = await page.$$(".ecl-pagination__item ecl-pagination__item--next.ng-star-inserted a");
    //console.log(navBtnText); 

    console.log(navBtn.length);

    if(navBtn.length > 1) {
        for(let i = 0; i < navBtn.length; i++) {
            let navBtnText = await navBtn[i].evaluate(el => el.textContent);
            navBtnText = navBtnText.trim();

            if(navBtnText === "Next") {
                console.log(await navBtn[i].evaluate(link => link.tagName))
                await navBtn[i].evaluate(link => link.click());
                return true;
            }
        }
    }
    else if(navBtn.length == 1) {
        let navBtnText = await navBtn[0].evaluate(el => el.textContent);
        navBtnText = navBtnText.trim();

        if(navBtnText === "Next") {
            console.log(await navBtn[0].evaluate(link => link.tagName))
            await navBtn[0].evaluate(link => link.click());
            return true;
        }
        else {
            return false;
        }
    }
    
}*/