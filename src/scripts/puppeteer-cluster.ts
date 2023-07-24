import { Cluster } from "puppeteer-cluster";
import { authenticate } from "../server/puppeteer";

const RECYCLE_INTERVAL = 6 * 60 * 60 * 1000;


/**
 * Initialize the browser cluster instance
 *
 * @param {*} cluster
 * @return {*}  {Promise<any>}
 */
async function getBrowserCluster(headless: boolean | "new" = "new"): Promise<Cluster<any, any>> {
    console.log('getting browser cluster');
    const newCluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 2,
        puppeteerOptions: {
            headless: headless,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
        });

    console.log('new cluster created');

    await newCluster.task(async ({ page, data: params }) => {
        await authenticate(page);

        console.log("successfully authenticated on the restart");
    });

    console.log('tasks complete');

    return newCluster;  
}

async function recycleBrowserCluster(cluster?: Cluster<any, any>) {
    console.log('entered recycleBrowserCluster');
    if (cluster) {
        console.log('cluster exists');
        while (cluster.idle()) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        await cluster.close();
    }
    console.log('creating new cluster');
    const newCluster = await getBrowserCluster();

    // setTimeout(() => recycleBrowserCluster(cluster), RECYCLE_INTERVAL);
    return cluster;
}

export { getBrowserCluster, recycleBrowserCluster }
