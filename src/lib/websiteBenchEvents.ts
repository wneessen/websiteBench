import WebsiteBenchBrowser from './websiteBenchBrowser';
import WebsiteBenchTools from './websiteBenchTools';
import { IPerformanceData, IWebsiteBenchConfig, IWebsiteEntry } from './websiteBenchInterfaces';
import { EventEmitter } from 'events';
import { InfluxDB } from 'influx';
import { Logger } from 'tslog';

export default class WebsiteBenchEvents extends EventEmitter {
    private _configObj: IWebsiteBenchConfig = null;
    private _influxDbClient: InfluxDB = null;
    private _browserObj: WebsiteBenchBrowser = null;
    private _toolsObj = new WebsiteBenchTools();
    private _currentlyRunning: number = 0;
    private logObj: Logger = null;

    /**
     * Constructor
     *
     * @constructor
     * @extends EventEmitter
     * @memberof WebsiteBenchEvents
    */
    constructor(configObj: IWebsiteBenchConfig, influxDbClient: InfluxDB, logObj: Logger) {
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

        // Set the eventlistener
        this.logObj.debug(`Adding EventListener for Site "${websiteObj.siteName}`);
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

        // Check if the max. amount of concurrent jobs is already reached
        if(this._currentlyRunning >= this._configObj.maxConcurrentJobs) {
            this.logObj.debug(`Maximum of concurrent jobs is reached. Rescheduling job by ${(randDelay / 1000).toFixed(3)} seconds...`);
            return setTimeout(() => {
                this.emit(websiteEntry.siteName)
            }, randDelay);
        }

        this._currentlyRunning++;
        setTimeout(async () => {
            this.logObj.debug(`Executing perfomance check for site: ${websiteEntry.siteName}`);
            let perfJson = await this._browserObj.processPage(websiteEntry);
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