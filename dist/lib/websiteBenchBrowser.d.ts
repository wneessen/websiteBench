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
    constructor(configObj: IWebsiteBenchConfig, logObj: Logger, browserObj?: Puppeteer.Browser);
    processPageWithBrowser(websiteEntry: IWebsiteEntry): Promise<IPerformanceData>;
    processPageWithCurl(websiteEntry: IWebsiteEntry): Promise<IPerformanceData>;
    private eventTriggered;
    private errorTriggered;
    private processPerformanceData;
}
//# sourceMappingURL=websiteBenchBrowser.d.ts.map