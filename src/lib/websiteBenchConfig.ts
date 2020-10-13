// websiteBench Config Class
import { IWebsiteBenchConfig, IConfigError, IConfigFiles } from './websiteBenchInterfaces';
import { readFileSync } from 'fs';
import { exit } from 'process';
import { Logger } from 'tslog';

export default class WebsiteBenchConfig {
    private _configObj: IWebsiteBenchConfig = {};

    // Defaults config settings
    private _versionNum = '1.5.2';
    private _allowCaching = false;
    private _ignoreSslErrors = false;
    private _logResourceErrors = false;
    private _maxConcurrentJobs = 5;
    private _minCheckInterval = 30;
    private _influxVersion = 1.7;
    private _influxDefaultAuth: "userpass"|"token" = 'userpass';
    private logObj: Logger = null;
    
    /**
     * Constructor
     *
     * @constructor
     * @memberof WebsiteBenchConfig
    */
    constructor(confFiles: IConfigFiles, logObj: Logger) {
        this.logObj = logObj;

        // Read config files
        let confFileData = this.readConfig(confFiles.configFile);
        let secretFileData = this.readConfig(confFiles.secretsFile);

        // Construct the config object
        this._configObj = Object.assign({
            allowCaching: this._allowCaching,
            maxConcurrentJobs: this._maxConcurrentJobs,
            logResErrors: this._logResourceErrors,
            ignoreSslErrors: this._ignoreSslErrors,
            versionNum: this._versionNum
        }, confFileData);
        this._configObj.influxDb = {
            ...{version: this._influxVersion, authmethod: this._influxDefaultAuth},
            ...this._configObj.influxDb,
            ...secretFileData.influxDb
        };

        // Check the that all mandatory config props are present
        try {
            this.checkMandatory();
        }
        catch(missingProp) {
            let missingPropsArray = (missingProp.message as string).split(';');
            this.logObj.error(`Unable to start websiteBench.`);
            missingPropsArray.forEach(propName => {
                this.logObj.error(`Config file misses mandatory property: ${propName}`);
            });
            exit(1);
        }

        // Check for nonsense settings
        try {
            this.checkConfig();
        }
        catch(configError) {
            this.logObj.error(`Unable to start websiteBench.`);
            this.logObj.error(`Error in property "${configError.errorProperty}": ${configError.errorMessage}`);
            exit(1);
        }

        // Update some final settings
        this.logObj.setSettings({minLevel: this._configObj.logLevel})
    }

    /**
     * Getter for configObj
     *
     * @returns {IWebsiteBenchConfig}
     * @memberof WebsiteBenchConfig
    */
    public configObj() {
        return this._configObj;
    }

    /**
     * Check if all mandatory properties are given
     *
     * @returns {void}
     * @memberof WebsiteBenchConfig
    */
    private checkMandatory(): void {
        // Make sure all mandatory
        const mandatoryProps = ['maxConcurrentJobs', 'allowCaching', 'websiteList', 'influxDb', 'instanceName'];
        const mandatoryInflux = ['hostname', 'database', 'authmethod', 'version'];
        let missingProps: string = null;
        for(const objProp of mandatoryProps) {
            if(!(objProp in this._configObj)) {
                missingProps = (missingProps === null) ? objProp : `${missingProps};${objProp}`;
            }
        }
        for(const objProp of mandatoryInflux) {
            if(!(objProp in this._configObj.influxDb)) {
                missingProps = (missingProps === null) ? `influxDb.${objProp}` : `${missingProps};influxDb.${objProp}`;
            }
        }
        if(missingProps !== null) {
            throw new Error(missingProps);
        }

        return;
    }
    
    /**
     * Check if all properties have settings which make sense
     *
     * @returns {void}
     * @memberof WebsiteBenchConfig
    */
    private checkConfig() {
        const configError: IConfigError = Object.assign({ hasError: false });
        if(this._configObj.userAgent == '') {
            configError.hasError = true;
            configError.errorProperty = 'userAgent';
            configError.errorMessage = 'Setting cannot be empty';
        }
        if(typeof this._configObj.allowCaching !== 'boolean' || this._configObj.allowCaching === null) {
            configError.hasError = true;
            configError.errorProperty = 'allowCaching';
            configError.errorMessage = 'Needs to be a boolean value'
        }
        if(!('version' in this._configObj.influxDb) || typeof this._configObj.influxDb.version !== 'number') {
            configError.hasError = true;
            configError.errorProperty = 'influxDb => version';
            configError.errorMessage = 'InluxDb configuration setting "version" is not a number.';
        }
        if(!('authmethod' in this._configObj.influxDb) || typeof this._configObj.influxDb.authmethod !== 'string') {
            configError.hasError = true;
            configError.errorProperty = 'influxDb => authmethod';
            configError.errorMessage = 'InluxDb configuration setting "authmethod" is not a string.';
        }
        if('authmethod' in this._configObj.influxDb && (this._configObj.influxDb.authmethod.toLowerCase() !== 'token' && this._configObj.influxDb.authmethod.toLowerCase() !== 'userpass')) {
            configError.hasError = true;
            configError.errorProperty = 'influxDb => authmethod';
            configError.errorMessage = `InluxDb configuration setting "authmethod" needs to be either "userpass" or "token": ${this._configObj.influxDb.authmethod}`;
        }
        if('authmethod' in this._configObj.influxDb && this._configObj.influxDb.authmethod.toLowerCase() === 'token') {
            if(!('token' in this._configObj.influxDb) || this._configObj.influxDb.token === '' || this._configObj.influxDb.token === null) {
                configError.hasError = true;
                configError.errorProperty = 'influxDb => token';
                configError.errorMessage = `InluxDb configuration setting "token" value cannot be empty in token-auth mode`;
            }
            if(!('organization' in this._configObj.influxDb) || this._configObj.influxDb.organization === '' || this._configObj.influxDb.organization === null) {
                configError.hasError = true;
                configError.errorProperty = 'influxDb => organization';
                configError.errorMessage = `InluxDb configuration setting "organization" value cannot be empty in token-auth mode`;
            }
        }
        else {
            if(!('username' in this._configObj.influxDb) || this._configObj.influxDb.username === '' || this._configObj.influxDb.username === null) {
                configError.hasError = true;
                configError.errorProperty = 'influxDb => username';
                configError.errorMessage = `InluxDb configuration setting "username" value cannot be empty in userpass-auth mode`;
            }
            if(!('password' in this._configObj.influxDb) || this._configObj.influxDb.password === '' || this._configObj.influxDb.password === null) {
                configError.hasError = true;
                configError.errorProperty = 'influxDb => password';
                configError.errorMessage = `InluxDb configuration setting "password" value cannot be empty in userpass-auth mode`;
            }
        }
        if('authmethod' in this._configObj.influxDb && this._configObj.influxDb.authmethod === 'token' && this._configObj.influxDb.version < 2) {
            configError.hasError = true;
            configError.errorProperty = 'influxDb => authmethod/version';
            configError.errorMessage = `InluxDb version below 2.0 does not support token authentication. Please switch to userpass-auth mode`;
        }
        this._configObj.websiteList.forEach(websiteEntry => {
            if(!('siteName' in websiteEntry) || typeof websiteEntry.siteName !== 'string') {
                configError.hasError = true;
                configError.errorProperty = 'websiteList => siteName';
                configError.errorMessage = 'Not all website list entries have a "siteName" property or the value is not a string';
            }
            if(!('siteUrl' in websiteEntry) || typeof websiteEntry.siteUrl !== 'string') {
                configError.hasError = true;
                configError.errorProperty = 'websiteList => siteUrl';
                configError.errorMessage = 'Not all website list entries have a "siteUrl" property or the value is not a string';
            }
            if('checkType' in websiteEntry && typeof websiteEntry.checkType !== 'string') {
                configError.hasError = true;
                configError.errorProperty = 'websiteList => checkType';
                configError.errorMessage = 'Value of "checkType" is not a string';
            }
            if(!('checkInterval' in websiteEntry) || typeof websiteEntry.checkInterval !== 'number') {
                configError.hasError = true;
                configError.errorProperty = 'websiteList => checkInterval';
                configError.errorMessage = 'Not all website list entries have a "checkInterval" property or the value is not a number';
            }
            if(websiteEntry.checkInterval < this._minCheckInterval) {
                configError.hasError = true;
                configError.errorProperty = 'checkInterval';
                configError.errorMessage = `"checkInterval" of website entry "${websiteEntry.siteName}" is too low. Minimum checkInterval is 60 seconds`
            }
            if(websiteEntry.siteName === '' || websiteEntry.siteName === null) {
                configError.hasError = true;
                configError.errorProperty = 'siteName';
                configError.errorMessage = `"siteName" of website entry "${websiteEntry.siteName}" cannot be empty`
            }
            if(websiteEntry.siteUrl === '' || websiteEntry.siteUrl === null) {
                configError.hasError = true;
                configError.errorProperty = 'siteUrl';
                configError.errorMessage = `"siteUrl" of website entry "${websiteEntry.siteName}" cannot be empty`
            }
            if('checkType' in websiteEntry && (websiteEntry.checkType.toLowerCase() !== 'browser' && websiteEntry.checkType.toLowerCase() !== 'curl')) {
                configError.hasError = true;
                configError.errorProperty = 'checkType';
                configError.errorMessage = `"checkType" of website entry "${websiteEntry.siteName}" has to be either "browser" or "curl"`
            }
            try {
                new URL(websiteEntry.siteUrl);
            }
            catch(errorObj) {
                configError.hasError = true;
                configError.errorProperty = 'siteUrl';
                configError.errorMessage = `"siteUrl" of website entry "${websiteEntry.siteName}" is not a valid URL: ${errorObj.code}`
            }
        })

        if(configError.hasError === true) {
            throw configError;
        }
    }

    /**
     * Read config file
     *
     * @param {string} configFilePath The filepath the config file to read
     * @returns {IWebsiteBenchConfig}
     * @memberof WebsiteBenchConfig
    */
    private readConfig(configFile: string): IWebsiteBenchConfig {
        if(configFile === null) { throw new Error('No config file path given.'); }
        let configRaw, configJson;
        try {
            configRaw = readFileSync(configFile, {encoding: 'utf-8'});
        }
        catch(errObj) {
            console.error(`Unable to read config file: ${errObj.message}`)
            exit(1);
        }
        try {
            configJson = JSON.parse(configRaw);
        }
        catch(errObj) {
            console.error(`Unable to parse config file: ${errObj.message}`)
            exit(1);
        }

        return configJson;
    }
    
    /**
     * Do we need a browser?
     *
     * @returns {boolean}
     * @memberof WebsiteBenchConfig
    */
    public isBrowserNeeded(): boolean {
        let browserCount = 0;
        this._configObj.websiteList.forEach(siteEntry => {
            if(typeof siteEntry.checkType === 'undefined' || siteEntry.checkType === null) {
                browserCount++;
            }
            else if('checkType' in siteEntry && siteEntry.checkType.toLowerCase() === 'browser') {
                browserCount++;
            }
        });

        return browserCount > 0;
    }
}