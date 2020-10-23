import WebsiteBenchBrowser from './websiteBenchBrowser';
import WebsiteBenchTools from './websiteBenchTools';
import { IPerformanceData, IWebsiteBenchConfig, IWebsiteEntry } from './websiteBenchInterfaces';
import { EventEmitter } from 'events';
import { Logger } from 'tslog';
import WebsiteBenchInflux from './websiteBenchInflux';

export default class WebsiteBenchEvents extends EventEmitter {
    private _configObj: IWebsiteBenchConfig;
    private _influxDbClient: WebsiteBenchInflux;
    private _browserObj: WebsiteBenchBrowser;
    private _toolsObj = new WebsiteBenchTools();
    private _currentlyRunning: number = 0;
    private logObj: Logger;

    /**
     * Constructor
     *
     * @constructor
     * @extends EventEmitter
     * @memberof WebsiteBenchEvents
    */
    constructor(configObj: IWebsiteBenchConfig, influxDbClient: WebsiteBenchInflux, logObj: Logger) {
        super();
        this._configObj = configObj;
        this._influxDbClient = influxDbClient;
        this.logObj = logObj;
    }

    /**
     * Getter for the browserObj
     * 
     * @param {WebsiteBenchBrowser} browserObj Browser object to override the this._broswerObj
     * @returns {void}
     * @memberof WebsiteBenchEvents
    */
    public set browserObj(browserObj: WebsiteBenchBrowser) {
        this._browserObj = browserObj;
    }
    
    /**
     * Getter for the browserObj
     *
     * @returns {WebsiteBenchBrowser}
     * @memberof WebsiteBenchEvents
    */
    public get browserObj() {
        return this._browserObj;
    }

    /**
     * Schedule a new site checker event
     *
     * @param {IWebsiteEntry} websiteObj The website entry for the event
     * @returns {void}
     * @memberof WebsiteBenchEvents
    */
    public scheduleSiteCheck(websiteObj: IWebsiteEntry): void {
        if(this.eventNames().includes(websiteObj.siteUrl)) {
            this.logObj.warn(`${websiteObj.siteUrl} already scheduled. Not scheduling a second time.`);
            return;
        }
        
        if(websiteObj.isDisabled) {
            this.logObj.debug(`Website entry "${websiteObj.siteName} is set to disabled. Skipping.`);
            return;
        }

        // Set the eventlistener
        this.logObj.debug(`Adding EventListener for Site "${websiteObj.siteName}"`);
        this.addListener(websiteObj.siteName, () => {
            setImmediate(() => {
                this.checkSite(websiteObj);
            });
        });

        // Schedule the events given the configured checkInterval
        setInterval(() => {
            this.emit(websiteObj.siteName)
        }, (websiteObj.checkInterval * 1000));

        // Perform an initial execution of the event (delay by up to 5 seconds)
        setTimeout(() => {
            this.emit(websiteObj.siteName)
        }, this._toolsObj.getRandNum(5000));
    }

    /**
     * Schedule a new site checker event
     *
     * @param {IWebsiteEntry} websiteObj The website entry for the event
     * @returns {void}
     * @memberof WebsiteBenchEvents
    */
    private async checkSite(websiteEntry: IWebsiteEntry) {
        this.logObj.debug(`Initializing performance check for site: ${websiteEntry.siteName}`);
        const randDelay = (5000 + this._toolsObj.getRandNum(10000));
        const shortDelay = (2000 + this._toolsObj.getRandNum(5000));

        // Check if the browser is ready to accept requests
        if(websiteEntry.checkType !== 'curl' && !this.browserObj.browserIsReady()) {
            this.logObj.warn(`Browser is not ready yet. Delaying job by ${(randDelay / 1000).toFixed(3)} seconds...`);
            return setTimeout(() => {
                this.emit(websiteEntry.siteName)
            }, randDelay);
        }

        // Check if the max. amount of concurrent jobs is already reached
        if(this._currentlyRunning >= this._configObj.maxConcurrentJobs) {
            this.logObj.warn(`Maximum amount of concurrent jobs is reached. Delaying job by ${(randDelay / 1000).toFixed(3)} seconds...`);
            return setTimeout(() => {
                this.emit(websiteEntry.siteName)
            }, randDelay);
        }

        this._currentlyRunning++;
        setTimeout(async () => {
            let perfJson, perfResourceJson;
            let checkType = ('checkType' in websiteEntry && websiteEntry.checkType === 'curl') ? 'cURL' : 'Browser';
            this.logObj.debug(`Executing perfomance check for site: ${websiteEntry.siteName} (via ${checkType})`);
            if(checkType === 'cURL') {
                const startTime = Date.now();
                perfJson = await this._browserObj.processPageWithCurl(websiteEntry);
                const processingTime = Date.now() - startTime;
                this.logObj.debug(`Performance check completed in ${processingTime / 1000} seconds`);
            }
            else {
                const startTime = Date.now();
                const perfObj = await this._browserObj.processPageWithBrowser(websiteEntry);
                perfJson = perfObj.perfData;
                perfResourceJson = perfObj.resourcePerfData;
                const processingTime = Date.now() - startTime;
                this.logObj.debug(`Performance check completed in ${processingTime / 1000} seconds`);
            }
            this._currentlyRunning--;

            // Send successfully gathered data to InfluxDB
            this.sendDataToInflux(websiteEntry, perfJson);
        }, shortDelay);
    }

    /**
     * Send performance data to InfluxDB server
     *
     * @param {IWebsiteEntry} websiteObj The website entry for the event
     * @param {IPerformanceData} perfJson The gathered performance data
     * @returns {void}
     * @memberof WebsiteBenchEvents
    */
    private async sendDataToInflux(websiteEntry: IWebsiteEntry, perfJson: IPerformanceData) {
        if(perfJson) {
            await this._influxDbClient.writePoints([
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
                        statusCode: perfJson.statusCode ? perfJson.statusCode : -1,
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