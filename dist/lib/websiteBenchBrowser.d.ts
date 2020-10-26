import { IWebsiteBenchConfig, IPerformanceData, IWebsiteEntry, IBrowserPerfReturn } from './websiteBenchInterfaces';
import { Logger } from 'tslog';
export default class WebsiteBenchBrowser {
    private browserObj;
    private browserCtx;
    private browserWsEndpoint;
    private configObj;
    private toolsObj;
    private logObj;
    private isBrowserNeeded;
    private isLaunching;
    private maxBrowserRestarts;
    private browserRestartCount;
    private restartInterval;
    private runningBrowserJobs;
    private isForcedRestart;
    constructor(configObj: IWebsiteBenchConfig, logObj: Logger, isBrowserNeeded: boolean);
    processPageWithBrowser(websiteEntry: IWebsiteEntry): Promise<IBrowserPerfReturn>;
    processPageWithCurl(websiteEntry: IWebsiteEntry): Promise<IPerformanceData>;
    private eventTriggered;
    private browserDisconnectEvent;
    private errorTriggered;
    private processPerformanceData;
    private processResourcePerformanceData;
    launchBrowser(): Promise<void>;
    browserIsReady(): boolean;
}
//# sourceMappingURL=websiteBenchBrowser.d.ts.map