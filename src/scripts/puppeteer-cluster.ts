import { Cluster } from "puppeteer-cluster";

const RECYCLE_INTERVAL = 6 * 60 * 60 * 1000;


/**
 * Initialize the browser cluster instance
 *
 * @param {*} cluster
 * @return {*}  {Promise<any>}
 */
async function getBrowserCluster(cluster: any, headless: boolean | "new" = "new"): Promise<Cluster<any, any>> {
    if (cluster) {
        return cluster;
    } else {
        return await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_CONTEXT,
            maxConcurrency: 2,
            puppeteerOptions: {
                headless: headless,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            },
          });
    }
}

async function recycleBrowserCluster(cluster?: Cluster<any, any>) {
    if (cluster) {
        await cluster.close();
    }
    cluster = await getBrowserCluster(cluster);
    setTimeout(() => recycleBrowserCluster(cluster), RECYCLE_INTERVAL);
    return cluster;
}

export { getBrowserCluster, recycleBrowserCluster }