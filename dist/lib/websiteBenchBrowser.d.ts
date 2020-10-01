import Puppeteer from 'puppeteer';
import { IWebsiteBenchConfig, IPerformanceData, IWebsiteEntry } from './websiteBenchInterfaces';
export default class WebsiteBenchBrowser {
    private browserObj;
    private browserCtx;
    private configObj;
    private toolsObj;
    private numOfRetries;
    constructor(browserObj: Puppeteer.Browser, configObj: IWebsiteBenchConfig);
    processPage(websiteEntry: IWebsiteEntry): Promise<IPerformanceData>;
    private eventTriggered;
    private errorTriggered;
    private processPerformanceData;
}
//# sourceMappingURL=websiteBenchBrowser.d.ts.map