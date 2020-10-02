import Puppeteer from 'puppeteer';
import WebsiteBenchTools from './websiteBenchTools';
import { IWebsiteBenchConfig, IPerformanceData, IWebsiteEntry } from './websiteBenchInterfaces';
import { Logger } from 'tslog';

export default class WebsiteBenchBrowser {
    private browserObj: Puppeteer.Browser;
    private browserCtx: Puppeteer.BrowserContext;
    private configObj: IWebsiteBenchConfig;
    private toolsObj = new WebsiteBenchTools();
    private logObj: Logger = null;
    private numOfRetries = 3;
    
    /**
     * Constructor
     *
     * @constructor
     * @memberof WebsiteBenchBrowser
    */
    constructor(browserObj: Puppeteer.Browser, configObj: IWebsiteBenchConfig, logObj: Logger) {
        this.browserObj = browserObj;
        this.configObj  = configObj;
        this.logObj = logObj;
    }

    /**
     * Perform the web request and process the page
     *
     * @returns {Promise<void>}
     * @memberof WebsiteBenchBrowser
    */
    public async processPage(websiteEntry: IWebsiteEntry): Promise<IPerformanceData> {
        const webUrl = websiteEntry.siteUrl;
        const reqTimeout = websiteEntry.checkInterval - 1;
        let perfData: IPerformanceData = null;
        const perfDataTotal: IPerformanceData = {
            totalDurTime: 0,
            connectTime: 0,
            dnsTime: 0,
            ttfbTime: 0,
            downloadTime: 0,
            domIntTime: 0,
            domContentTime: 0,
            domCompleteTime: 0,
        };


        // Initialize Webbrowser page object (Incognito or not)
        this.browserCtx = await this.browserObj.createIncognitoBrowserContext();
        const pageObj = this.configObj.allowCaching === true ? await this.browserObj.newPage() : await this.browserCtx.newPage();

        // Set User-Agent
        if(this.configObj.userAgent) {
            await pageObj.setUserAgent(this.configObj.userAgent).catch(errorMsg => {
                this.logObj.error(`Unable to set User-Agent string: ${errorMsg}`);
            });
        }
        else {
            let browserUserAgent = await this.browserObj.userAgent();
            await pageObj.setUserAgent(`${browserUserAgent} websiteBench/${this.configObj.versionNum}`).catch(errorMsg => {
                this.logObj.error(`Unable to set User-Agent string: ${errorMsg}`);
            });
        }

        // Set timeout
        pageObj.setDefaultTimeout(reqTimeout * 1000);
        
        // Assign event handler
        pageObj.on('console', eventObj => this.eventTriggered(eventObj));
        pageObj.on('dialog', eventObj => this.eventTriggered(eventObj));
        pageObj.on('requestfailed', requestObj => this.errorTriggered(requestObj, websiteEntry));

        // Open the website for number of retries
        for(let runCount = 0; runCount < this.numOfRetries; runCount++) {
            this.logObj.debug(`Starting performance data collection for ${webUrl} (Run: ${runCount})...`)
            const httpResponse = await pageObj.goto(webUrl, { waitUntil: 'networkidle0' }).catch(errorMsg => {
                this.logObj.error(`An error occured during "Page Goto" => ${errorMsg}`)
            });
            if(!httpResponse) return;

            // Evaluate the page (with or without performance data)
            const perfElementHandler = await pageObj.$('pageData').catch(errorMsg => {
                this.logObj.error(`An error occured during "Performance Element Handling" => ${errorMsg}`);
            });
            if(typeof perfElementHandler !== 'object') return;
            const perfJson = await pageObj.evaluate(pageData => {
                return JSON.stringify(performance.getEntriesByType('navigation'));
            }, perfElementHandler).catch(errorMsg => {
                this.logObj.error(`An error occured "Page evaluation" => ${errorMsg}`)
            });
            if(perfJson) {
                let tempPerf = this.processPerformanceData(perfJson);
                perfDataTotal.totalDurTime += tempPerf.totalDurTime;
                perfDataTotal.connectTime += tempPerf.connectTime;
                perfDataTotal.dnsTime += tempPerf.dnsTime;
                perfDataTotal.ttfbTime += tempPerf.ttfbTime;
                perfDataTotal.downloadTime += tempPerf.downloadTime;
                perfDataTotal.domIntTime += tempPerf.domIntTime;
                perfDataTotal.domContentTime += tempPerf.domContentTime;
                perfDataTotal.domCompleteTime += tempPerf.domCompleteTime;
            }
            this.logObj.debug(`Completed performance data collection for ${webUrl} (Run: ${runCount})...`);
        
        }
        
        // Close the page
        pageObj.close();

        // Calculate mean values of performance data
        perfData = {
            totalDurTime: (perfDataTotal.totalDurTime / this.numOfRetries),
            connectTime: (perfDataTotal.connectTime / this.numOfRetries),
            dnsTime: (perfDataTotal.dnsTime / this.numOfRetries),
            ttfbTime: (perfDataTotal.ttfbTime / this.numOfRetries),
            downloadTime: (perfDataTotal.downloadTime / this.numOfRetries),
            domIntTime: (perfDataTotal.domIntTime / this.numOfRetries),
            domContentTime: (perfDataTotal.domContentTime / this.numOfRetries),
            domCompleteTime: (perfDataTotal.domCompleteTime / this.numOfRetries)
        }

        // Finalize response data
        return perfData;
    }
    
    /**
     * Eventhandler for when an event in the website fired
     *
     * @param {Puppeteer.ConsoleMessage|Puppeteer.Dialog} eventObj The Puppeteer event object
     * @returns {Promise<void>}
     * @memberof WebsiteBenchBrowser
    */
    private async eventTriggered(eventObj: Puppeteer.ConsoleMessage | Puppeteer.Dialog): Promise<void> {
        if(this.toolsObj.eventIsDialog(eventObj)) {
            eventObj.dismiss();
        }
    }

    /**
     * Eventhandler for when an error in the website fired
     *
     * @param {Puppeteer.Request} requestObj The Puppeteer request object
     * @returns {Promise<void>}
     * @memberof WebsiteBenchBrowser
    */
    private async errorTriggered(requestObj: Puppeteer.Request, websiteEntry: IWebsiteEntry): Promise<void> {
        if(this.configObj.logResErrors === true) {
            this.logObj.error(`[${websiteEntry.siteName}] Unable to load resource URL => ${requestObj.url()}`);
            this.logObj.error(`[${websiteEntry.siteName}] Request failed with an "${requestObj.failure().errorText}" error`)
            if(requestObj.response()) {
                this.logObj.error(`[${websiteEntry.siteName}] Resulting status: ${requestObj.response().status()} ${requestObj.response().statusText()}`);
            }
        }
    }

    /**
     * Process the performance data into usable format
     *
     * @param {string} perfJson Stringified JSON data of the Performance object
     * @returns {IPerformanceData}
     * @memberof WebsiteBenchBrowser
    */
    private processPerformanceData(perfJson: string): IPerformanceData {
        let perfData = Object.assign({});
        let perfEntries = JSON.parse(perfJson);
        if(perfEntries !== null && perfEntries[0]) {
            let perfEntry = perfEntries[0] as PerformanceNavigationTiming;
            perfData.totalDurTime = perfEntry.duration;
            perfData.dnsTime = (perfEntry.domainLookupEnd - perfEntry.domainLookupStart);
            perfData.connectTime =(perfEntry.connectEnd - perfEntry.connectStart);
            perfData.ttfbTime = (perfEntry.responseStart - perfEntry.requestStart);
            perfData.downloadTime = (perfEntry.responseEnd - perfEntry.responseStart);
            perfData.domIntTime = (perfEntry.domInteractive - perfEntry.responseEnd);
            perfData.domContentTime = (perfEntry.domContentLoadedEventEnd - perfEntry.domContentLoadedEventStart);
            perfData.domCompleteTime = (perfEntry.domComplete - perfEntry.domContentLoadedEventEnd);
        }

        return perfData;
    }
}