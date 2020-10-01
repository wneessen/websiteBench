"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class WebsiteBenchTools {
    eventIsDialog(inputEvent) {
        return inputEvent.dismiss !== undefined;
    }
    getRandNum(maxNum) {
        return Math.floor(Math.random() * Math.floor(maxNum));
    }
}
exports.default = WebsiteBenchTools;
