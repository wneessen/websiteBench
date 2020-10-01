/// <reference types="node" />
import { EventEmitter } from 'events';
import { InfluxDB } from 'influx';
import WebsiteBenchBrowser from './websiteBenchBrowser';
import { IWebsiteBenchConfig, IWebsiteEntry } from './websiteBenchInterfaces';
export default class WebsiteBenchEvents extends EventEmitter {
    private configObj;
    private influxDbClient;
    private _browserObj;
    private toolsObj;
    private currentlyRunning;
    constructor(configObj: IWebsiteBenchConfig, influxDbClient: InfluxDB);
    set browserObj(browserObj: WebsiteBenchBrowser);
    get browserObj(): WebsiteBenchBrowser;
    scheduleSiteCheck(websiteObj: IWebsiteEntry): void;
    private checkSite;
    private sendDataToInflux;
}
//# sourceMappingURL=websiteBenchEvents.d.ts.map