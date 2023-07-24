import { Cluster } from "puppeteer-cluster";

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

export { getBrowserCluster };
