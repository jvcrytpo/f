require('dotenv').config()
const puppeteer = require('puppeteer');

process
    .on('uncaughtException', function (err) {
        console.log('uncaughtException', err);
        process.exit();
    }).on("unhandledRejection", (reason, p) => {
        console.log('unhandledRejection', reason, p);
        process.exit();
    });

const URL = process.env.URL;

const gotoURL = async (page, url = null, callback, errCallback = null, btn = null) => {
    if (btn) {
        console.log(`Waiting for navigation.`)
        await Promise.all([
            page.waitForNavigation({
                waitUntil: "networkidle0"
            }),
            page.click(btn),
        ]).then(
            s => {
                console.log(`Successfully waited for navigation.`);
                callback(page);
            }, e => {
                console.log('Exceeded timeout, retrying to wait for navigation');
                refreshPage(page, errCallback)
            }
        );
    } else {
        console.log(`Navigating to: ${url}`)
        await page.goto(url, {
            waitUntil: "networkidle0"
        }).then(
            s => {
                page.screenshot({ path: "test.png" })
                console.log(`Successfully navigated to: ${url}`);
                callback(page);
            }, e => {
                console.log('Exceeded timeout, retrying navigation');
                gotoURL(page, url, callback, btn);
            }
        );
    }
}

const refreshPage = async (page, callback) => {
    console.log('Reloading page.')
    page.reload({
        waitUntil: "networkidle0"
    }).then(
        s => {
            console.log(`Reloaded page.`);
            callback(page);
        },
        e => {
            console.log(`Timeout exceeded, reloading page again.`)
            refreshPage(page, callback);
        }
    )
}

const checkSelector = async (page, selector, callback, errCallback = null) => {
    console.log(`Checking for selector: ${selector}`)
    await page.waitForSelector(selector).then(
        s => {
            console.log(`Found selector: ${selector}`);
            callback(page);
        },
        e => {
            if (errCallback) {
                console.log(`Could not find selector: ${selector}, moving on.`);
                errCallback(page);
            } else {
                console.log(`Could not find selector: ${selector}, refreshing page.`);
                refreshPage(page, (page) => {
                    checkSelector(page, selector, callback)
                });
            }
        });
};

const startBot = async () => {

    let browser = null;

    if (process.env.ENV === 'production') {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    } else {
        browser = await puppeteer.launch();
    }

    const page = await browser.newPage();

    //I am human
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8'
    });

    //Optimize
    await page.setRequestInterception(true);
    const block_ressources = ['image', 'stylesheet', 'media', 'font', 'texttrack', 'object', 'beacon', 'csp_report', 'imageset'];
    page.on('request', request => {
        if (block_ressources.indexOf(request.resourceType) > 0)
            request.abort();
        else
            request.continue();
    });

    gotoURL(page, URL, (page) => {
        login(page);
    });
}

(async () => {
    startBot();
})();

const login = async (page) => {
    
    checkSelector(page, 'input#login_form_btc_address', async (page) => {
        await page.click('input#login_form_btc_address');
        await page.keyboard.type(process.env.USERNAME);

        await page.click('input#login_form_password');
        await page.keyboard.type(process.env.PASSWORD);

        process.exit();
    });
}