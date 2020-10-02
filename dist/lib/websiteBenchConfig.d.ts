import { IWebsiteBenchConfig, IConfigFiles } from './websiteBenchInterfaces';
import { Logger } from 'tslog';
export default class WebsiteBenchConfig {
    private _configObj;
    private _versionNum;
    private _allowCaching;
    private _logResourceErrors;
    private _maxConcurrentJobs;
    private _minCheckInterval;
    private logObj;
    constructor(confFiles: IConfigFiles, logObj: Logger);
    configObj(): IWebsiteBenchConfig;
    private checkMandatory;
    private checkConfig;
    private readConfig;
}
//# sourceMappingURL=websiteBenchConfig.d.ts.map