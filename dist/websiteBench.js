"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const websiteBenchBrowser_1 = __importDefault(require("./lib/websiteBenchBrowser"));
const websiteBenchConfig_1 = __importDefault(require("./lib/websiteBenchConfig"));
const websiteBenchEvents_1 = __importDefault(require("./lib/websiteBenchEvents"));
const websiteBenchTools_1 = __importDefault(require("./lib/websiteBenchTools"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const arg_1 = __importDefault(require("arg"));
const influx_1 = require("influx");
const tslog_1 = require("tslog");
const process_1 = __importStar(require("process"));
process_1.default.on('SIGINT', () => {
    console.warn('\nGracefully shutting down from SIGINT (Ctrl-C)');
    process_1.default.exit(1);
});
const confFiles = {
    configFile: './conf/websitebench.conf',
    secretsFile: './conf/websitebench.secrets.conf'
};
const pupLaunchOptions = {
    headless: true,
    devtools: true,
    args: [],
};
const logObj = new tslog_1.Logger({
    displayFunctionName: false,
    displayRequestId: false,
    displayFilePath: 'hidden',
    minLevel: 'debug'
});
let cliArgs;
try {
    cliArgs = arg_1.default({
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
        '-c': '--config',
        '-s': '--secrets',
        '-h': '--help',
        '-d': '--debug',
    }, { argv: process_1.default.argv.slice(2) });
}
catch (errorObj) {
    logObj.error(`Error: ${errorObj.message}`);
    showHelp();
    process_1.exit(1);
}
if (typeof cliArgs["--config"] !== 'undefined') {
    confFiles.configFile = cliArgs["--config"];
}
;
if (typeof cliArgs["--secrets"] !== 'undefined') {
    confFiles.secretsFile = cliArgs["--secrets"];
}
;
if (typeof cliArgs["--ignore-ssl-errors"] !== 'undefined') {
    pupLaunchOptions.ignoreHTTPSErrors = true;
}
;
if (typeof cliArgs["--no-headless"] !== 'undefined') {
    pupLaunchOptions.headless = false;
}
;
if (typeof cliArgs["--no-sandbox"] !== 'undefined') {
    pupLaunchOptions.args.push('--no-sandbox');
}
;
if (typeof cliArgs["--browserpath"] !== 'undefined') {
    pupLaunchOptions.executablePath = cliArgs["--browserpath"];
}
;
if (typeof cliArgs["--browsertype"] !== 'undefined' &&
    (cliArgs["--browsertype"].toLowerCase() === 'firefox' || cliArgs["--browsertype"].toLowerCase() === 'chrome')) {
    if (typeof cliArgs["--browserpath"] === 'undefined') {
        logObj.error('Error: Parameter --browsertype requires a custom browser path via --browserpath');
        showHelp();
        process_1.default.exit(1);
    }
    else {
        pupLaunchOptions.product = cliArgs["--browsertype"];
    }
}
;
const configObj = new websiteBenchConfig_1.default(confFiles, logObj).configObj();
if (typeof cliArgs["--log-resource-errors"] !== 'undefined') {
    configObj.logResErrors = cliArgs["--log-resource-errors"];
}
;
if (typeof cliArgs["--help"] !== 'undefined') {
    showHelp();
    process_1.default.exit(0);
}
;
if (typeof cliArgs["--debug"] !== 'undefined') {
    logObj.settings.minLevel = 'debug';
}
;
const toolsObj = new websiteBenchTools_1.default();
logObj.attachTransport({
    silly: toolsObj.logToFile,
    debug: toolsObj.logToFile,
    trace: toolsObj.logToFile,
    info: toolsObj.logToFile,
    warn: toolsObj.logToFile,
    error: toolsObj.logToFile,
    fatal: toolsObj.logToFile,
}, 'debug');
const influxClient = new influx_1.InfluxDB({
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
    if (dbNames.indexOf(configObj.influxDb.database) === -1) {
        logObj.error(`Database "${configObj.influxDb.database}" not found on InfluxDB server.`);
        process_1.exit(1);
    }
}).catch(errorMsg => {
    logObj.error(`Unable to connect to InfluxDB:`);
    logObj.error(errorMsg.message);
    logObj.error(`Please check your influxDb config settings`);
    process_1.exit(1);
});
const eventObj = new websiteBenchEvents_1.default(configObj, influxClient, logObj);
async function startServer() {
    logObj.info(`websiteBench v${configObj.versionNum} - Starting Server`);
    const browserObj = await puppeteer_1.default.launch(pupLaunchOptions).catch(errorMsg => {
        logObj.error(`Unable to start Browser: ${errorMsg}`);
        process_1.default.exit(1);
    });
    const websiteBrowser = new websiteBenchBrowser_1.default(browserObj, configObj, logObj);
    eventObj.browserObj = websiteBrowser;
    configObj.websiteList.forEach(webSite => {
        eventObj.scheduleSiteCheck(webSite);
    });
}
function showHelp() {
    console.log(`websiteBench v${configObj.versionNum}`);
    console.log('Usage: node websiteBench.js [arguments]');
    console.log('  -c, --config <filepath>\t\tUse <filepath> as config file (Default: ./conf/websitebench.conf)');
    console.log('  -s, --secrets <filepath>\t\tUse <filepath> as secrets file (Default: ./conf/websitebench.secrets.conf)');
    console.log('  -d, --debug\t\t\t\tEnable DEBUG mode');
    console.log('  -h, --help\t\t\t\tShow this help text');
}
startServer();
