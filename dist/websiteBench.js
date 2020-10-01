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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tslog_1 = require("tslog");
const process_1 = __importStar(require("process"));
const websiteBenchConfig_1 = __importDefault(require("./lib/websiteBenchConfig"));
process_1.default.on('SIGINT', () => {
    console.warn('\nGracefully shutting down from SIGINT (Ctrl-C)');
    process_1.default.exit(1);
});
var versionNum = '0.1.0';
let confFile = './conf/websitebench.conf';
let secretsFile = './conf/websitebench.secrets.conf';
const pupLaunchOptions = {
    headless: true,
    args: [],
};
const logObj = new tslog_1.Logger({
    displayFunctionName: false,
    displayRequestId: false,
    minLevel: 'debug'
});
const configObj = new websiteBenchConfig_1.default(confFile, secretsFile, logObj).configObj();
logObj.info(configObj);
process_1.exit(1);
