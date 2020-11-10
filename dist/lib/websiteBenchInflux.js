"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const influxDbClientObj = __importStar(require("@influxdata/influxdb-client"));
const influxdb_client_apis_1 = require("@influxdata/influxdb-client-apis");
const nodeInfluxClientObj = __importStar(require("influx"));
class WebsiteBenchInflux {
    constructor(confObj, logObj) {
        this._configObj = {};
        this._logObj = null;
        this._influxLib = null;
        this._configObj = confObj;
        this._logObj = logObj;
        if (this._configObj.influxDb.authmethod.toLowerCase() === 'token') {
            const connUrl = (this._configObj.influxDb.protocol ? this._configObj.influxDb.protocol : 'http') + '://' +
                this._configObj.influxDb.hostname + ':' +
                (this._configObj.influxDb.port ? this._configObj.influxDb.port : '8086');
            this._influxClient2 = new influxDbClientObj.InfluxDB({
                url: connUrl,
                token: this._configObj.influxDb.token
            });
            this._bucketsApi = new influxdb_client_apis_1.BucketsAPI(this._influxClient2);
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
    }
    ;
    async checkConnection() {
        return new Promise(async (retFunc, rejFunc) => {
            if (this._influxLib === 'v1') {
                this._influxClient1.getDatabaseNames().then(dbNames => {
                    if (dbNames.indexOf(this._configObj.influxDb.database) === -1) {
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
                this._bucketsApi.getBuckets({ name: this._configObj.influxDb.database }).then(bucketObj => {
                    if (bucketObj.buckets.length <= 0) {
                        rejFunc(new Error('Access token lacks permissions to access bucket/database.'));
                    }
                    const thisBucket = bucketObj.buckets[0];
                    if (thisBucket.name === this._configObj.influxDb.database) {
                        retFunc(true);
                    }
                }).catch(errorObj => {
                    const errorBody = JSON.parse(errorObj.body);
                    rejFunc(errorBody);
                });
            }
        });
    }
    async writePoints(dataPoints) {
        return new Promise((retFunc, rejFunc) => {
            if (this._influxLib === 'v1') {
                this.writePointsV1(dataPoints).catch(errorObj => {
                    rejFunc(errorObj);
                }).then(() => retFunc(true));
            }
            else {
                this.writePointsV2(dataPoints).catch(errorObj => {
                    rejFunc(errorObj);
                }).then(() => retFunc(true));
            }
        });
    }
    async writePointsV1(dataPoints) {
        this._logObj.debug('[InfluxDB Client v1] Sending data to InfluxDB');
        this._influxClient1.writePoints(dataPoints).catch(errorObj => {
            throw errorObj;
        });
    }
    async writePointsV2(dataPoints) {
        this._logObj.debug('[InfluxDB Client v2] Sending data to InfluxDB');
        dataPoints.forEach(curPoint => {
            let dataPoint = new influxDbClientObj.Point(curPoint.measurement);
            for (const tagKey in curPoint.tags) {
                dataPoint.tag(tagKey, curPoint.tags[tagKey]);
            }
            for (const fieldKey in curPoint.fields) {
                if (typeof curPoint.fields[fieldKey] === 'number') {
                    dataPoint.floatField(fieldKey, curPoint.fields[fieldKey]);
                }
                else {
                    dataPoint.stringField(fieldKey, curPoint.fields[fieldKey]);
                }
            }
            this._writeApi.writePoint(dataPoint);
        });
        this._writeApi.flush().catch(errorObj => { throw errorObj; });
    }
}
exports.default = WebsiteBenchInflux;
