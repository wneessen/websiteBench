"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const websiteBenchTools_1 = __importDefault(require("./websiteBenchTools"));
class WebsiteBenchBrowser {
    constructor(browserObj, configObj, logObj) {
        this.toolsObj = new websiteBenchTools_1.default();
        this.logObj = null;
        this.numOfRetries = 3;
        this.browserObj = browserObj;
        this.configObj = configObj;
        this.logObj = logObj;
    }
    async processPage(websiteEntry) {
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
                this.logObj.error(`Unable to set User-Agent string: ${errorMsg}`);
            });
        }
        else {
            let browserUserAgent = await this.browserObj.userAgent();
            await pageObj.setUserAgent(`${browserUserAgent} websiteBench/${this.configObj.versionNum}`).catch(errorMsg => {
                this.logObj.error(`Unable to set User-Agent string: ${errorMsg}`);
            });
        }
        pageObj.setDefaultTimeout(reqTimeout * 1000);
        pageObj.on('console', eventObj => this.eventTriggered(eventObj));
        pageObj.on('dialog', eventObj => this.eventTriggered(eventObj));
        pageObj.on('requestfailed', requestObj => this.errorTriggered(requestObj, websiteEntry));
        for (let runCount = 0; runCount < this.numOfRetries; runCount++) {
            this.logObj.debug(`Starting performance data collection for ${webUrl} (Run: ${runCount})...`);
            const httpResponse = await pageObj.goto(webUrl, { waitUntil: 'networkidle0' }).catch(errorMsg => {
                this.logObj.error(`An error occured during "Page Goto" => ${errorMsg}`);
            });
            if (!httpResponse)
                return;
            const perfElementHandler = await pageObj.$('pageData').catch(errorMsg => {
                this.logObj.error(`An error occured during "Performance Element Handling" => ${errorMsg}`);
            });
            if (typeof perfElementHandler !== 'object')
                return;
            const perfJson = await pageObj.evaluate(pageData => {
                return JSON.stringify(performance.getEntriesByType('navigation'));
            }, perfElementHandler).catch(errorMsg => {
                this.logObj.error(`An error occured "Page evaluation" => ${errorMsg}`);
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
            this.logObj.debug(`Completed performance data collection for ${webUrl} (Run: ${runCount})...`);
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
