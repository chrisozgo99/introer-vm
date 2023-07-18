import express from 'express';
import { getBrowserCluster, linkedInSession } from './puppeteer';
import { Cluster } from 'puppeteer-cluster';
import * as admin from 'firebase-admin';
import serviceAccount from '../service-accounts/introer-prod-firebase-adminsdk-n62rn-ea6a7de082.json';
const app = express();
const port = 3000;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

app.use(express.json());

let cluster: Cluster | undefined;
(async () => {
  cluster = await getBrowserCluster(cluster);

  app.post('/run-script', async (req: any, res:any) => {
    console.log("Received POST request to /run-script");
    const params = req.body;
    const type = params.type;
    const tasks = params.values.map(async (param: any) => {
      return new Promise(async resolve => {
        await cluster?.queue(params, async ({ page, data: params }) => {
          console.log("Received params: ", params);
          console.log("Running linkedInSession for: ", type === "url" ? param : `${param.name} ${param.company}`);
          const result = await linkedInSession(
            page,
            type === "url" ? undefined : `${param.name} ${param.company}`,
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
