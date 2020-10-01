interface IWebsiteBenchConfig {
    websiteList?: Array<IWebsiteEntry>;
    influxDb?: IInfluxDbConfig;
    allowCaching?: boolean;
    userAgent?: string;
    logLevel?: 'silly' | 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    maxConcurrentJobs?: number;
}
interface IWebsiteEntry {
    siteName: string;
    siteUrl: string;
    checkInterval: number;
}
interface IInfluxDbConfig {
    hostname: string;
    port: number;
    database: string;
    path?: string;
    protocol?: 'http' | 'https';
    ignoressl?: boolean;
    credentials: IUserCredentials;
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
    downloadTime: number;
    domIntTime: number;
    domContentTime: number;
    domCompleteTime: number;
}
interface IConfigError {
    hasError: boolean;
    errorProperty?: string;
    errorMessage?: string;
}
export { IWebsiteBenchConfig, IWebsiteEntry, IInfluxDbConfig, IUserCredentials, IPerformanceData, IConfigError };
//# sourceMappingURL=websiteBenchInterfaces.d.ts.map