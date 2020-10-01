// websiteBench - Benchmark website performance measures via Puppeteer and InfluxDB
// (C) 2020 by Winni Neessen <wn@neessen.net>
import arg from 'arg';
import { InfluxDB } from 'influx';
import { Logger } from 'tslog';
import process, { exit } from 'process';
import WebsiteBenchConfig from './lib/websiteBenchConfig';
import WebsiteBenchEvents from './lib/websiteBenchEvents';
import { IWebsiteBenchConfig } from './lib/websiteBenchInterfaces';
import Puppeteer from 'puppeteer';
import WebsiteBenchBrowser from './lib/websiteBenchBrowser';


// Signal handler
process.on('SIGINT', () => {
    console.warn('\nGracefully shutting down from SIGINT (Ctrl-C)');
    process.exit(1);
});

// Some constant variables
var versionNum: string = '0.1.0';
let confFile = './conf/websitebench.conf';
let secretsFile = './conf/websitebench.secrets.conf';
const pupLaunchOptions: Puppeteer.LaunchOptions = {
    headless: true,
    args: [],
};

// Initialize logger object
const logObj: Logger = new Logger({
    displayFunctionName: false,
    displayRequestId: false,
    minLevel: 'debug'
});

// Read configs
const configObj = new WebsiteBenchConfig(confFile, secretsFile, logObj).configObj();
logObj.info(configObj)
exit(1);
/*

// Initialize InfluxDB object
const influxClient = new InfluxDB({
    database: configObj.influxDb.database,
    username: secretsObj.influxDb.username,
    password: secretsObj.influxDb.password,
    hosts: [
        {
            host: configObj.influxDb.hostname,
            port: (configObj.influxDb.port !== null ? configObj.influxDb.port : 8086),
            path: (configObj.influxDb.path !== null ? configObj.influxDb.path : '/'),
            protocol: (configObj.influxDb.protocol !== null ? configObj.influxDb.protocol : 'http'),
            options: {
                rejectUnauthorized: (configObj.influxDb.ignoressl === true ? false : true)
            }
        }
    ]
});

// Initialize Event object
const eventObj = new WebsiteBenchEvents(configObj, influxClient);

// Server method
async function startServer() {
    const browserObj = await Puppeteer.launch(pupLaunchOptions).catch(errorMsg => {
        console.error(`Unable to start Browser: ${errorMsg}`);
        process.exit(1);
    });
    const websiteBrowser = new WebsiteBenchBrowser(browserObj, configObj);
    eventObj.browserObj = websiteBrowser;
    
    configObj.websiteList.forEach(webSite => {
       eventObj.scheduleSiteCheck(webSite);
    });
}

startServer();
*/