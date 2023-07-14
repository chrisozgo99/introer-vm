function processParam(params: any) {
    const parsedParams = params;
    return JSON.stringify({
        "values": params.values,
        "type": params.type
    });
}

const myParams = JSON.parse(Buffer.from(process.argv[2], 'base64').toString());
console.log(processParam(myParams));
