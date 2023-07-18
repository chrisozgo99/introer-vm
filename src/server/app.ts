import express from 'express';
import path from 'path';
import appRoot from 'app-root-path';
import { getBrowser, getBrowserCluster, linkedInSession } from './puppeteer';
import { Browser } from 'puppeteer';
import { Cluster } from 'puppeteer-cluster';
import * as admin from 'firebase-admin';
const app = express();
const port = 3000;
const exec = require('child_process').exec;
const serviceAccount = require('../service-accounts/introer-prod-firebase-adminsdk-n62rn-ea6a7de082.json');


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(express.json());

// let browser: Browser | undefined;
let cluster: Cluster | undefined;
(async () => {
  cluster = await getBrowserCluster(cluster);

  app.post('/run-script', async (req: any, res:any) => {
    // browser = await getBrowser(browser);
    console.log("Received POST request to endpoint /run-script");
    const params = req.body;
    // const scriptPath = path.resolve(`${appRoot.path}`, './src/server/server.ts');
    // const tsNodePath = path.resolve(`${appRoot.path}`, './node_modules/.bin/ts-node');
    const results: any[] = [];
    const tasks = params.values.map((param: any) => {
      cluster?.queue(params, async ({ page, data: params }) => {
        console.log("Received params: ", params);
        console.log("Running linkedInSession for: ", param.name);
        const result = await linkedInSession(page, param.name);
        results.push(result);
      });
    });

    await Promise.all(tasks);
    res.send(results);
  
  });
  
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${port}`);
  });

})();
