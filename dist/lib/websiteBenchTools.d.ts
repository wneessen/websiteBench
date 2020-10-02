import Puppeteer from 'puppeteer';
import { ILogObject } from 'tslog';
export default class WebsiteBenchTools {
    eventIsDialog(inputEvent: any): inputEvent is Puppeteer.Dialog;
    getRandNum(maxNum: number): number;
    logToFile(logObject: ILogObject): Promise<void>;
}
//# sourceMappingURL=websiteBenchTools.d.ts.map