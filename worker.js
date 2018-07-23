require('dotenv').config()

const puppeteer = require('puppeteer');
const Heroku = require('heroku-client')
const heroku = new Heroku({
    token: process.env.HEROKU_API_TOKEN
})

process
    .on('uncaughtException', function (err) {
        console.log('uncaughtException', err);
        (async () => {
            startBot();
        })();
    }).on("unhandledRejection", (reason, p) => {
        console.log('unhandledRejection', reason, p);
        (async () => {
            startBot();
        })();
    });

const URL = process.env.URL;
//const EMAILS = process.env.EMAILS.split(',');
const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;
const APP = process.env.APP;
let emailIndex = 0;

const restartApp = (seconds) => {
    var count = 0;
    var countdownRestartInterval = setInterval(function (seconds) {
        if (count >= seconds) {
            count = 0;
            heroku.delete(`/apps/${APP}/dynos`).then(app => {})
            clearInterval(countdownRestartInterval);
        } else {
            count++;
        }
    }, 1000, seconds);
}

const countdown = (page, seconds, callback) => {
    var count = 0;
    var countdownInterval = setInterval(function () {
        if (count >= seconds) {
            count = 0;
            clearInterval(countdownInterval);
            callback(page);
        } else {
            count++;
        }
    }, 1000);
}

const gotoURL = async (page, url = null, callback, btn = null, errCallback = null, timeout = 30000, subError = null) => {
    if (btn) {
        console.log(`Waiting for navigation.`)
        await Promise.all([
            page.waitForNavigation({
                waitUntil: "networkidle0",
                timeout: timeout
            }),
            page.click(btn),
        ]).then(
            s => {
                console.log(`Successfully waited for navigation.`);
                callback(page);
            }, e => {
                if (subError) {
                    subError(page, errCallback);
                } else {
                    console.log('Exceeded timeout, retrying to wait for navigation');
                    refreshPage(page, errCallback)
                }
            }
        );
    } else {
        console.log(`Navigating to: ${url}`)
        await page.goto(url, {
            waitUntil: "networkidle0",
            timeout: timeout
        }).then(
            s => {
                console.log(`Successfully navigated to: ${url}`);
                callback(page);
            }, e => {
                console.log('Exceeded timeout, retrying navigation');
                gotoURL(page, url, callback);
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

const checkSelector = async (page, selector, callback, errCallback = null, timeout = 30000) => {
    console.log(`Checking for selector: ${selector}`)
    await page.waitForSelector(selector, {
        timeout: timeout
    }).then(
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

const createHTML = async (page) => {
    let bodyHTML = await page.evaluate(() => document.body.innerHTML);
    var filepath = "test.html";

    fs.writeFile(filepath, bodyHTML, (err) => {
        if (err) throw err;

        console.log("The file was succesfully saved!");
    });
}

const startBot = async () => {

    restartApp(3600 * 3); //Every 3 hours

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

    gotoURL(page, `${URL}`, (page) => {
        console.log('Starting.');
    });
}

(async () => {
    startBot();
})();