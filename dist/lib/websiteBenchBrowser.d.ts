import Puppeteer from 'puppeteer';
import { IWebsiteBenchConfig, IPerformanceData, IWebsiteEntry } from './websiteBenchInterfaces';
import { Logger } from 'tslog';
export default class WebsiteBenchBrowser {
    private browserObj;
    private browserCtx;
    private configObj;
    private toolsObj;
    private logObj;
    private numOfRetries;
    constructor(browserObj: Puppeteer.Browser, configObj: IWebsiteBenchConfig, logObj: Logger);
    processPage(websiteEntry: IWebsiteEntry): Promise<IPerformanceData>;
    private eventTriggered;
    private errorTriggered;
    private processPerformanceData;
}
//# sourceMappingURL=websiteBenchBrowser.d.ts.map