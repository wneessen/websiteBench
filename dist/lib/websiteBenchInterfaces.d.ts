interface IWebsiteBenchConfig {
    websiteList?: Array<IWebsiteEntry>;
    influxDb?: IInfluxDbConfig;
    allowCaching?: boolean;
    userAgent?: string;
    logResErrors?: boolean;
    maxConcurrentJobs?: number;
    versionNum?: string;
    logLevel?: 'silly' | 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
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
    username?: string;
    password?: string;
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
interface IConfigFiles {
    configFile: string;
    secretsFile: string;
}
export { IWebsiteBenchConfig, IWebsiteEntry, IInfluxDbConfig, IUserCredentials, IPerformanceData, IConfigError, IConfigFiles };
//# sourceMappingURL=websiteBenchInterfaces.d.ts.map