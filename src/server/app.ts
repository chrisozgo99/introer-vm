const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const exec = require('child_process').exec;
const appRoot = require('app-root-path');

app.use(express.json());

app.post('/run-script', (req: any, res:any) => {
  console.log("Received POST request to endpoint /run-script");
  const params = req.body;
  const scriptPath = path.resolve(`${appRoot.path}`, './src/server/server.ts');
  const tsNodePath = path.resolve(`${appRoot.path}`, './node_modules/.bin/ts-node');
  
  console.log(params);

  const paramsStr = Buffer.from(JSON.stringify(params)).toString('base64');
  exec(`${tsNodePath} ${scriptPath} ${JSON.stringify(paramsStr)}`, (error:any, stdout:any, stderr:any) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    if (stderr) {
      console.log(`exec stderr: ${stderr}`);
    }
    //Send the output of the script back as the response
    res.send(stdout);
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running at http://localhost:${port}`);
});
