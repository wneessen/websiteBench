import { EventEmitter } from 'events';
import { InfluxDB } from 'influx';
import WebsiteBenchBrowser from './websiteBenchBrowser';
import { IPerformanceData, IWebsiteBenchConfig, IWebsiteEntry } from './websiteBenchInterfaces';
import WebsiteBenchTools from './websiteBenchTools';

export default class WebsiteBenchEvents extends EventEmitter {
    private configObj: IWebsiteBenchConfig = null;
    private influxDbClient: InfluxDB = null;
    private _browserObj: WebsiteBenchBrowser = null;
    private toolsObj = new WebsiteBenchTools();
    private currentlyRunning: number = 0;

    constructor(configObj: IWebsiteBenchConfig, influxDbClient: InfluxDB) {
        super();
        this.configObj = configObj;
        this.influxDbClient = influxDbClient;
    }

    public set browserObj(browserObj: WebsiteBenchBrowser) {
        this._browserObj = browserObj;
    }
    
    public get browserObj() {
        return this._browserObj;
    }

    scheduleSiteCheck(websiteObj: IWebsiteEntry) {
        if(this.eventNames().includes(websiteObj.siteUrl)) {
            console.warn(`${websiteObj.siteUrl} already scheduled. Not scheduling a second time.`);
            return;
        }
        this.on(websiteObj.siteName, () => setImmediate(() => {
            this.checkSite(websiteObj)}
        ));
        setInterval(() => this.emit(websiteObj.siteName), websiteObj.checkInterval * 1000);
        setTimeout(() => this.emit(websiteObj.siteName), this.toolsObj.getRandNum(10000));
    }

    private async checkSite(websiteEntry: IWebsiteEntry) {
        console.log(`Cheking ${websiteEntry.siteName}`);
        if(this.currentlyRunning >= this.configObj.maxConcurrentJobs) {
            console.log('Max amount of concurrent jobs running. Delaying current job.');
            return setTimeout(() => this.emit(websiteEntry.siteName), 5000);
        }
        console.log(this.currentlyRunning);
        this.currentlyRunning++;
        setTimeout(async () => {
            console.log('Executing test...')
            let perfJson = await this._browserObj.processPage(websiteEntry);
            this.currentlyRunning--;
            this.sendDataToInflux(websiteEntry, perfJson);
        }, this.toolsObj.getRandNum(10000));
    }

    private async sendDataToInflux(websiteEntry: IWebsiteEntry, perfJson: IPerformanceData) {
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