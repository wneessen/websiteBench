"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const websiteBenchTools_1 = __importDefault(require("./websiteBenchTools"));
const events_1 = require("events");
class WebsiteBenchEvents extends events_1.EventEmitter {
    constructor(configObj, influxDbClient, logObj) {
        super();
        this._configObj = null;
        this._influxDbClient = null;
        this._browserObj = null;
        this._toolsObj = new websiteBenchTools_1.default();
        this._currentlyRunning = 0;
        this.logObj = null;
        this._configObj = configObj;
        this._influxDbClient = influxDbClient;
        this.logObj = logObj;
    }
    set browserObj(browserObj) {
        this._browserObj = browserObj;
    }
    get browserObj() {
        return this._browserObj;
    }
    scheduleSiteCheck(websiteObj) {
        if (this.eventNames().includes(websiteObj.siteUrl)) {
            this.logObj.warn(`${websiteObj.siteUrl} already scheduled. Not scheduling a second time.`);
            return;
        }
        this.logObj.debug(`Adding EventListener for Site "${websiteObj.siteName}`);
        this.addListener(websiteObj.siteName, () => {
            setImmediate(() => {
                this.checkSite(websiteObj);
            });
        });
        setInterval(() => {
            this.emit(websiteObj.siteName);
        }, (websiteObj.checkInterval * 1000));
        setTimeout(() => {
            this.emit(websiteObj.siteName);
        }, this._toolsObj.getRandNum(5000));
    }
    async checkSite(websiteEntry) {
        this.logObj.debug(`Initializing performance check for site: ${websiteEntry.siteName}`);
        const randDelay = (5000 + this._toolsObj.getRandNum(10000));
        const shortDelay = (2000 + this._toolsObj.getRandNum(5000));
        if (this._currentlyRunning >= this._configObj.maxConcurrentJobs) {
            this.logObj.debug(`Maximum of concurrent jobs is reached. Rescheduling job by ${(randDelay / 1000).toFixed(3)} seconds...`);
            return setTimeout(() => {
                this.emit(websiteEntry.siteName);
            }, randDelay);
        }
        this._currentlyRunning++;
        setTimeout(async () => {
            this.logObj.debug(`Executing perfomance check for site: ${websiteEntry.siteName}`);
            let perfJson = await this._browserObj.processPage(websiteEntry);
            this._currentlyRunning--;
            this.sendDataToInflux(websiteEntry, perfJson);
        }, shortDelay);
    }
    async sendDataToInflux(websiteEntry, perfJson) {
        if (perfJson) {
            this._influxDbClient.writePoints([
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
            ]).catch(errorObj => {
                this.logObj.error(`An error occured while sending performance data to InfluxDB server: ${errorObj}`);
            });
        }
        else {
            this.logObj.debug('Received empty performance data object. Cannot send data to InfluxDB');
        }
    }
}
exports.default = WebsiteBenchEvents;
