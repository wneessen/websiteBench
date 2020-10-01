import Puppeteer from 'puppeteer';

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

    public getRandNum(maxNum: number) {
        return Math.floor(Math.random() * Math.floor(maxNum));
    }
}
