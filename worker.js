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
const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;
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

const gotoURL = async (page, url = null, callback, btn = null, errCallback = null) => {
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
        login(page);
    });
}

(async () => {
    startBot();
})();

const login = async (page) => {
    checkSelector(page, 'section.top-bar-section ul li.login_menu_button a', async (page) => {
        await page.click('section.top-bar-section ul li.login_menu_button a');

        await page.click('input#login_form_btc_address');
        await page.keyboard.type(USERNAME);

        await page.click('input#login_form_password');
        await page.keyboard.type(PASSWORD);

        gotoURL(page, null, (page) => {
            homePage(page);
        }, '#login_button', (page) => {
            if (page.$('.reward_point_redeem_result_error') !== null) {
                console.log('Too many tries logging in, wait 10 minutes.');
                countdown(page, 600, (page) => {
                    refreshPage(page, (page) => {
                        login(page);
                    });
                })
            } else {
                login(page);
            }
        });
    })
}

const getBalance = async (page) => {
    const balance = await page.evaluate(() => {
        const text = document.querySelector('#balance').textContent;
        return text;
    })
    console.log(`Balance: ${balance}`);
}

const homePage = async (page) => {
    checkSelector(page, '#play_without_captchas_button', async (page) => {
        getBalance(page);
        await page.click('#play_without_captchas_button');
        await page.click('#free_play_form_button');
        await page.waitFor(3000);
        console.log('Rolled...')
        getBalance(page);
        console.log('Waiting 1 hour...');
        countdown(page, 3600, (page) => {
            refreshPage(page, (page) => {
                homePage(page);
            })
        })
    }, async (page) => {
        checkSelector(page, '#time_remaining', async (page) => {
            const timeMinText = await page.evaluate(() => {
                const text = document.querySelector('#time_remaining .countdown_row .countdown_section:first-of-type .countdown_amount').textContent;
                return text;
            })
            let timeNum = Number(timeMinText) * 60;

            if (timeNum === 0) {
                const timeSecText = await page.evaluate(() => {
                    const text = document.querySelector('#time_remaining .countdown_row .countdown_section:last-of-type .countdown_amount').textContent;
                    return text;
                })
                timeNum = Number(timeSecText);
            }

            console.log(`Timer still active, ${timeNum} seconds left.`);

            countdown(page, timeNum, (page) => {
                refreshPage(page, (page) => {
                    homePage(page);
                });
            })
        })
    })
}