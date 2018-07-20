require('dotenv').config()
//var random_name = require('node-random-name');
var authenticator = require('authenticator');
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
//const URL_G = process.env.URL_G;
const SERVICE = process.env.SERVICE;
//const EMAILS = process.env.EMAILS.split(',');
const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;
//const G_PASSWORD = process.env.G_PASSWORD;
const APP = process.env.APP;
const KEY = process.env.KEY;
//const REFERRAL = process.env.REFERRAL;
//let emailIndex = 0;

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
                timeout
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
            timeout
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
        timeout
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

    switch (SERVICE) {
        case 'g':
            /*gotoURL(page, `${URL_G}#.7518-header-signup2-1`, (page) => {
                gSignUp(page);
            })*/
            break;
        case 'r':
            /*gotoURL(page, `${URL}/?r=${REFERRAL}`, (page) => {
                signup(page);
            });*/
            break;
        default: //normal
            gotoURL(page, `${URL}`, (page) => {
                login(page);
            });
            break;
    }
}

(async () => {
    startBot();
})();

/*const gSignUp = async (page) => {
    checkSelector(page, '#firstName', async (page) => {
        console.log(`Attempting to create account: ${EMAILS[emailIndex]}`);

        const fullname = random_name().split(' ')

        await page.click('input#firstName');
        await page.keyboard.type(fullname[0]);

        await page.click('input#lastName');
        await page.keyboard.type(fullname[1]);

        await page.click('input#username');
        const username = EMAILS[emailIndex].replace('@gmail.com', '');
        await page.keyboard.type(username);

        await page.click('#passwd input[type="password"]');
        await page.keyboard.type(G_PASSWORD);

        await page.click('#confirm-passwd input[type="password"]');
        await page.keyboard.type(G_PASSWORD);

        await page.click('#accountDetailsNext');

        page.screenshot({
            path: 'test.png'
        })
    })
}

const signup = async (page) => {
    checkSelector(page, '#signup_form', async (page) => {

        console.log('Signing up...');

        await page.click('input#signup_form_email');
        await page.keyboard.type(EMAILS[emailIndex]);

        await page.click('input#signup_form_password');
        await page.keyboard.type(PASSWORD);

        await page.click('input#login_form_2fa');
        var formattedToken = await authenticator.generateToken(KEY);
        await page.keyboard.type(formattedToken);

        gotoURL(page, null, (page) => {
            homePage(page);
        }, '#signup_button', async (page) => {
            signup(page);
        }, 10000, async (page, errCallback) => {});
    });
}*/

const login = async (page) => {
    checkSelector(page, 'section.top-bar-section ul li.login_menu_button a', async (page) => {

        console.log('Logging in...');

        await page.click('section.top-bar-section ul li.login_menu_button a');

        await page.click('input#login_form_btc_address');
        await page.keyboard.type(USERNAME);

        await page.click('input#login_form_password');
        await page.keyboard.type(PASSWORD);

        await page.click('input#login_form_2fa');
        var formattedToken = await authenticator.generateToken(KEY);
        await page.keyboard.type(formattedToken);

        gotoURL(page, null, (page) => {
            homePage(page);
        }, '#login_button', async (page) => {
            login(page);
        }, 10000, async (page, errCallback) => {
            if (page.$('.reward_point_redeem_result_error') !== null) {
                const errMsg = await page.evaluate(() => {
                    const text = document.querySelector('.reward_point_redeem_result_error').textContent;
                    return text;
                })

                console.log(errMsg);

                switch (true) {
                    case (errMsg.indexOf("tries") >= 0):
                        countdown(page, 300, (page) => {
                            refreshPage(page, (page) => {
                                login(page);
                            });
                        })
                        break;
                    default:
                        refreshPage(page, (page) => {
                            login(page);
                        });
                        break;
                }
            } else {
                refreshPage(page, errCallback);
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

let currentPts = 0;
const homePage = async (page) => {
    checkSelector(page, 'section.top-bar-section ul li .rewards_link', async (page) => {
        await page.click('section.top-bar-section ul li .rewards_link');
        const currentPtsText = await page.evaluate(() => {
            var text = document.querySelector('.user_reward_points').textContent;
            return text;
        });
        const currentPts = Number(currentPtsText);
        await page.click('#free_play_link_li a');
        checkSelector(page, '#play_without_captchas_button', async (page) => {
            
            getBalance(page);

            await page.click('#play_without_captchas_button');
            
            const costText = await page.evaluate(() => {
                var text = document.querySelector('.play_without_captcha_description > p.bold > span').textContent;
                return text;
            });
            const cost = Number(costText);

            console.log(`RP: ${currentPts} | Cost to roll: ${cost}`);

            if (cost > currentPts) {
                console.log('Cannot afford to roll, need to do captcha.');
                //Notify user in slack;
            } else {
                console.log('Enough reward points to roll.')
                await page.waitFor(5000);
                await page.click('#free_play_form_button');
                await page.waitFor(5000);
                console.log('Rolled...')

                getBalance(page);
            }

            const timeMinText = await page.evaluate(() => {
                const text = document.querySelector('#time_remaining .countdown_row .countdown_section:first-of-type .countdown_amount').textContent;
                return text;
            })

            const timeSecText = await page.evaluate(() => {
                const text = document.querySelector('#time_remaining .countdown_row .countdown_section:last-of-type .countdown_amount').textContent;
                return text;
            })

            console.log(`Timer still active, ${timeMinText} Minutes ${timeSecText} Seconds remaining.`);
            const timeMinNum = Number(timeMinText) * 60;
            const timeSecNum = Number(timeSecText);
            const timeNum = timeMinNum + timeSecNum;

            countdown(page, timeNum, (page) => {
                refreshPage(page, (page) => {
                    homePage(page);
                });
            })
        }, async (page) => {
            checkSelector(page, '#time_remaining', async (page) => {
                getBalance(page);
                const timeMinText = await page.evaluate(() => {
                    const text = document.querySelector('#time_remaining .countdown_row .countdown_section:first-of-type .countdown_amount').textContent;
                    return text;
                })

                const timeSecText = await page.evaluate(() => {
                    const text = document.querySelector('#time_remaining .countdown_row .countdown_section:last-of-type .countdown_amount').textContent;
                    return text;
                })

                console.log(`Timer still active, ${timeMinText} Minutes ${timeSecText} Seconds remaining.`);
                const timeMinNum = Number(timeMinText) * 60;
                const timeSecNum = Number(timeSecText);
                const timeNum = timeMinNum + timeSecNum;

                countdown(page, timeNum, (page) => {
                    refreshPage(page, (page) => {
                        homePage(page);
                    });
                })
            }, async (page) => {
                refreshPage(page, (page) => {
                    homePage(page);
                });
            }, 5000)
        }, 5000)
    })
}