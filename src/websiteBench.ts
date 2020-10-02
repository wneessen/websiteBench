// websiteBench - Benchmark website performance measures via Puppeteer and InfluxDB
// (C) 2020 by Winni Neessen <wn@neessen.net>
import WebsiteBenchBrowser from './lib/websiteBenchBrowser';
import WebsiteBenchConfig from './lib/websiteBenchConfig';
import WebsiteBenchEvents from './lib/websiteBenchEvents';
import WebsiteBenchTools from './lib/websiteBenchTools';
import { IConfigFiles, IWebsiteBenchConfig } from './lib/websiteBenchInterfaces';
import Puppeteer from 'puppeteer';
import arg from 'arg';
import { InfluxDB } from 'influx';
import { ILogObject, Logger } from 'tslog';
import process, { exit } from 'process';

// Signal handler
process.on('SIGINT', () => {
    console.warn('\nGracefully shutting down from SIGINT (Ctrl-C)');
    process.exit(1);
});

// Some constant variables
const confFiles: IConfigFiles = {
    configFile: './conf/websitebench.conf',
    secretsFile: './conf/websitebench.secrets.conf'
};
const pupLaunchOptions: Puppeteer.LaunchOptions = {
    headless: true,
    devtools: true,
    args: [],
};


// Initialize logger object
const logObj: Logger = new Logger({
    displayFunctionName: false,
    displayRequestId: false,
    displayFilePath: 'hidden',
    minLevel: 'debug'
});

// Read CLI options
let cliArgs;
try {
    cliArgs = arg({
        // CLI args
        '--config': String,
        '--secrets': String,
        '--browserpath': String,
        '--browsertype': String,
        '--ignore-ssl-errors': Boolean,
        '--no-headless': Boolean,
        '--no-sandbox': Boolean,
        '--log-resource-errors': Boolean,
        '--help': Boolean,
        '--debug': Boolean,

        // Aliases
        '-c': '--config',
        '-s': '--secrets',
        '-h': '--help',
        '-d': '--debug',
    }, { argv: process.argv.slice(2) });
}
catch(errorObj) {
    logObj.error(`Error: ${errorObj.message}`);
    showHelp();
    exit(1);
}

// Set options via CLI params
if(typeof cliArgs["--config"] !== 'undefined') { confFiles.configFile = cliArgs["--config"] };
if(typeof cliArgs["--secrets"] !== 'undefined') { confFiles.secretsFile = cliArgs["--secrets"] };
if(typeof cliArgs["--ignore-ssl-errors"] !== 'undefined') { pupLaunchOptions.ignoreHTTPSErrors = true };
if(typeof cliArgs["--no-headless"] !== 'undefined') { pupLaunchOptions.headless = false; };
if(typeof cliArgs["--no-sandbox"] !== 'undefined') { pupLaunchOptions.args.push('--no-sandbox'); };
if(typeof cliArgs["--browserpath"] !== 'undefined') { pupLaunchOptions.executablePath = cliArgs["--browserpath"] };
if(
    typeof cliArgs["--browsertype"] !== 'undefined' &&
    (cliArgs["--browsertype"].toLowerCase() === 'firefox' || cliArgs["--browsertype"].toLowerCase() === 'chrome')
) {
    if(typeof cliArgs["--browserpath"] === 'undefined') {
        logObj.error('Error: Parameter --browsertype requires a custom browser path via --browserpath');
        showHelp();
        process.exit(1);
    }
    else {
        pupLaunchOptions.product = (cliArgs["--browsertype"] as Puppeteer.Product)
    }
};

// Read config files to create config object
const configObj = new WebsiteBenchConfig(confFiles, logObj).configObj();
if(typeof cliArgs["--log-resource-errors"] !== 'undefined') { configObj.logResErrors = cliArgs["--log-resource-errors"] };

// Additional CLI params handling
if(typeof cliArgs["--help"] !== 'undefined') { showHelp(); process.exit(0); };
if(typeof cliArgs["--debug"] !== 'undefined') { logObj.settings.minLevel = 'debug' };

// Attach file system logging transport
const toolsObj = new WebsiteBenchTools();
logObj.attachTransport(
    {
        silly:  toolsObj.logToFile,
        debug:  toolsObj.logToFile,
        trace:  toolsObj.logToFile,
        info:   toolsObj.logToFile,
        warn:   toolsObj.logToFile,
        error:  toolsObj.logToFile,
        fatal:  toolsObj.logToFile,
    },
    'debug'
);

// Initialize InfluxDB object
const influxClient = new InfluxDB({
    database: configObj.influxDb.database,
    username: configObj.influxDb.username,
    password: configObj.influxDb.password,
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
influxClient.getDatabaseNames().then(dbNames => {
    if(dbNames.indexOf(configObj.influxDb.database) === -1) {
        logObj.error(`Database "${configObj.influxDb.database}" not found on InfluxDB server.`);
        exit(1);
    }
}).catch(errorMsg => {
    logObj.error(`Unable to connect to InfluxDB:`);
    logObj.error(errorMsg.message);
    logObj.error(`Please check your influxDb config settings`);
    exit(1);
});

// Initialize Event object
const eventObj = new WebsiteBenchEvents(configObj, influxClient, logObj);

/**
 * The main server loop
 *
 * @returns {Promise<void>}
 * @memberof WebsiteBench
*/
async function startServer(): Promise<void> {
    logObj.info(`websiteBench v${configObj.versionNum} - Starting Server`)
    const browserObj = await Puppeteer.launch(pupLaunchOptions).catch(errorMsg => {
        logObj.error(`Unable to start Browser: ${errorMsg}`);
        process.exit(1);
    });
    const websiteBrowser = new WebsiteBenchBrowser(browserObj, configObj, logObj);
    eventObj.browserObj = websiteBrowser;
    
    configObj.websiteList.forEach(webSite => {
       eventObj.scheduleSiteCheck(webSite);
    });
}

/**
 * Display the help message
 *
 * @returns {void}
 * @memberof WebsiteBench
*/
function showHelp(): void {
    console.log(`websiteBench v${configObj.versionNum}`);
    console.log('Usage: node websiteBench.js [arguments]');
    console.log('  -c, --config <filepath>\t\tUse <filepath> as config file (Default: ./conf/websitebench.conf)');
    console.log('  -s, --secrets <filepath>\t\tUse <filepath> as secrets file (Default: ./conf/websitebench.secrets.conf)');
    console.log('  --log-resource-errors\t\t\tIf set, the browser will start in non-headless mode');
    console.log('  --no-headless\t\t\t\tIf set, the browser will start in non-headless mode');
    console.log('  --no-sandbox\t\t\t\tIf set, the browser is started in no-sandbox mode (DANGER: Only use if you are sure what you are doing)');
    console.log('  --browserpath <path>\t\t\tPath to browser executable (Using Firefox requires --browsertype firefox)');
    console.log('  --browsertype <firefox|chrome>\tType of browser to use (Requires --browserpath to be set)');
    console.log('  -d, --debug\t\t\t\tEnable DEBUG mode');
    console.log('  -h, --help\t\t\t\tShow this help text');
}

startServer();