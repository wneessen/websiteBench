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
const node_libcurl_1 = require("node-libcurl");
const websiteBenchTools_1 = __importDefault(require("./websiteBenchTools"));
const qObj = __importStar(require("q"));
class WebsiteBenchBrowser {
    constructor(browserObj, configObj, logObj) {
        this.toolsObj = new websiteBenchTools_1.default();
        this.logObj = null;
        this.numOfRetries = 3;
        this.browserObj = browserObj;
        this.configObj = configObj;
        this.logObj = logObj;
    }
    async processPageWithBrowser(websiteEntry) {
        const webUrl = websiteEntry.siteUrl;
        const reqTimeout = websiteEntry.checkInterval - 1;
        let perfData = null;
        const perfDataTotal = {
            totalDurTime: 0,
            connectTime: 0,
            dnsTime: 0,
            ttfbTime: 0,
            downloadTime: 0,
            domIntTime: 0,
            domContentTime: 0,
            domCompleteTime: 0,
        };
        this.browserCtx = await this.browserObj.createIncognitoBrowserContext();
        const pageObj = this.configObj.allowCaching === true ? await this.browserObj.newPage() : await this.browserCtx.newPage();
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
        pageObj.on('requestfailed', requestObj => this.errorTriggered(requestObj, websiteEntry));
        for (let runCount = 0; runCount < this.numOfRetries; runCount++) {
            this.logObj.debug(`[Browser] Starting performance data collection for ${webUrl} (Run: ${runCount})...`);
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
            const perfJson = await pageObj.evaluate(pageData => {
                return JSON.stringify(performance.getEntriesByType('navigation'));
            }, perfElementHandler).catch(errorMsg => {
                this.logObj.error(`[Browser] An error occured "Page evaluation" => ${errorMsg}`);
            });
            if (perfJson) {
                let tempPerf = this.processPerformanceData(perfJson);
                perfDataTotal.totalDurTime += tempPerf.totalDurTime;
                perfDataTotal.connectTime += tempPerf.connectTime;
                perfDataTotal.dnsTime += tempPerf.dnsTime;
                perfDataTotal.ttfbTime += tempPerf.ttfbTime;
                perfDataTotal.downloadTime += tempPerf.downloadTime;
                perfDataTotal.domIntTime += tempPerf.domIntTime;
                perfDataTotal.domContentTime += tempPerf.domContentTime;
                perfDataTotal.domCompleteTime += tempPerf.domCompleteTime;
            }
            this.logObj.debug(`[Browser] Completed performance data collection for ${webUrl} (Run: ${runCount})...`);
        }
        pageObj.close();
        perfData = {
            totalDurTime: (perfDataTotal.totalDurTime / this.numOfRetries),
            connectTime: (perfDataTotal.connectTime / this.numOfRetries),
            dnsTime: (perfDataTotal.dnsTime / this.numOfRetries),
            ttfbTime: (perfDataTotal.ttfbTime / this.numOfRetries),
            downloadTime: (perfDataTotal.downloadTime / this.numOfRetries),
            domIntTime: (perfDataTotal.domIntTime / this.numOfRetries),
            domContentTime: (perfDataTotal.domContentTime / this.numOfRetries),
            domCompleteTime: (perfDataTotal.domCompleteTime / this.numOfRetries)
        };
        return perfData;
    }
    async processPageWithCurl(websiteEntry) {
        return new Promise((retFunc, rejFunc) => {
            const webUrl = websiteEntry.siteUrl;
            const reqTimeout = websiteEntry.checkInterval - 1;
            const promiseArray = [];
            let userAgent;
            let perfData = null;
            const perfDataTotal = {
                totalDurTime: 0,
                connectTime: 0,
                dnsTime: 0,
                ttfbTime: 0,
                preTransfer: 0,
                tlsHandshake: 0,
                statusCode: 0,
                statusCodes: []
            };
            if (this.configObj.userAgent) {
                userAgent = this.configObj.userAgent;
            }
            else {
                let browserUserAgent = node_libcurl_1.Curl.defaultUserAgent;
                userAgent = `${browserUserAgent} websiteBench/${this.configObj.versionNum}`;
            }
            for (let runCount = 0; runCount < this.numOfRetries; runCount++) {
                this.logObj.debug(`[cURL] Starting performance data collection for ${webUrl} (Run: ${runCount})...`);
                const deferObj = qObj.defer();
                const curlObj = new node_libcurl_1.Curl();
                curlObj.setOpt('URL', webUrl);
                curlObj.setOpt('TIMEOUT', reqTimeout);
                curlObj.setOpt('USERAGENT', userAgent);
                curlObj.setOpt('DNS_SHUFFLE_ADDRESSES', true);
                curlObj.setOpt('SSL_VERIFYHOST', this.configObj.ignoreSslErrors === true ? false : true);
                curlObj.on('end', (statusCode, resData, resHeader, curlInstance) => {
                    const tempPerf = {
                        runNumber: runCount,
                        totalDurTime: curlInstance.getInfo('TOTAL_TIME_T') / 1000,
                        dnsTime: curlInstance.getInfo('NAMELOOKUP_TIME_T') / 1000,
                        tlsHandshake: curlInstance.getInfo('APPCONNECT_TIME_T') / 1000,
                        ttfbTime: curlInstance.getInfo('STARTTRANSFER_TIME_T') / 1000,
                        preTransfer: curlInstance.getInfo('PRETRANSFER_TIME_T') / 1000,
                        connectTime: curlInstance.getInfo('CONNECT_TIME_T') / 1000,
                        statusCode: statusCode
                    };
                    deferObj.resolve(tempPerf);
                    curlInstance.close();
                });
                curlObj.on('error', (errorObj) => {
                    this.logObj.error(`Unable to fetch page via cURL: ${errorObj.message}`);
                    this.logObj.debug(`[cURL] Completed performance data collection with error for ${webUrl} (Run: ${runCount})...`);
                });
                curlObj.perform();
                promiseArray.push(deferObj.promise);
            }
            qObj.all(promiseArray).then(resPromise => {
                resPromise.forEach(curlPromise => {
                    perfDataTotal.totalDurTime += curlPromise.totalDurTime;
                    perfDataTotal.connectTime += curlPromise.connectTime;
                    perfDataTotal.dnsTime += curlPromise.dnsTime;
                    perfDataTotal.ttfbTime += curlPromise.ttfbTime;
                    perfDataTotal.tlsHandshake += curlPromise.tlsHandshake;
                    perfDataTotal.preTransfer += curlPromise.preTransfer;
                    perfDataTotal.statusCodes.push(curlPromise.statusCode);
                    this.logObj.debug(`[cURL] Completed performance data collection for ${webUrl} (Run: ${curlPromise.runNumber})...`);
                });
            }).finally(() => {
                perfData = {
                    totalDurTime: (perfDataTotal.totalDurTime / this.numOfRetries),
                    connectTime: (perfDataTotal.connectTime / this.numOfRetries),
                    dnsTime: (perfDataTotal.dnsTime / this.numOfRetries),
                    ttfbTime: (perfDataTotal.ttfbTime / this.numOfRetries),
                    tlsHandshake: (perfDataTotal.tlsHandshake / this.numOfRetries),
                    preTransfer: (perfDataTotal.preTransfer / this.numOfRetries),
                };
                perfData.statusCodesString = perfDataTotal.statusCodes.join(':');
                retFunc(perfData);
            });
        });
    }
    async eventTriggered(eventObj) {
        if (this.toolsObj.eventIsDialog(eventObj)) {
            eventObj.dismiss();
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
            perfData.domIntTime = (perfEntry.domInteractive - perfEntry.responseEnd);
            perfData.domContentTime = (perfEntry.domContentLoadedEventEnd - perfEntry.domContentLoadedEventStart);
            perfData.domCompleteTime = (perfEntry.domComplete - perfEntry.domContentLoadedEventEnd);
        }
        return perfData;
    }
}
exports.default = WebsiteBenchBrowser;
