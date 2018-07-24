require('dotenv').config()
const cTable = require('console.table');

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
const APP = process.env.APP;

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

    restartApp(3600);

    if (process.env.ENV === 'production') {
        await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }).then(async browser => {
            setupBrowser(browser);
        });
    } else {
        await puppeteer.launch().then(async browser => {
            setupBrowser(browser);
        });
    }
}

(async () => {
    startBot();
})();

const setupBrowser = async (browser) => {
    const page = await browser.newPage();

    //I am human
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8'
    });

    gotoURL(page, URL, (page) => {
        setInterval(async (page) => {
            const logs = await page.evaluate(() => {
                const Running = document.querySelector('#isRunning').textContent;
                const Throttle = document.querySelector('#Throttle').textContent;
                const Threads = document.querySelector('#Threads').textContent;
                const Hps = document.querySelector('#HPS').textContent;
                const Hashes = document.querySelector('#Hashes').textContent;
                return [{
                    Running,
                    Throttle,
                    Threads,
                    Hps,
                    Hashes
                }];
            })
            console.table(logs);
        }, 30000, page);
    });
}
