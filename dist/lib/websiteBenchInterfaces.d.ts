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
    logLevel?: 'silly' | 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}
interface IWebsiteEntry {
    siteName: string;
    siteUrl: string;
    checkInterval: number;
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
    statusCodes?: Array<number>;
    statusCodesString?: string;
    runNumber?: number;
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