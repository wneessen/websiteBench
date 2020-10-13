// websiteBench - Benchmark website performance measures via Puppeteer and InfluxDB
// (C) 2020 by Winni Neessen <wn@neessen.net>
import WebsiteBenchBrowser from './lib/websiteBenchBrowser';
import websiteBenchInflux from './lib/websiteBenchInflux';
import WebsiteBenchConfig from './lib/websiteBenchConfig';
import WebsiteBenchEvents from './lib/websiteBenchEvents';
import WebsiteBenchTools from './lib/websiteBenchTools';
import { IConfigFiles, IWebsiteBenchConfig } from './lib/websiteBenchInterfaces';
import Puppeteer from 'puppeteer';
import { Curl } from 'node-libcurl';
import arg from 'arg';
import { ILogObject, Logger } from 'tslog';
import process, { exit } from 'process';

// Signal handler
process.on('SIGINT', () => {
    console.warn('\nGracefully shutting down from SIGINT (Ctrl-C)');
    process.exit(1);
});

// Some constant variables
const confFiles: IConfigFiles = {
    configFile: './config/websitebench.conf',
    secretsFile: './config/websitebench.secrets.conf'
};
const pupLaunchOptions: Puppeteer.LaunchOptions = {
    headless: true,
    devtools: false,
    defaultViewport: {
        width: 1920,
        height: 1440
    },
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
    exit(1);
}

// Set options via CLI params
if(typeof cliArgs["--config"] !== 'undefined') { confFiles.configFile = cliArgs["--config"] };
if(typeof cliArgs["--secrets"] !== 'undefined') { confFiles.secretsFile = cliArgs["--secrets"] };
if(typeof cliArgs["--no-headless"] !== 'undefined') { pupLaunchOptions.headless = false; };
if(typeof cliArgs["--no-sandbox"] !== 'undefined') { pupLaunchOptions.args.push('--no-sandbox'); };
if(typeof cliArgs["--browserpath"] !== 'undefined') { pupLaunchOptions.executablePath = cliArgs["--browserpath"] };
if(
    typeof cliArgs["--browsertype"] !== 'undefined' &&
    (cliArgs["--browsertype"].toLowerCase() === 'firefox' || cliArgs["--browsertype"].toLowerCase() === 'chrome')
) {
    if(typeof cliArgs["--browserpath"] === 'undefined') {
        logObj.error('Error: Parameter --browsertype requires a custom browser path via --browserpath');
        process.exit(1);
    }
    else {
        pupLaunchOptions.product = (cliArgs["--browsertype"] as Puppeteer.Product)
    }
};

// Read config files to create config object
const _configObj = new WebsiteBenchConfig(confFiles, logObj);
const configObj = _configObj.configObj();
if(typeof cliArgs["--log-resource-errors"] !== 'undefined') { configObj.logResErrors = cliArgs["--log-resource-errors"] };
if(typeof cliArgs["--ignore-ssl-errors"] !== 'undefined') { pupLaunchOptions.ignoreHTTPSErrors = true; configObj.ignoreSslErrors = true };
configObj.pupLaunchOptions = pupLaunchOptions;

// Additional CLI params handling
if(typeof cliArgs["--help"] !== 'undefined') { showHelp(); process.exit(0); };
if(typeof cliArgs["--debug"] !== 'undefined') { logObj.setSettings({minLevel: 'debug'}); logObj.debug('DEBUG mode enabled') };

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
    configObj.logLevel
);

// Initialize InfluxDB object
const influxObj = new websiteBenchInflux(configObj, logObj);

// Initialize Event object
const eventObj = new WebsiteBenchEvents(configObj, influxObj, logObj);

/**
 * The main server loop
 *
 * @returns {Promise<void>}
 * @memberof WebsiteBench
*/
async function startServer(): Promise<void> {
    logObj.info(`websiteBench v${configObj.versionNum} - Starting Server`)

    // Check that we have a working Influx connection
    await influxObj.checkConnection().catch(errorObj => {
        logObj.error(`Connection test to InfluxDB failed: ${errorObj.message}`);
        exit(1);
    });

    let isBrowserNeeded = _configObj.isBrowserNeeded();
    const websiteBrowser = new WebsiteBenchBrowser(configObj, logObj, isBrowserNeeded);
    await websiteBrowser.launchBrowser();
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
    console.log('  -d, --debug\t\t\t\tEnable DEBUG mode');
    console.log('  -h, --help\t\t\t\tShow this help text');
    console.log('  --log-resource-errors\t\t\tIf set, the browser will start in non-headless mode');
    console.log('  --no-headless\t\t\t\tIf set, the browser will start in non-headless mode');
    console.log('  --no-sandbox\t\t\t\tIf set, the browser is started in no-sandbox mode (DANGER: Only use if you are sure what you are doing)');
    console.log('  --browserpath <path>\t\t\tPath to browser executable (Using Firefox requires --browsertype firefox)');
    console.log('  --browsertype <firefox|chrome>\tType of browser to use (Requires --browserpath to be set)');
}

startServer();