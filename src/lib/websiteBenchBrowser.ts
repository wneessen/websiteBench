import Puppeteer from 'puppeteer';
import { Curl } from 'node-libcurl';
import WebsiteBenchTools from './websiteBenchTools';
import { IWebsiteBenchConfig, IPerformanceData, IWebsiteEntry } from './websiteBenchInterfaces';
import { Logger } from 'tslog';
import * as qObj from 'q'

export default class WebsiteBenchBrowser {
    private browserObj: Puppeteer.Browser;
    private browserCtx: Puppeteer.BrowserContext;
    private browserWsEndpoint: string;
    private configObj: IWebsiteBenchConfig;
    private toolsObj = new WebsiteBenchTools();
    private logObj: Logger = null;
    private numOfRetries = 3;
    private isBrowserNeeded = false;
    private isLaunching = false;
    private maxBrowserRestarts = 5;
    private browserRestartCount = 0;
    
    /**
     * Constructor
     *
     * @constructor
     * @memberof WebsiteBenchBrowser
    */
    constructor(configObj: IWebsiteBenchConfig, logObj: Logger, isBrowserNeeded: boolean) {
        this.configObj  = configObj;
        this.logObj = logObj;
        this.isBrowserNeeded = isBrowserNeeded;

    }

    /**
     * Perform the web request and process the page
     *
     * @returns {Promise<void>}
     * @memberof WebsiteBenchBrowser
    */
    public async processPageWithBrowser(websiteEntry: IWebsiteEntry): Promise<IPerformanceData> {
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
        if(!this.browserIsReady()) return;

        // Initialize Webbrowser page object (Incognito or not)
        this.browserCtx = await this.browserObj.createIncognitoBrowserContext().catch(errorObj => {
            this.logObj.error(`Unable to create browser context: ${errorObj.message}`);
            return null;
        });
        if(this.browserCtx === null) return;
        const pageObj: Puppeteer.Page = this.configObj.allowCaching === true ?
            await this.browserObj.newPage().catch(errorObj => {
                this.logObj.error(`Failed to create new page in browser: ${errorObj.message}`);
                return null;
            }) :
            await this.browserCtx.newPage().catch(errorObj => {
                this.logObj.error(`Failed to create new page in browser: ${errorObj.message}`);
                return null;
            })
        if(pageObj === null) return;

        // Set User-Agent
        if(this.configObj.userAgent) {
            await pageObj.setUserAgent(this.configObj.userAgent).catch(errorMsg => {
                this.logObj.error(`[Browser] Unable to set User-Agent string: ${errorMsg}`);
            });
        }
        else {
            let browserUserAgent = await this.browserObj.userAgent();
            await pageObj.setUserAgent(`${browserUserAgent} websiteBench/${this.configObj.versionNum}`).catch(errorMsg => {
                this.logObj.error(`[Browser] Unable to set User-Agent string: ${errorMsg}`);
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
            this.logObj.debug(`[Browser] Starting performance data collection for ${webUrl} (Run: ${runCount + 1})...`)
            const httpResponse = await pageObj.goto(webUrl, { waitUntil: 'networkidle0' }).catch(errorMsg => {
                this.logObj.error(`[Browser] An error occured during "Page Goto" => ${errorMsg}`)
            });
            if(!httpResponse) return;

            // Evaluate the page (with or without performance data)
            const perfElementHandler = await pageObj.$('pageData').catch(errorMsg => {
                this.logObj.error(`[Browser] An error occured during "Performance Element Handling" => ${errorMsg}`);
            });
            if(typeof perfElementHandler !== 'object') return;
            const perfJson = await pageObj.evaluate(pageData => {
                return JSON.stringify(performance.getEntriesByType('navigation'));
            }, perfElementHandler).catch(errorMsg => {
                this.logObj.error(`[Browser] An error occured "Page evaluation" => ${errorMsg}`)
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
            this.logObj.debug(`[Browser] Completed performance data collection for ${webUrl} (Run: ${runCount + 1})...`);
        
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
        this.browserRestartCount = 0;
        return perfData;
    }

    /**
     * Perform the web request and process the page
     *
     * @returns {Promise<void>}
     * @memberof WebsiteBenchBrowser
    */
    public async processPageWithCurl(websiteEntry: IWebsiteEntry): Promise<IPerformanceData> {
        return new Promise((retFunc, rejFunc) => {
            const webUrl = websiteEntry.siteUrl;
            const reqTimeout = websiteEntry.checkInterval - 1;
            const promiseArray: Array<qObj.Promise<IPerformanceData>> = [];
            
            let userAgent;
            let perfData: IPerformanceData = null;
            const perfDataTotal: IPerformanceData = {
                totalDurTime: 0,
                connectTime: 0,
                dnsTime: 0,
                ttfbTime: 0,
                preTransfer: 0,
                tlsHandshake: 0,
                statusCode: 0,
                statusCodes: []
            };
            
            // Set User-Agent
            if(this.configObj.userAgent) {
                userAgent = this.configObj.userAgent;
            }
            else {
                let browserUserAgent = Curl.defaultUserAgent;
                userAgent = `${browserUserAgent} websiteBench/${this.configObj.versionNum}`;
            }
            
            // Open the website for number of retries
            for(let runCount = 0; runCount < this.numOfRetries; runCount++) {
                this.logObj.debug(`[cURL] Starting performance data collection for ${webUrl} (Run: ${runCount + 1})...`)
                const deferObj = qObj.defer();
                const curlObj = new Curl();
                curlObj.setOpt('URL', webUrl);
                curlObj.setOpt('TIMEOUT', reqTimeout);
                curlObj.setOpt('USERAGENT', userAgent);
                curlObj.setOpt('DNS_SHUFFLE_ADDRESSES', true);
                curlObj.setOpt('SSL_VERIFYHOST', this.configObj.ignoreSslErrors === true ? false : true);
                
                curlObj.on('end', (statusCode, resData, resHeader, curlInstance) => {
                    const tempPerf: IPerformanceData = {
                        runNumber: runCount,
                        totalDurTime: curlInstance.getInfo('TOTAL_TIME_T') as number / 1000,
                        dnsTime: curlInstance.getInfo('NAMELOOKUP_TIME_T') as number / 1000,
                        tlsHandshake: curlInstance.getInfo('APPCONNECT_TIME_T') as number / 1000,
                        ttfbTime: curlInstance.getInfo('STARTTRANSFER_TIME_T') as number / 1000,
                        preTransfer: curlInstance.getInfo('PRETRANSFER_TIME_T') as number / 1000,
                        connectTime: curlInstance.getInfo('CONNECT_TIME_T') as number / 1000,
                        statusCode: statusCode
                    }
                    deferObj.resolve(tempPerf);
                    curlInstance.close();
                });
                curlObj.on('error', (errorObj) => {
                    this.logObj.error(`Unable to fetch page via cURL: ${errorObj.message}`)
                    this.logObj.debug(`[cURL] Completed performance data collection with error for ${webUrl} (Run: ${runCount + 1})...`);
                })
                curlObj.perform();
                promiseArray.push(deferObj.promise as qObj.Promise<IPerformanceData>);
            }
            
            // Resolve the promises
            qObj.all(promiseArray).then(resPromise => {
                resPromise.forEach(curlPromise => {
                    perfDataTotal.totalDurTime += curlPromise.totalDurTime;
                    perfDataTotal.connectTime += curlPromise.connectTime;
                    perfDataTotal.dnsTime += curlPromise.dnsTime;
                    perfDataTotal.ttfbTime += curlPromise.ttfbTime;
                    perfDataTotal.tlsHandshake += curlPromise.tlsHandshake;
                    perfDataTotal.preTransfer += curlPromise.preTransfer;
                    perfDataTotal.statusCodes.push(curlPromise.statusCode);
                    this.logObj.debug(`[cURL] Completed performance data collection for ${webUrl} (Run: ${curlPromise.runNumber})...`);
                })
            }).finally(() => {
                perfData = {
                    totalDurTime: (perfDataTotal.totalDurTime / this.numOfRetries),
                    connectTime: (perfDataTotal.connectTime / this.numOfRetries),
                    dnsTime: (perfDataTotal.dnsTime / this.numOfRetries),
                    ttfbTime: (perfDataTotal.ttfbTime / this.numOfRetries),
                    tlsHandshake: (perfDataTotal.tlsHandshake / this.numOfRetries),
                    preTransfer: (perfDataTotal.preTransfer / this.numOfRetries),
                };
                perfData.statusCodesString = perfDataTotal.statusCodes.join(':');
                
                // Finalize response data
                retFunc(perfData);
            });
        })
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
     * Eventhandler for when the browser disconnects
     *
     * @param  eventObj The Puppeteer event object
     * @returns {Promise<void>}
     * @memberof WebsiteBenchBrowser
    */
    private async browserDisconnectEvent(): Promise<void> {
        this.logObj.error('The browser got disconnected. Trying to reconnect...');
        this.browserObj = await Puppeteer.connect({browserWSEndpoint: this.browserWsEndpoint}).catch(errorObj => {
            this.logObj.error(`Reconnect failed: ${errorObj.message}. Trying to restart browser...`);
            return null;
        });
        if(this.browserObj === null || !this.browserObj.isConnected()) {
            await this.launchBrowser().catch(errorObj => {
                this.logObj.error(`Unable to restart browser: ${errorObj.message}. Quitting.`);
                process.exit(1);
            });
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
    
    /**
     * Launch the browser
     *
     * @returns {Promise<void>}
     * @memberof WebsiteBenchBrowser
    */
    public async launchBrowser() {
        if(this.browserRestartCount >= this.maxBrowserRestarts) {
            this.logObj.error(`Maximum amount of browser restarts w/o successful querying reached. Quitting`);
            process.exit(1);
        }
        if(this.isBrowserNeeded) {
            this.isLaunching = true;
            await Puppeteer.launch(this.configObj.pupLaunchOptions).catch(errorMsg => {
                this.logObj.error(`Unable to start Browser: ${errorMsg}`);
            }).then(newBrowser => {
                if(typeof newBrowser !== 'undefined' && newBrowser !== null) {
                    this.browserObj = newBrowser;
                    this.browserWsEndpoint = this.browserObj.wsEndpoint();
                    this.browserObj.on('disconnected', () => this.browserDisconnectEvent());
                    this.isLaunching = false;
                    this.browserRestartCount++;
                }
            });

            if(typeof this.browserObj === 'undefined' || this.browserObj === null || !this.browserObj.isConnected()) {
                this.logObj.error('Could not start browser. Quitting.');
                process.exit(1);
            }
        }
    }
    
    /**
     * Is the browser ready?
     *
     * @returns {boolean}
     * @memberof WebsiteBenchBrowser
    */
    public browserIsReady() {
        if(this.isLaunching === true || !this.browserObj.isConnected()) {
            return false;
        }

        return true;
    }
}