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
        this.logObj.debug(`Adding EventListener for Site "${websiteObj.siteName}"`);
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
            this.logObj.warn(`Maximum amount of concurrent jobs is reached. Delaying job by ${(randDelay / 1000).toFixed(3)} seconds...`);
            return setTimeout(() => {
                this.emit(websiteEntry.siteName);
            }, randDelay);
        }
        this._currentlyRunning++;
        setTimeout(async () => {
            let perfJson;
            let checkType = ('checkType' in websiteEntry && websiteEntry.checkType === 'curl') ? 'cURL' : 'Browser';
            this.logObj.debug(`Executing perfomance check for site: ${websiteEntry.siteName} (via ${checkType})`);
            if (checkType === 'cURL') {
                perfJson = await this._browserObj.processPageWithCurl(websiteEntry);
            }
            else {
                perfJson = await this._browserObj.processPageWithBrowser(websiteEntry);
            }
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
                        website: websiteEntry.siteName,
                        instance: this._configObj.instanceName,
                    },
                    fields: {
                        total: perfJson.totalDurTime ? perfJson.totalDurTime : -1,
                        dns: perfJson.dnsTime ? perfJson.dnsTime : -1,
                        connect: perfJson.connectTime ? perfJson.connectTime : -1,
                        ttfb: perfJson.ttfbTime ? perfJson.ttfbTime : -1,
                        download: perfJson.downloadTime ? perfJson.downloadTime : -1,
                        tlsHandshake: perfJson.tlsHandshake ? perfJson.tlsHandshake : -1,
                        preTransfer: perfJson.preTransfer ? perfJson.preTransfer : -1,
                        statusCodes: perfJson.statusCodesString ? perfJson.statusCodesString : '',
                        dom_int: perfJson.domIntTime ? perfJson.domIntTime : -1,
                        dom_content: perfJson.domContentTime ? perfJson.domContentTime : -1,
                        dom_complete: perfJson.domCompleteTime ? perfJson.domCompleteTime : -1
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
