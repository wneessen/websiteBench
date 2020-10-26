import Puppeteer from 'puppeteer';
interface IWebsiteBenchConfig {
    websiteList?: Array<IWebsiteEntry>;
    influxDb?: IInfluxDbConfig;
    allowCaching?: boolean;
    userAgent?: string;
    logResErrors?: boolean;
    maxConcurrentJobs?: number;
    versionNum?: string;
    instanceName?: string;
    ignoreSslErrors?: boolean;
    pupLaunchOptions?: Puppeteer.LaunchOptions;
    logLevel?: 'silly' | 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}
interface IWebsiteEntry {
    siteName: string;
    siteUrl: string;
    checkInterval: number;
    isDisabled: boolean;
    checkType?: "curl" | "browser";
}
interface IInfluxDbConfig {
    hostname: string;
    port: number;
    database: string;
    path?: string;
    protocol?: 'http' | 'https';
    ignoressl?: boolean;
    username?: string;
    password?: string;
    token?: string;
    version?: number;
    organization?: string;
    authmethod?: "token" | "userpass";
}
interface IUserCredentials {
    username: string;
    password: string;
}
interface IPerformanceData {
    totalDurTime: number;
    dnsTime: number;
    connectTime: number;
    ttfbTime: number;
    downloadTime?: number;
    domIntTime?: number;
    domContentTime?: number;
    domCompleteTime?: number;
    tlsHandshake?: number;
    preTransfer?: number;
    statusCode?: number;
    redirectTime?: number;
    redirectCount?: number;
    initiatorType?: string;
    transferSize?: number;
    encodedBodySize?: number;
    decodedBodySize?: number;
    startTime?: number;
    resourceName?: string;
    entryType?: string;
    errorText?: string;
}
interface IConfigError {
    hasError: boolean;
    errorProperty?: string;
    errorMessage?: string;
}
interface IConfigFiles {
    configFile: string;
    secretsFile: string;
}
interface IBrowserPerfReturn {
    resourcePerfData: Array<IPerformanceData>;
    perfData: IPerformanceData;
}
interface IObjectLiteral {
    [key: string]: any;
}
export { IWebsiteBenchConfig, IWebsiteEntry, IInfluxDbConfig, IUserCredentials, IPerformanceData, IConfigError, IConfigFiles, IBrowserPerfReturn, IObjectLiteral };
//# sourceMappingURL=websiteBenchInterfaces.d.ts.map