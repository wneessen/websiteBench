/// <reference types="node" />
import WebsiteBenchBrowser from './websiteBenchBrowser';
import { IWebsiteBenchConfig, IWebsiteEntry } from './websiteBenchInterfaces';
import { EventEmitter } from 'events';
import { InfluxDB } from 'influx';
import { Logger } from 'tslog';
export default class WebsiteBenchEvents extends EventEmitter {
    private _configObj;
    private _influxDbClient;
    private _browserObj;
    private _toolsObj;
    private _currentlyRunning;
    private logObj;
    constructor(configObj: IWebsiteBenchConfig, influxDbClient: InfluxDB, logObj: Logger);
    set browserObj(browserObj: WebsiteBenchBrowser);
    get browserObj(): WebsiteBenchBrowser;
    scheduleSiteCheck(websiteObj: IWebsiteEntry): void;
    private checkSite;
    private sendDataToInflux;
}
//# sourceMappingURL=websiteBenchEvents.d.ts.map