"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const websiteBenchTools_1 = __importDefault(require("./websiteBenchTools"));
class WebsiteBenchBrowser {
    constructor(browserObj, configObj) {
        this.toolsObj = new websiteBenchTools_1.default();
        this.numOfRetries = 3;
        this.browserObj = browserObj;
        this.configObj = configObj;
    }
    async processPage(websiteEntry) {
        const webUrl = websiteEntry.siteUrl;
        const reqTimeout = websiteEntry.checkInterval - 1;
        let perfData = null;
        this.browserCtx = await this.browserObj.createIncognitoBrowserContext();
        const pageObj = this.configObj.allowCaching === true ? await this.browserObj.newPage() : await this.browserCtx.newPage();
        await pageObj.setUserAgent(this.configObj.userAgent).catch(errorMsg => {
            console.error(`Unable to set User-Agent string: ${errorMsg}`);
        });
        await pageObj.setDefaultTimeout(reqTimeout * 1000);
        pageObj.on('console', eventObj => this.eventTriggered(eventObj));
        pageObj.on('dialog', eventObj => this.eventTriggered(eventObj));
        pageObj.on('requestfailed', requestObj => this.errorTriggered(requestObj));
        let perfDataTotal = {
            totalDurTime: 0,
            connectTime: 0,
            dnsTime: 0,
            ttfbTime: 0,
            downloadTime: 0,
            domIntTime: 0,
            domContentTime: 0,
            domCompleteTime: 0,
        };
        for (let runCount = 0; runCount < this.numOfRetries; runCount++) {
            console.log(`Collecting performance data - Run no. ${runCount}`);
            const httpResponse = await pageObj.goto(webUrl, { waitUntil: 'networkidle0' }).catch(errorMsg => {
                console.error(`An error occured during "Page Goto" => ${errorMsg}`);
            });
            if (!httpResponse)
                return;
            const perfElementHandler = await pageObj.$('pageData').catch(errorMsg => {
                console.error(`An error occured during "Performance Element Handling" => ${errorMsg}`);
            });
            if (typeof perfElementHandler !== 'object')
                return;
            const perfJson = await pageObj.evaluate(pageData => {
                return JSON.stringify(performance.getEntriesByType('navigation'));
            }, perfElementHandler).catch(errorMsg => {
                console.error(`An error occured "Page evaluation" => ${errorMsg}`);
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
        console.log('Commulative perf data:');
        console.log(perfData);
        return perfData;
    }
    async eventTriggered(eventObj) {
        if (this.toolsObj.eventIsDialog(eventObj)) {
            eventObj.dismiss();
        }
    }
    async errorTriggered(requestObj) {
        console.error(`Unable to load resource URL => ${requestObj.url()}`);
        console.error(`Request failed with an "${requestObj.failure().errorText}" error`);
        if (requestObj.response()) {
            console.error(`Resulting status: ${requestObj.response().status()} ${requestObj.response().statusText()}`);
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
