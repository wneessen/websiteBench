// websiteBench Config Class
import { IWebsiteBenchConfig } from './websiteBenchInterfaces';
import { exit } from 'process';
import { Logger } from 'tslog';
import * as influxDbClientObj from '@influxdata/influxdb-client'
import { BucketsAPI } from '@influxdata/influxdb-client-apis';
import * as nodeInfluxClientObj from 'influx';

export default class WebsiteBenchInflux {
    private _configObj: IWebsiteBenchConfig = {};
    private _logObj: Logger = null;
    private _influxClient1: nodeInfluxClientObj.InfluxDB;
    private _influxClient2: influxDbClientObj.InfluxDB;
    private _bucketsApi: BucketsAPI;
    private _writeApi: influxDbClientObj.WriteApi;
    private _influxLib: "v1" | "v2" = null;
    
    /**
     * Constructor
     *
     * @constructor
     * @memberof WebsiteBenchConfig
    */
    constructor(confObj: IWebsiteBenchConfig, logObj: Logger) {
        this._configObj = confObj;
        this._logObj = logObj;
        
        if(this._configObj.influxDb.authmethod.toLowerCase() === 'token') {
            const connUrl = (this._configObj.influxDb.protocol ? this._configObj.influxDb.protocol : 'http') + '://' +
                this._configObj.influxDb.hostname + ':' +
                (this._configObj.influxDb.port ? this._configObj.influxDb.port : '8086');
            this._influxClient2 = new influxDbClientObj.InfluxDB({
                url: connUrl,
                token: this._configObj.influxDb.token
            });
            this._bucketsApi = new BucketsAPI(this._influxClient2);
            this._writeApi = this._influxClient2.getWriteApi(this._configObj.influxDb.organization, this._configObj.influxDb.database);
            this._influxLib = 'v2';
        }
        else {
            this._influxClient1 = new nodeInfluxClientObj.InfluxDB({
                database: this._configObj.influxDb.database,
                username: this._configObj.influxDb.username,
                password: this._configObj.influxDb.password,
                hosts: [
                    {
                        host: this._configObj.influxDb.hostname,
                        port: (this._configObj.influxDb.port !== null ? this._configObj.influxDb.port : 8086),
                        path: (this._configObj.influxDb.path !== null ? this._configObj.influxDb.path : '/'),
                        protocol: (this._configObj.influxDb.protocol !== null ? this._configObj.influxDb.protocol : 'http'),
                        options: {
                            rejectUnauthorized: (this._configObj.influxDb.ignoressl === true ? false : true)
                        }
                    }
                ]
            });
            this._influxLib = 'v1';
        }
    }; 
    
    /**
     * Check if the influxdb connection is working 
     * This is done by checking if the given database is available on the server
     *
     * @returns {Promise<boolean>}
     * @memberof WebsiteBenchInflux
    */
    public async checkConnection(): Promise<boolean> {
        return new Promise(async (retFunc, rejFunc) => {
            if(this._influxLib === 'v1') {
                this._influxClient1.getDatabaseNames().then(dbNames => {
                    if(dbNames.indexOf(this._configObj.influxDb.database) === -1) {
                        rejFunc(new Error(`Database "${this._configObj.influxDb.database}" not found on InfluxDB server.`));
                    }
                    else {
                        retFunc(true);
                    }
                }).catch(errorMsg => {
                    rejFunc(errorMsg);
                });
            }
            else {
                this._bucketsApi.getBuckets({name: this._configObj.influxDb.database}).then(bucketObj => {
                    const thisBucket = bucketObj.buckets[0];
                    if(thisBucket.name === this._configObj.influxDb.database) {
                        retFunc(true);
                    }
                }).catch(errorObj => {
                    const errorBody = JSON.parse(errorObj.body);
                    rejFunc(errorBody);
                })
            }
        });
    }
    
    /**
     * Write data to the influxdb
     *
     * @returns {Promise<boolean>}
     * @memberof WebsiteBenchInflux
    */
    public async writePoints(dataPoints: Array<nodeInfluxClientObj.IPoint>): Promise<boolean> {
        return new Promise((retFunc, rejFunc) => {
            if(this._influxLib === 'v1') {
                this.writePointsV1(dataPoints).catch(errorObj => {
                    rejFunc(errorObj);
                }).then(() => retFunc(true));
            }
            else {
                this.writePointsV2(dataPoints).catch(errorObj => {
                    rejFunc(errorObj);
                }).then(() => retFunc(true));
            }
        })
    }
    
    /**
     * Write data to the influxdb
     *
     * @returns {Promise<boolean>}
     * @memberof WebsiteBenchInflux
    */
    private async writePointsV1(dataPoints: Array<nodeInfluxClientObj.IPoint>) {
        this._logObj.debug('[InfluxDB Client v1] Sending data to InfluxDB');
        this._influxClient1.writePoints(dataPoints).catch(errorObj => {
            throw errorObj;
        });
    }
    
    /**
     * Write data to the influxdb
     *
     * @returns {Promise<boolean>}
     * @memberof WebsiteBenchInflux
    */
    private async writePointsV2(dataPoints: Array<nodeInfluxClientObj.IPoint>) {
        this._logObj.debug('[InfluxDB Client v2] Sending data to InfluxDB');
        dataPoints.forEach(curPoint => {
            let dataPoint = new influxDbClientObj.Point(curPoint.measurement);
            for(const tagKey in curPoint.tags) {
                dataPoint.tag(tagKey, curPoint.tags[tagKey]);
            }
            for(const fieldKey in curPoint.fields) {
                if(typeof curPoint.fields[fieldKey] === 'number') {
                    dataPoint.floatField(fieldKey, curPoint.fields[fieldKey]);
                }
                else {
                    dataPoint.stringField(fieldKey, curPoint.fields[fieldKey]);
                }
            }
            this._writeApi.writePoint(dataPoint)
        });
        this._writeApi.flush().catch(errorObj => { throw errorObj });
    }
}