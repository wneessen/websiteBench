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
    logLevel?: 'silly'|'trace'|'debug'|'info'|'warn'|'error'|'fatal',
    maxConcurrentJobs?: number,
}

/**
 * Website List entry object
 *
 * @interface IWebsiteEntry
*/
interface IWebsiteEntry {
    siteName: string,
    siteUrl: string,
    checkInterval: number
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
    credentials: IUserCredentials
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
    downloadTime: number,
    domIntTime: number,
    domContentTime: number,
    domCompleteTime: number
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

// Exports
export { IWebsiteBenchConfig, IWebsiteEntry, IInfluxDbConfig, IUserCredentials, IPerformanceData, IConfigError }