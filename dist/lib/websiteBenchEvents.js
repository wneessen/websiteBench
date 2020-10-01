"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const websiteBenchTools_1 = __importDefault(require("./websiteBenchTools"));
class WebsiteBenchEvents extends events_1.EventEmitter {
    constructor(configObj, influxDbClient) {
        super();
        this.configObj = null;
        this.influxDbClient = null;
        this._browserObj = null;
        this.toolsObj = new websiteBenchTools_1.default();
        this.currentlyRunning = 0;
        this.configObj = configObj;
        this.influxDbClient = influxDbClient;
    }
    set browserObj(browserObj) {
        this._browserObj = browserObj;
    }
    get browserObj() {
        return this._browserObj;
    }
    scheduleSiteCheck(websiteObj) {
        if (this.eventNames().includes(websiteObj.siteUrl)) {
            console.warn(`${websiteObj.siteUrl} already scheduled. Not scheduling a second time.`);
            return;
        }
        this.on(websiteObj.siteName, () => setImmediate(() => {
            this.checkSite(websiteObj);
        }));
        setInterval(() => this.emit(websiteObj.siteName), websiteObj.checkInterval * 1000);
        setTimeout(() => this.emit(websiteObj.siteName), this.toolsObj.getRandNum(10000));
    }
    async checkSite(websiteEntry) {
        console.log(`Cheking ${websiteEntry.siteName}`);
        if (this.currentlyRunning >= this.configObj.maxConcurrentJobs) {
            console.log('Max amount of concurrent jobs running. Delaying current job.');
            return setTimeout(() => this.emit(websiteEntry.siteName), 5000);
        }
        console.log(this.currentlyRunning);
        this.currentlyRunning++;
        setTimeout(async () => {
            console.log('Executing test...');
            let perfJson = await this._browserObj.processPage(websiteEntry);
            this.currentlyRunning--;
            this.sendDataToInflux(websiteEntry, perfJson);
        }, this.toolsObj.getRandNum(10000));
    }
    async sendDataToInflux(websiteEntry, perfJson) {
        this.influxDbClient.writePoints([
            {
                measurement: 'benchmark',
                tags: {
                    website: websiteEntry.siteName
                },
                fields: {
                    total: perfJson.totalDurTime,
                    dns: perfJson.dnsTime,
                    connect: perfJson.connectTime,
                    ttfb: perfJson.ttfbTime,
                    download: perfJson.downloadTime,
                    dom_int: perfJson.domIntTime,
                    dom_content: perfJson.domContentTime,
                    dom_complete: perfJson.domCompleteTime
                }
            }
        ]);
    }
}
exports.default = WebsiteBenchEvents;
