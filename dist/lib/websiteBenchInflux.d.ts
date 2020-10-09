import { IWebsiteBenchConfig } from './websiteBenchInterfaces';
import { Logger } from 'tslog';
import * as nodeInfluxClientObj from 'influx';
export default class WebsiteBenchInflux {
    private _configObj;
    private _logObj;
    private _influxClient1;
    private _influxClient2;
    private _bucketsApi;
    private _writeApi;
    private _influxLib;
    constructor(confObj: IWebsiteBenchConfig, logObj: Logger);
    checkConnection(): Promise<boolean>;
    writePoints(dataPoints: Array<nodeInfluxClientObj.IPoint>): Promise<boolean>;
    private writePointsV1;
    private writePointsV2;
}
//# sourceMappingURL=websiteBenchInflux.d.ts.map