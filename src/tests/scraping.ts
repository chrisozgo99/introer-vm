import { Cluster } from "puppeteer-cluster";
import { linkedInSession } from "../server/puppeteer";
import { getBrowserCluster } from "../scripts/puppeteer-cluster";
import * as admin from 'firebase-admin';

const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH!;
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

function test(data: {
    type: "url" | "name",
    values: Array<{name: string, company: string} | string>
}) {
    let cluster: Cluster | undefined;
    (async () => {
        cluster = await getBrowserCluster(cluster, false);
        const params = data;
        const tasks = params.values.map(async (param: any) => {
            return new Promise(async resolve => {
                await cluster?.queue(params, async ({ page, data: params }) => {
                    console.log("Received params: ", params);
                    console.log("Running linkedInSession for: ", param.type === "url" ? param : `${param.name} ${param.company}`);
                    const result = await linkedInSession(
                      page,
                      param.type === "url" ? undefined : {name: param.name, company: param.company},
                      param.type === "url" ? param : undefined
                    );
                    resolve(result);
                }
            )});
        });
        const results = await Promise.all(tasks);
        console.log(results);
        return results;
    })();
}

test({
    type: "name",
    values: [
        {name: "John McNamara", company: "Jack Arthur"},
        {name: "Chris Ozgo", company: ""}
    ]
});
