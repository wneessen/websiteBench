# websiteBench
websiteBench will measure website performance and propagate the results into an InfluxDB database. As websiteBench is making use of Google's [Puppeteer Framework](https://pptr.dev/), the performance is meassured via a real browser (Chrome or Firefox).

## Requirements
This service requires some NodeJS and some modules to work:
- [Arg](https://www.npmjs.com/package/arg)
- [Node-Influx](https://node-influx.github.io/)
- [NodeJS](https://nodejs.org/en/)
- [node-libcurl](https://github.com/JCMais/node-libcurl/)
- [Google Puppeteer](https://pptr.dev/)
- [Q](https://github.com/kriskowal/q)
- [tslog](https://tslog.js.org/)

The modules should be automagically be installed by running: ```npm install```

## Usage
Simply run the script via NodeJS:
```sh
$ node dist/websiteBench.js
```

Once started, the server will read the different website entries from the config file and schedule recurring checks based on the checking interval that is defined for the website.

## Installation

### Local installation via NPM
Simply download the sources via:
```sh
$ git clone git@github.com:wneessen/websiteBench.git
```
After successful cloning, switch to the newly created directory and run:
```sh
$ npm install
```
After the installation completed you are ready to run

### Docker image
There is a [Docker image](https://hub.docker.com/r/wneessen/website-bench) for websiteBench available on DockerHub.

To run the Docker image simply issue the following command:
- Download the docker image
  ```sh
  $ sudo docker pull wneessen/website-bench:prod
  ```
- Once downloaded you need to create a config and log directory for a local config- and secrets file:
  ```sh
  $ sudo mkdir /var/db/websiteBench/config /var/db/websiteBench/log
  ```
  (Adjust the ```/var/db/websiteBench/config``` path according to your local environment)
- Because of the security settings in docker, we need to run it with a specific seccomp-profile, otherwise Chrome will not be able to run. Therefore you need to download the profile file first:
  ```sh
  $ curl -LO https://raw.githubusercontent.com/wneessen/websiteBench/master/wb-seccomp.json
  ```
  (Due to the hardened kernel settings, this will not run on Arch Linux with the "Hardened" kernel. You will have to use **--no-sandbox** instead. // Only use when you really know what you are doing. Read more about the **--no-sandbox** Option [here](https://chromium.googlesource.com/chromium/src/+/master/docs/design/sandbox.md))
- Run the docker image
  ```sh
  $ docker run --security-opt seccomp=wb-seccomp.json -v /var/db/websiteBench/config:/opt/websiteBench/config -v /var/db/websiteBench/log:/opt/websiteBench/log wneessen/website-bench:prod -c config/yourconfig.conf
  ```
  (You can add additional CLI parameters if needed)

## Config file
The config accepts the following options:
```json
{
    "websiteList": [
        {
            "siteName": "Your Site No. 1",
            "siteUrl": "https://example.com/fooo.html",
            "checkInterval": 130,
            "checkType": "curl"
        },
        {
            "siteName": "Your other great Site",
            "siteUrl": "https://example.dev/",
            "checkInterval": 60
        }
    ],
    "influxDb": {
        "hostname": "localhost",
        "path": "/influxdb",
        "protocol": "https",
        "port": 443,
        "database": "websitebench",
        "ignoressl": false
    },
    "allowCaching": false,
	  "logLevel": "info",
    "maxConcurrentJobs": 5,
    "instanceName": "DC1-CGN-I1"
}
```
- ```websiteList (Array<IWebEntry>)```: List of websites to collect performance data on
- ```influxDb (IInfluxDbConfig)```: InfluxDB config settings
- ```allowCaching (Boolean)```: If set, the browser will not open Incognito instances, but simple new pages
- ```userAgent (String)```: Override the browser User-Agent
- ```instanceName (String)```: Name of the instance running the checks (will be tagged in InfluxDB accordingly)
- ```logResErrors (Boolean)```: If set, resource errors of the web requests will be logged (same as ```--log-resource-errors```)
- ```ignoreSslErrors (Boolean)```: If set, Chrome/cURL will not error on invalid SSL certificates
- ```maxConcurrentJobs (Number)```: Number of concurrently executed performance checks
- ```logLevel (ILogLevel)```: Define the loglevel

### Config sub types
- ```IWebEntry (Object)```: Consists of the following settings:
  -  ```siteName (String)```: The name of the site you are monitoring (will be the tag in the InfluxDB)
  -  ```siteUrl (String)```: The URL to monitor
  -  ```checkInterval (Number)```: The interval to perform the checks on (in seconds). Minimum value is 60 seconds.
  -  ```checkType (String)```: The type of performance check to run. Can be either "curl" or "browser" (Default: browser)
- ```IInfluxDbConfig (Object)```: Consists of the following settings:
  -  ```hostname (String)```: Hostname or IP of the InfluxDB server
  -  ```database (String)```: InfluxDB database name to store the metrics in
  -  ```username (String)```: Username for InfluxDB authentication
  -  ```password (String)```: Password for InfluxDB authentication
  -  ```protocol (String)```: "http" or "https" (Default: http)
  -  ```port (Number)```: Port of InfluxDB server (Default: 8086)
  -  ```path (String)``` (Optional): Path of the InfluxDB server

## CLI Options
The server provides the following CLI parameters to override defaults

- ```-c, --config <filepath> ```: Path to config file
- ```-s, --secrets <filepath> ```: Path to secrets config file
- ```-d, --debug```: Enable DEBUG mode (more logging)
- ```--no-headless```: If set, the browser will start in non-headless mode
- ```--no-sandbox```: If set, the browser is started in no-sandbox mode (**DANGEROUS**: Only use if you are sure what you are doing)
- ```--ignore-ssl-errors```: Ignore HTTPS errors
- ```--log-resource-errors```: If set, resource errors of the web requests will be logged
- ```--browserpath <path to browser executabel>```: Run Puppeteer with a different browser (Chrome/Firefox supported)
- ```--browsertype <chrome|firefox>```: Run Puppeteer with a different browser type (Requires: --browserpath to be set)

## License
[MIT](./LICENSE)