import WebsiteBenchBrowser from './websiteBenchBrowser';
import WebsiteBenchTools from './websiteBenchTools';
import { IPerformanceData, IWebsiteBenchConfig, IWebsiteEntry, IObjectLiteral } from './websiteBenchInterfaces';
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
                const additionalTags: IObjectLiteral = Object.assign({
                    checkType: 'cURL',
                })
                const startTime = Date.now();
                perfJson = await this._browserObj.processPageWithCurl(websiteEntry);
                additionalTags.url = websiteEntry.siteUrl;
                additionalTags.resource_type = 'navigation';
                const processingTime = Date.now() - startTime;
                this.logObj.debug(`Performance check completed in ${processingTime / 1000} seconds`);
                
                // Send successfully gathered data to InfluxDB
                this.sendDataToInflux(websiteEntry, perfJson, additionalTags);
            }
            else {
                const additionalTags: IObjectLiteral = Object.assign({
                    checkType: 'browser',
                })
                const startTime = Date.now();
                const perfObj = await this._browserObj.processPageWithBrowser(websiteEntry);
                
                // Navigation page first
                if('perfData' in perfObj && typeof perfObj.perfData !== 'undefined' && perfObj.perfData !== null) {
                    perfJson = perfObj.perfData;
                    this.sendDataToInflux(websiteEntry, perfJson, additionalTags);
                }
                else {
                    this.logObj.warn('Request did not return any performance data. Not sending to InfluxDB');
                }

                // Resource data next
                if('resourcePerfData' in perfObj && typeof perfObj.resourcePerfData !== 'undefined' && perfObj.resourcePerfData !== null) {
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

    /**
     * Send performance data to InfluxDB server
     *
     * @param {IWebsiteEntry} websiteObj The website entry for the event
     * @param {IPerformanceData} perfJson The gathered performance data
     * @returns {void}
     * @memberof WebsiteBenchEvents
    */
    private async sendDataToInflux(websiteEntry: IWebsiteEntry, perfJson: IPerformanceData, additionalTags?: IObjectLiteral) {
        if(perfJson) {
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