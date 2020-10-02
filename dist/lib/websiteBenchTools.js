"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
class WebsiteBenchTools {
    eventIsDialog(inputEvent) {
        return inputEvent.dismiss !== undefined;
    }
    getRandNum(maxNum) {
        return Math.floor(Math.random() * Math.floor(maxNum));
    }
    async logToFile(logObject) {
        let logFile = 'log/websiteBench.log';
        fs_1.appendFile(logFile, JSON.stringify(logObject) + "\n", (logErr) => {
            if (logErr) {
                console.error(`An error occured while writing to logfile "${logFile}": ${logErr}`);
            }
        });
    }
}
exports.default = WebsiteBenchTools;
