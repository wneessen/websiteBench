import Puppeteer from 'puppeteer';

/******************************************************************************
* Interfaces and declarations
******************************************************************************/
/**
 * WebsiteBench Config object
 *
 * @interface IWebsiteBenchConfig
*/
interface IWebsiteBenchConfig {
    websiteList?: Array<IWebsiteEntry>,
    influxDb?: IInfluxDbConfig,
    allowCaching?: boolean,
    userAgent?: string,
    logResErrors?: boolean,
    maxConcurrentJobs?: number,
    versionNum?: string,
    instanceName?: string,
    ignoreSslErrors?: boolean,
    pupLaunchOptions?: Puppeteer.LaunchOptions,
    logLevel?: 'silly'|'trace'|'debug'|'info'|'warn'|'error'|'fatal',
}

/**
 * Website List entry object
 *
 * @interface IWebsiteEntry
*/
interface IWebsiteEntry {
    siteName: string,
    siteUrl: string,
    checkInterval: number,
    checkType?: "curl"|"browser"
}

/**
 * InfluxDB config object
 *
 * @interface IInfluxDbConfig
*/
interface IInfluxDbConfig {
    hostname: string,
    port: number,
    database: string
    path?: string,
    protocol?: 'http'|'https',
    ignoressl?: boolean,
    username?: string,
    password?: string,
    token?: string,
    version?: number,
    organization?: string,
    authmethod?: "token"|"userpass"
}

/**
 * User credentials object
 *
 * @interface IUserCredentials
*/
interface IUserCredentials {
    username: string,
    password: string
}

/**
 * HTTP performance data
 *
 * @interface IPerformanceData
*/
interface IPerformanceData {
    totalDurTime: number,
    dnsTime: number,
    connectTime: number,
    ttfbTime: number,
    downloadTime?: number,
    domIntTime?: number,
    domContentTime?: number,
    domCompleteTime?: number,
    tlsHandshake?: number,
    preTransfer?: number,
    statusCode?: number,
    statusCodes?: Array<number>,
    statusCodesString?: string,
    runNumber?: number
}

/**
 * Config error
 *
 * @interface IConfigError
*/
interface IConfigError {
    hasError: boolean,
    errorProperty?: string,
    errorMessage?: string
}

/**
 * Config files object
 *
 * @interface IConfigFiles
*/
interface IConfigFiles {
    configFile: string,
    secretsFile: string
}

// Exports
export { IWebsiteBenchConfig, IWebsiteEntry, IInfluxDbConfig, IUserCredentials, IPerformanceData, IConfigError, IConfigFiles }