import puppeteer from "puppeteer";
import type { Browser, Page } from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import { UserInfo } from "../types/user";
import * as admin from "firebase-admin";
require('dotenv').config();

/**
 * Initialize the browser instance
 *
 * @param {(Browser | undefined)} browser
 * @return {*} browser
 */
async function getBrowser(browser: Browser | undefined): Promise<Browser> {
    const puppeteerConfig = {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      };

    if (browser) {
        return browser;
    } else {
        return await puppeteer.launch(puppeteerConfig);
    }
}


/**
 * Initialize the browser cluster instance
 *
 * @param {*} cluster
 * @return {*}  {Promise<any>}
 */
async function getBrowserCluster(cluster: any): Promise<Cluster<any, any>> {
    if (cluster) {
        return cluster;
    } else {
        return await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_CONTEXT,
            maxConcurrency: 2,
          });
    }
}

async function linkedInSession(
    page: Page,
    name?: string,
    url?: string,
) {
    const cookies = await admin
        .firestore()
        .collection("cookies")
        .doc("cookies")
        .get()
        .then((doc) => {
            if (!doc.exists) {
                console.log("No such document!");
                return null;
            } else {
                console.log("Document exists");
                return doc.data();
            }
        })
        .catch((err) => {
            console.log("Error getting document", err);
            return null;
        }
    );

    if (cookies) {
        console.log('cookies found');
        await page.setCookie(...cookies.cookies);
    } else {
        console.log('no cookies found. logging in');
        const cookies = await authenticate(page);
        await page.setCookie(...cookies);
    }
}

async function authenticate(page: Page, alreadyOnLoginPage = false) {
    if (!page) {
        console.log("No page provided");
    }

    if (!alreadyOnLoginPage) {
        await page.goto("https://www.linkedin.com/login");
    }

    if (await page.$$eval('#username', (el) => el.length) === 0) {
        await page.type("#password", process.env.LINKEDIN_PASSWORD!);
    } else {
        await page.type("#username", process.env.LINKEDIN_USERNAME!);
        await page.type("#password", process.env.LINKEDIN_PASSWORD!);
    }

    await page.click(".btn__primary--large");

    console.log('logged in')

    const cookies = await page.cookies();

    await admin
        .firestore()
        .collection("cookies")
        .doc("cookies")
        .set({ cookies: cookies });

    return cookies;
}

export { getBrowser, getBrowserCluster, linkedInSession };
