import { IWebsiteBenchConfig } from './websiteBenchInterfaces';
import { Logger } from 'tslog';
export default class WebsiteBenchConfig {
    private _configObj;
    private _versionNum;
    private _defaultUserAgent;
    private _allowCaching;
    private _maxConcurrentJobs;
    private _minCheckInterval;
    private logObj;
    constructor(confFile: string, secretsFile: string, logObj: Logger);
    configObj(): IWebsiteBenchConfig;
    private checkMandatory;
    private checkConfig;
    private readConfig;
}
//# sourceMappingURL=websiteBenchConfig.d.ts.map