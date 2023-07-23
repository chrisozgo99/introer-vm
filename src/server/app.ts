require('dotenv').config();
import express from 'express';
import { authenticate, linkedInSession } from './puppeteer';
import { getBrowserCluster, recycleBrowserCluster } from '../scripts/puppeteer-cluster';
import { Cluster } from 'puppeteer-cluster';
import * as admin from 'firebase-admin';
import cron from 'node-cron';
import { Page, Protocol } from 'puppeteer';

const port = parseInt(process.env.PORT!)
const app = express();
const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH!;
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

app.use(express.json());

let cluster: Cluster | undefined;

cron.schedule('* * * * *', async () => {
  if (cluster) {
    await cluster.close();
  }
  cluster = await recycleBrowserCluster(cluster);
  await cluster?.queue(async (page: Page) => {
    let result: Protocol.Network.Cookie[];
    try {
      result = await authenticate(page);
    } catch (err) {
      console.log("Authentication failed for an instance");
    }
    console.log("Authentication complete for an instance");
  });
});

(async () => {
  cluster = await recycleBrowserCluster(cluster);

  app.post(process.env.API_ENDPOINT!, async (req: any, res:any) => {
    console.log(`Received POST request to ${process.env.API_ENDPOINT!}`);
    const params = req.body;
    const type = params.type;
    const tasks = params.values.map(async (param: any) => {
      return new Promise(async resolve => {
        await cluster?.queue(params, async ({ page, data: params }) => {
          console.log("Received params: ", params);
          console.log("Running linkedInSession for: ", type === "url" ? param : `${param.name} ${param.company}`);
          const result = await linkedInSession(
            page,
            type === "url" ? undefined : {name: param.name, company: param.company},
            type === "url" ? param : undefined
          );
          resolve(result);
        });
      });
    });

    const results = await Promise.all(tasks);
    res.send(results);
  });
  
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${port}`);
  });

})();
