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
const puppeteer_1 = __importDefault(require("puppeteer"));
const node_libcurl_1 = require("node-libcurl");
const websiteBenchTools_1 = __importDefault(require("./websiteBenchTools"));
const qObj = __importStar(require("q"));
class WebsiteBenchBrowser {
    constructor(configObj, logObj, isBrowserNeeded) {
        this.toolsObj = new websiteBenchTools_1.default();
        this.logObj = null;
        this.isBrowserNeeded = false;
        this.isLaunching = false;
        this.maxBrowserRestarts = 5;
        this.browserRestartCount = 0;
        this.restartInterval = 1800000;
        this.runningBrowserJobs = 0;
        this.isForcedRestart = false;
        this.configObj = configObj;
        this.logObj = logObj;
        this.isBrowserNeeded = isBrowserNeeded;
        if (isBrowserNeeded) {
            setInterval(async () => {
                if (this.runningBrowserJobs === 0) {
                    this.logObj.debug('Trying to automatically restart browser...');
                    this.isForcedRestart = true;
                    if (this.browserObj.isConnected()) {
                        this.isLaunching = true;
                        await this.browserObj.close().catch(errorObj => {
                            logObj.error(`Error while closing browser: ${errorObj.message}`);
                        }).then(() => { this.logObj.debug('Browser successfully closed.'); });
                    }
                }
                else {
                    this.logObj.debug('Skipping automatic browser restart, as browser is currently busy');
                }
            }, this.restartInterval);
        }
    }
    async processPageWithBrowser(websiteEntry) {
        const webUrl = websiteEntry.siteUrl;
        const reqTimeout = websiteEntry.checkInterval - 1;
        let perfData = null;
        let resourcePerfDataArray = [];
        let statusCode;
        let resStatusCodes = [];
        let resStatusTexts = [];
        if (!this.browserIsReady())
            return;
        this.browserCtx = await this.browserObj.createIncognitoBrowserContext().catch(errorObj => {
            this.logObj.error(`Unable to create browser context: ${errorObj.message}`);
            return null;
        });
        if (this.browserCtx === null)
            return;
        const pageObj = this.configObj.allowCaching === true ?
            await this.browserObj.newPage().catch(errorObj => {
                this.logObj.error(`Failed to create new page in browser: ${errorObj.message}`);
                return null;
            }) :
            await this.browserCtx.newPage().catch(errorObj => {
                this.logObj.error(`Failed to create new page in browser: ${errorObj.message}`);
                return null;
            });
        if (pageObj === null)
            return;
        if (this.configObj.allowCaching === false) {
            await pageObj.setCacheEnabled(false);
        }
        if (this.configObj.userAgent) {
            await pageObj.setUserAgent(this.configObj.userAgent).catch(errorMsg => {
                this.logObj.error(`[Browser] Unable to set User-Agent string: ${errorMsg}`);
            });
        }
        else {
            let browserUserAgent = await this.browserObj.userAgent();
            await pageObj.setUserAgent(`${browserUserAgent} websiteBench/${this.configObj.versionNum}`).catch(errorMsg => {
                this.logObj.error(`[Browser] Unable to set User-Agent string: ${errorMsg}`);
            });
        }
        pageObj.setDefaultTimeout(reqTimeout * 1000);
        pageObj.on('console', eventObj => this.eventTriggered(eventObj));
        pageObj.on('dialog', eventObj => this.eventTriggered(eventObj));
        pageObj.on('requestfailed', requestObj => {
            resStatusTexts[requestObj.url()] = requestObj.failure().errorText;
            this.errorTriggered(requestObj, websiteEntry);
        });
        pageObj.on('requestfinished', finishedEvent => {
            if (finishedEvent.resourceType() === 'document') {
                statusCode = finishedEvent.response().status();
            }
            resStatusCodes[finishedEvent.url()] = finishedEvent.response().status();
        });
        this.runningBrowserJobs++;
        this.logObj.debug(`[Browser] Starting performance data collection for ${webUrl}...`);
        const httpResponse = await pageObj.goto(webUrl, { waitUntil: 'networkidle0' }).catch(errorMsg => {
            this.logObj.error(`[Browser] An error occured during "Page Goto" => ${errorMsg}`);
        });
        if (!httpResponse)
            return;
        const perfElementHandler = await pageObj.$('pageData').catch(errorMsg => {
            this.logObj.error(`[Browser] An error occured during "Performance Element Handling" => ${errorMsg}`);
        });
        if (typeof perfElementHandler !== 'object')
            return;
        const perfObjects = await pageObj.evaluate(pageData => {
            const navPerf = JSON.stringify(performance.getEntriesByType('navigation'));
            const resPerf = JSON.stringify(performance.getEntriesByType('resource'));
            return {
                navPerf: navPerf,
                resPerf: resPerf
            };
        }, perfElementHandler).catch(errorMsg => {
            this.logObj.error(`[Browser] An error occured "Page evaluation" => ${errorMsg}`);
        });
        if (!perfObjects) {
            this.logObj.error('Performance data not returned by getEntriesByType.');
            return;
        }
        const perfJson = perfObjects.navPerf;
        const resourcePerfJson = perfObjects.resPerf;
        if (perfJson) {
            perfData = this.processPerformanceData(perfJson);
        }
        if (resourcePerfJson) {
            let resourcePerfArray;
            const foo = Object.assign({});
            try {
                resourcePerfArray = JSON.parse(resourcePerfJson);
            }
            catch (_a) {
                this.logObj.error('Reource performance measurements JSON is not valid');
            }
            if (typeof resourcePerfArray !== 'undefined' && resourcePerfArray !== null) {
                resourcePerfArray.forEach(resourcePerfObj => {
                    let resourcePerfData = this.processResourcePerformanceData(resourcePerfObj, resStatusCodes, resStatusTexts);
                    resourcePerfDataArray.push(resourcePerfData);
                });
            }
        }
        if (statusCode) {
            perfData.statusCode = statusCode;
        }
        this.logObj.debug(`[Browser] Completed performance data collection for ${webUrl}...`);
        pageObj.close();
        this.runningBrowserJobs--;
        this.browserRestartCount = 0;
        return { perfData: perfData, resourcePerfData: resourcePerfDataArray };
    }
    async processPageWithCurl(websiteEntry) {
        return new Promise((retFunc, rejFunc) => {
            const webUrl = websiteEntry.siteUrl;
            const reqTimeout = websiteEntry.checkInterval - 1;
            const promiseArray = [];
            let userAgent;
            let perfData = null;
            if (this.configObj.userAgent) {
                userAgent = this.configObj.userAgent;
            }
            else {
                let browserUserAgent = node_libcurl_1.Curl.defaultUserAgent;
                userAgent = `${browserUserAgent} websiteBench/${this.configObj.versionNum}`;
            }
            this.logObj.debug(`[cURL] Starting performance data collection for ${webUrl}...`);
            const deferObj = qObj.defer();
            const curlObj = new node_libcurl_1.Curl();
            curlObj.setOpt('URL', webUrl);
            curlObj.setOpt('TIMEOUT', reqTimeout);
            curlObj.setOpt('USERAGENT', userAgent);
            curlObj.setOpt('DNS_SHUFFLE_ADDRESSES', true);
            curlObj.setOpt('SSL_VERIFYHOST', this.configObj.ignoreSslErrors === true ? false : true);
            curlObj.on('end', (statusCode, resData, resHeader, curlInstance) => {
                perfData = {
                    totalDurTime: curlInstance.getInfo('TOTAL_TIME_T') / 1000,
                    dnsTime: curlInstance.getInfo('NAMELOOKUP_TIME_T') / 1000,
                    tlsHandshake: curlInstance.getInfo('APPCONNECT_TIME_T') / 1000,
                    ttfbTime: curlInstance.getInfo('STARTTRANSFER_TIME_T') / 1000,
                    preTransfer: curlInstance.getInfo('PRETRANSFER_TIME_T') / 1000,
                    connectTime: curlInstance.getInfo('CONNECT_TIME_T') / 1000,
                    statusCode: statusCode,
                    resourceName: webUrl
                };
                deferObj.resolve(perfData);
                curlInstance.close();
            });
            curlObj.on('error', (errorObj) => {
                this.logObj.error(`Unable to fetch page via cURL: ${errorObj.message}`);
                this.logObj.debug(`[cURL] Completed performance data collection with error for ${webUrl}...`);
            });
            curlObj.perform();
            promiseArray.push(deferObj.promise);
            qObj.all(promiseArray).then(resPromise => {
                resPromise.forEach(curlPromise => {
                    this.logObj.debug(`[cURL] Completed performance data collection for ${webUrl}...`);
                });
            }).finally(() => {
                retFunc(perfData);
            });
        });
    }
    async eventTriggered(eventObj) {
        if (this.toolsObj.eventIsDialog(eventObj)) {
            eventObj.dismiss();
        }
    }
    async browserDisconnectEvent() {
        if (this.isForcedRestart) {
            this.logObj.debug('The browser got disconnected due to forced restart. Trying to reconnect/restart...');
        }
        else {
            this.logObj.warn('The browser got disconnected. Trying to reconnect/restart...');
        }
        this.browserObj = await puppeteer_1.default.connect({ browserWSEndpoint: this.browserWsEndpoint }).catch(errorObj => {
            return null;
        });
        if (this.browserObj === null || !this.browserObj.isConnected()) {
            await this.launchBrowser().catch(errorObj => {
                this.logObj.error(`Unable to restart browser: ${errorObj.message}. Quitting.`);
                process.exit(1);
            });
        }
        else {
            this.isForcedRestart = false;
        }
    }
    async errorTriggered(requestObj, websiteEntry) {
        if (this.configObj.logResErrors === true) {
            this.logObj.error(`[${websiteEntry.siteName}] Unable to load resource URL => ${requestObj.url()}`);
            this.logObj.error(`[${websiteEntry.siteName}] Request failed with an "${requestObj.failure().errorText}" error`);
            if (requestObj.response()) {
                this.logObj.error(`[${websiteEntry.siteName}] Resulting status: ${requestObj.response().status()} ${requestObj.response().statusText()}`);
            }
        }
    }
    processPerformanceData(perfJson) {
        let perfData = Object.assign({});
        let perfEntries = JSON.parse(perfJson);
        if (perfEntries !== null && perfEntries[0]) {
            let perfEntry = perfEntries[0];
            perfData.totalDurTime = perfEntry.duration;
            perfData.dnsTime = (perfEntry.domainLookupEnd - perfEntry.domainLookupStart);
            perfData.connectTime = (perfEntry.connectEnd - perfEntry.connectStart);
            perfData.ttfbTime = (perfEntry.responseStart - perfEntry.requestStart);
            perfData.downloadTime = (perfEntry.responseEnd - perfEntry.responseStart);
            perfData.redirectTime = (perfEntry.redirectEnd - perfEntry.redirectStart);
            perfData.domIntTime = (perfEntry.domInteractive - perfEntry.responseEnd);
            perfData.domContentTime = (perfEntry.domContentLoadedEventEnd - perfEntry.domContentLoadedEventStart);
            perfData.domCompleteTime = (perfEntry.domComplete - perfEntry.domContentLoadedEventEnd);
            perfData.transferSize = perfEntry.transferSize;
            perfData.encodedBodySize = perfEntry.encodedBodySize;
            perfData.decodedBodySize = perfEntry.decodedBodySize;
            perfData.initiatorType = perfEntry.initiatorType;
            perfData.tlsHandshake = (perfEntry.secureConnectionStart - perfEntry.connectStart);
            perfData.resourceName = perfEntry.name;
            perfData.entryType = perfEntry.entryType;
            perfData.redirectCount = perfEntry.redirectCount;
        }
        return perfData;
    }
    processResourcePerformanceData(resourcePerfData, statusCodes, statusTexts) {
        let perfData = Object.assign({});
        if (resourcePerfData !== null) {
            perfData.totalDurTime = resourcePerfData.duration;
            perfData.dnsTime = (resourcePerfData.domainLookupEnd - resourcePerfData.domainLookupStart);
            perfData.connectTime = (resourcePerfData.connectEnd - resourcePerfData.connectStart);
            perfData.ttfbTime = (resourcePerfData.responseStart - resourcePerfData.requestStart);
            perfData.downloadTime = (resourcePerfData.responseEnd - resourcePerfData.responseStart);
            perfData.redirectTime = (resourcePerfData.redirectEnd - resourcePerfData.redirectStart);
            perfData.transferSize = resourcePerfData.transferSize;
            perfData.encodedBodySize = resourcePerfData.encodedBodySize;
            perfData.decodedBodySize = resourcePerfData.decodedBodySize;
            perfData.initiatorType = resourcePerfData.initiatorType;
            perfData.tlsHandshake = (resourcePerfData.secureConnectionStart - resourcePerfData.connectStart);
            perfData.startTime = resourcePerfData.startTime;
            perfData.entryType = resourcePerfData.entryType;
            if (typeof resourcePerfData.name !== 'undefined' && resourcePerfData.name !== null) {
                let urlSplit = resourcePerfData.name.split('?');
                perfData.resourceName = urlSplit[0];
            }
            let resStatusCode = statusCodes[resourcePerfData.name];
            if (typeof resStatusCode !== 'undefined' && resStatusCode !== null) {
                perfData.statusCode = resStatusCode;
            }
            let resStatusText = statusTexts[resourcePerfData.name];
            if (typeof resStatusText !== 'undefined' && resStatusText !== null) {
                perfData.errorText = resStatusText;
            }
        }
        return perfData;
    }
    async launchBrowser() {
        if (this.browserRestartCount >= this.maxBrowserRestarts) {
            this.logObj.error(`Maximum amount of browser restarts w/o successful querying reached. Quitting`);
            process.exit(1);
        }
        if (this.isBrowserNeeded) {
            this.isLaunching = true;
            await puppeteer_1.default.launch(this.configObj.pupLaunchOptions).catch(errorMsg => {
                this.logObj.error(`Unable to start Browser: ${errorMsg}`);
            }).then(newBrowser => {
                if (typeof newBrowser !== 'undefined' && newBrowser !== null) {
                    this.browserObj = newBrowser;
                    this.browserWsEndpoint = this.browserObj.wsEndpoint();
                    this.browserObj.on('disconnected', () => this.browserDisconnectEvent());
                    this.isLaunching = false;
                    this.browserRestartCount++;
                }
            });
            if (typeof this.browserObj === 'undefined' || this.browserObj === null || !this.browserObj.isConnected()) {
                this.logObj.error('Could not start browser. Quitting.');
                process.exit(1);
            }
        }
    }
    browserIsReady() {
        if (this.isLaunching === true || !this.browserObj.isConnected()) {
            return false;
        }
        return true;
    }
}
exports.default = WebsiteBenchBrowser;
