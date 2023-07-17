import puppeteer from "puppeteer";
import type { Browser } from "puppeteer";
import { Cluster } from "puppeteer-cluster";


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

export { getBrowser, getBrowserCluster };
