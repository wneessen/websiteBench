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
        this._toolsObj = new websiteBenchTools_1.default();
        this._currentlyRunning = 0;
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
        if (websiteObj.isDisabled) {
            this.logObj.debug(`Website entry "${websiteObj.siteName} is set to disabled. Skipping.`);
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
        if (websiteEntry.checkType !== 'curl' && !this.browserObj.browserIsReady()) {
            this.logObj.warn(`Browser is not ready yet. Delaying job by ${(randDelay / 1000).toFixed(3)} seconds...`);
            return setTimeout(() => {
                this.emit(websiteEntry.siteName);
            }, randDelay);
        }
        if (this._currentlyRunning >= this._configObj.maxConcurrentJobs) {
            this.logObj.warn(`Maximum amount of concurrent jobs is reached. Delaying job by ${(randDelay / 1000).toFixed(3)} seconds...`);
            return setTimeout(() => {
                this.emit(websiteEntry.siteName);
            }, randDelay);
        }
        this._currentlyRunning++;
        setTimeout(async () => {
            let perfJson, perfResourceJson;
            let checkType = ('checkType' in websiteEntry && websiteEntry.checkType === 'curl') ? 'cURL' : 'Browser';
            this.logObj.debug(`Executing perfomance check for site: ${websiteEntry.siteName} (via ${checkType})`);
            if (checkType === 'cURL') {
                const additionalTags = Object.assign({
                    checkType: 'cURL',
                });
                const startTime = Date.now();
                perfJson = await this._browserObj.processPageWithCurl(websiteEntry);
                additionalTags.url = websiteEntry.siteUrl;
                additionalTags.resource_type = 'navigation';
                const processingTime = Date.now() - startTime;
                this.logObj.debug(`Performance check completed in ${processingTime / 1000} seconds`);
                this.sendDataToInflux(websiteEntry, perfJson, additionalTags);
            }
            else {
                const additionalTags = Object.assign({
                    checkType: 'browser',
                });
                const startTime = Date.now();
                const perfObj = await this._browserObj.processPageWithBrowser(websiteEntry);
                if ('perfData' in perfObj && typeof perfObj.perfData !== 'undefined' && perfObj.perfData !== null) {
                    perfJson = perfObj.perfData;
                    this.sendDataToInflux(websiteEntry, perfJson, additionalTags);
                }
                else {
                    this.logObj.warn('Request did not return any performance data. Not sending to InfluxDB');
                }
                if ('resourcePerfData' in perfObj && typeof perfObj.resourcePerfData !== 'undefined' && perfObj.resourcePerfData !== null) {
                    perfResourceJson = perfObj.resourcePerfData;
                    perfResourceJson.forEach(perfResource => {
                        this.sendDataToInflux(websiteEntry, perfResource, additionalTags);
                    });
                }
                else {
                    this.logObj.warn('Request did not return any resource performance data. Not sending to InfluxDB');
                }
                const processingTime = Date.now() - startTime;
                this.logObj.debug(`Performance check completed in ${processingTime / 1000} seconds`);
            }
            this._currentlyRunning--;
        }, shortDelay);
    }
    async sendDataToInflux(websiteEntry, perfJson, additionalTags) {
        if (perfJson) {
            await this._influxDbClient.writePoints([
                {
                    measurement: 'benchmark',
                    tags: {
                        website: websiteEntry.siteName,
                        instance: this._configObj.instanceName,
                        url: perfJson.resourceName,
                        initiator_type: perfJson.initiatorType ? perfJson.initiatorType : 'none',
                        resource_type: perfJson.entryType ? perfJson.entryType : '',
                        ...additionalTags
                    },
                    fields: {
                        total: perfJson.totalDurTime ? perfJson.totalDurTime : 0,
                        dns: perfJson.dnsTime ? perfJson.dnsTime : 0,
                        connect: perfJson.connectTime ? perfJson.connectTime : 0,
                        ttfb: perfJson.ttfbTime ? perfJson.ttfbTime : 0,
                        download: perfJson.downloadTime ? perfJson.downloadTime : 0,
                        tls_handshake: perfJson.tlsHandshake ? perfJson.tlsHandshake : 0,
                        pre_transfer: perfJson.preTransfer ? perfJson.preTransfer : 0,
                        status_code: perfJson.statusCode ? perfJson.statusCode : 0,
                        dom_int: perfJson.domIntTime ? perfJson.domIntTime : 0,
                        dom_content: perfJson.domContentTime ? perfJson.domContentTime : 0,
                        dom_complete: perfJson.domCompleteTime ? perfJson.domCompleteTime : 0,
                        transfer_size: perfJson.transferSize ? perfJson.transferSize : 0,
                        encoded_bodysize: perfJson.encodedBodySize ? perfJson.encodedBodySize : 0,
                        decoded_bodysize: perfJson.decodedBodySize ? perfJson.decodedBodySize : 0,
                        start_time: perfJson.startTime ? perfJson.startTime : 0,
                        redirect_count: perfJson.redirectCount ? perfJson.redirectCount : 0,
                        redirect_time: perfJson.redirectTime ? perfJson.redirectTime : 0,
                        error_text: perfJson.errorText ? perfJson.errorText : ''
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
