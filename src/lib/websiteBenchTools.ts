import Puppeteer from 'puppeteer';
import { ILogObject } from 'tslog'
import { appendFile } from 'fs';

export default class WebsiteBenchTools {
    /**
     * Check if the provided event is a Puppeteer.Dialog event
     *
     * @param {any} inputEvent The event to be evaluated
     * @returns {boolean}
     * @memberof WebsiteBenchTools
    */
    public eventIsDialog(inputEvent: any): inputEvent is Puppeteer.Dialog {
        return (inputEvent as Puppeteer.Dialog).dismiss !== undefined;
    }

    /**
     * Generate a (non-secure) random number
     *
     * @param {number} maxNum Highest random number to generate
     * @returns {number}
     * @memberof WebsiteBenchTools
    */
    public getRandNum(maxNum: number) {
        return Math.floor(Math.random() * Math.floor(maxNum));
    }

    /**
     * Log to file
     *
     * @param {ILogObject} logObject The tslog-log object
     * @returns {Promise<void>}
     * @memberof WebsiteBenchTools
    */
    public async logToFile(logObject: ILogObject): Promise<void> {
        let logFile = 'log/websiteBench.log';
        appendFile(logFile, JSON.stringify(logObject) + "\n", (logErr) => {
            if(logErr) {
                console.error(`An error occured while writing to logfile "${logFile}": ${logErr}`);
            }
        });
    }
}
