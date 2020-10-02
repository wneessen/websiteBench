"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const process_1 = require("process");
class WebsiteBenchConfig {
    constructor(confFiles, logObj) {
        this._configObj = {};
        this._versionNum = '1.2.2';
        this._allowCaching = false;
        this._logResourceErrors = false;
        this._maxConcurrentJobs = 5;
        this._minCheckInterval = 30;
        this.logObj = null;
        this.logObj = logObj;
        let confFileData = this.readConfig(confFiles.configFile);
        let secretFileData = this.readConfig(confFiles.secretsFile);
        this._configObj = Object.assign({
            allowCaching: this._allowCaching,
            maxConcurrentJobs: this._maxConcurrentJobs,
            logResErrors: this._logResourceErrors,
            versionNum: this._versionNum,
        }, confFileData);
        this._configObj.influxDb = { ...this._configObj.influxDb, ...secretFileData.influxDb };
        try {
            this.checkMandatory();
        }
        catch (missingProp) {
            let missingPropsArray = missingProp.message.split(';');
            this.logObj.error(`Unable to start websiteBench.`);
            missingPropsArray.forEach(propName => {
                this.logObj.error(`Config file misses mandatory property: ${propName}`);
            });
            process_1.exit(1);
        }
        try {
            this.checkConfig();
        }
        catch (configError) {
            this.logObj.error(`Unable to start websiteBench.`);
            this.logObj.error(`Error in property "${configError.errorProperty}": ${configError.errorMessage}`);
            process_1.exit(1);
        }
        this.logObj.setSettings({ minLevel: this._configObj.logLevel });
    }
    configObj() {
        return this._configObj;
    }
    checkMandatory() {
        const mandatoryProps = ['maxConcurrentJobs', 'allowCaching', 'websiteList', 'influxDb'];
        const mandatoryInflux = ['hostname', 'database', 'username', 'password'];
        let missingProps = null;
        for (const objProp of mandatoryProps) {
            if (!(objProp in this._configObj)) {
                missingProps = (missingProps === null) ? objProp : `${missingProps};${objProp}`;
            }
        }
        for (const objProp of mandatoryInflux) {
            if (!(objProp in this._configObj.influxDb)) {
                missingProps = (missingProps === null) ? `influxDb.${objProp}` : `${missingProps};influxDb.${objProp}`;
            }
        }
        if (missingProps !== null) {
            throw new Error(missingProps);
        }
        return;
    }
    checkConfig() {
        const configError = Object.assign({ hasError: false });
        if (this._configObj.userAgent == '') {
            configError.hasError = true;
            configError.errorProperty = 'userAgent';
            configError.errorMessage = 'Setting cannot be empty';
        }
        if (typeof this._configObj.allowCaching !== 'boolean' || this._configObj.allowCaching === null) {
            configError.hasError = true;
            configError.errorProperty = 'allowCaching';
            configError.errorMessage = 'Needs to be a boolean value';
        }
        this._configObj.websiteList.forEach(websiteEntry => {
            if (!('siteName' in websiteEntry) || typeof websiteEntry.siteName !== 'string') {
                configError.hasError = true;
                configError.errorProperty = 'websiteList => siteName';
                configError.errorMessage = 'Not all website list entries have a "siteName" property or the value is not a string';
            }
            if (!('siteUrl' in websiteEntry) || typeof websiteEntry.siteUrl !== 'string') {
                configError.hasError = true;
                configError.errorProperty = 'websiteList => siteUrl';
                configError.errorMessage = 'Not all website list entries have a "siteUrl" property or the value is not a string';
            }
            if (!('checkInterval' in websiteEntry) || typeof websiteEntry.checkInterval !== 'number') {
                configError.hasError = true;
                configError.errorProperty = 'websiteList => checkInterval';
                configError.errorMessage = 'Not all website list entries have a "checkInterval" property or the value is not a number';
            }
            if (websiteEntry.checkInterval < this._minCheckInterval) {
                configError.hasError = true;
                configError.errorProperty = 'checkInterval';
                configError.errorMessage = `"checkInterval" of website entry "${websiteEntry.siteName}" is too low. Minimum checkInterval is 60 seconds`;
            }
            if (websiteEntry.siteName === '' || websiteEntry.siteName === null) {
                configError.hasError = true;
                configError.errorProperty = 'siteName';
                configError.errorMessage = `"siteName" of website entry "${websiteEntry.siteName}" cannot be empty`;
            }
            if (websiteEntry.siteUrl === '' || websiteEntry.siteUrl === null) {
                configError.hasError = true;
                configError.errorProperty = 'siteUrl';
                configError.errorMessage = `"siteUrl" of website entry "${websiteEntry.siteName}" cannot be empty`;
            }
            try {
                new URL(websiteEntry.siteUrl);
            }
            catch (errorObj) {
                configError.hasError = true;
                configError.errorProperty = 'siteUrl';
                configError.errorMessage = `"siteUrl" of website entry "${websiteEntry.siteName}" is not a valid URL: ${errorObj.code}`;
            }
        });
        if (configError.hasError === true) {
            throw configError;
        }
    }
    readConfig(configFile) {
        if (configFile === null) {
            throw new Error('No config file path given.');
        }
        let configRaw, configJson;
        try {
            configRaw = fs_1.readFileSync(configFile, { encoding: 'utf-8' });
        }
        catch (errObj) {
            console.error(`Unable to read config file: ${errObj.message}`);
            process_1.exit(1);
        }
        try {
            configJson = JSON.parse(configRaw);
        }
        catch (errObj) {
            console.error(`Unable to parse config file: ${errObj.message}`);
            process_1.exit(1);
        }
        return configJson;
    }
}
exports.default = WebsiteBenchConfig;
