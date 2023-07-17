import puppeteer from "puppeteer";
import type { Browser } from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import { UserInfo } from "../types/user";
import * as admin from "firebase-admin";


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
    name?: string,
    url?: string
) {
    const cookies = await admin
        .firestore()
        .collection("cookies")
        .doc("linkedin")
        .get()
        .then((doc) => {
            if (!doc.exists) {
                console.log("No such document!");
                return null;
            } else {
                return doc.data();
            }
        })
        .catch((err) => {
            console.log("Error getting document", err);
            return null;
        }
    );

    return cookies;
}

export { getBrowser, getBrowserCluster };
