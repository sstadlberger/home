# Home
Custom Interface / API for the Busch Jäger free@home system (home automation). 

# Content
* [Prerequisites](#prerequisites)
* [Usage](#usage)
  * [Overview](#overview)
  * [Config Files](#config-files)
    * [config.js](#configjs)
    * [data.json](#datajson)
    * [structure.json](#structurejson)
    * [storage.mysql](#storagemysql)
  * [API](#api)
    * [REST API](#rest-api)
    * [Websocket API](#websocket-api)
  * [Known Limitations](#known-limitations)
* [Current Status](#current-status)
  * [Known Bugs](#known-bugs)
  * [Planned Improvements](#planned-improvements)
* [License](#license)
* [Current Version](#current-version)


# Prerequisites
- Node.js 5.5 (tested, earlier and later versions might work; 10.7 is currently being successfully tested so far)

The following Node.js modules:
- body-parser
- cors
- express
- md5
- mysql (optional)
- node-xmpp-client
- nodejs-websocket
- suncalc

# Usage
## Overview
1. install node.js: **_https://nodejs.org/_**
2. clone the repository: **_git clone git@github.com:sstadlberger/home.git_**
3. cd into the project root and install the node modules: **_npm install_**
4. configure the **_[config.js](#configjs)_**, **_[data.json](#datajson)_** and **_[structure.json](#structurejson)_** files (see the files themselves and below for more information)
5. run it with: **_node home.js_** (possible options: --logLevel=debug --useWeather --useDB --useHomematic)

## Config Files
The config files are located all in **_config/_**
### config.js
1. create a copy of config.default.js and rename it to config.js
2. fill in config.bosh & config.websocket<br>
   The JID can be found here: http://yourSysAPIP/settings.json
3. If you want to use the weather feature you need to create an API key here:<br>
   https://darksky.net/dev<br>
   1000 requests per day are free, home uses normally 144 per day (one request every 10 minutes)
### data.json
1. create a copy of data.default.json and rename it to data.json
2. unless you use custom sensors or actuators (i.e. self built), you don't need to change anything
### structure.json
1. create a copy of structure.default.json and rename it to structure.json
2. modify the file so that it matches your home layout (this is mainly used for a not yet released visual frontend)
### storage.mysql
1. this is optional
2. run the file in your mySQL database to create the table structure
3. this currently only used to store the data of a Landis+Gyr E350 powermeter

## API
### REST API
When the software is running, you can call into the REST API using a browser. For example, to switch a light on:
http://yourLocalIP:8080/set/switch/ABB123456789/ch0000/on
ABB123456789 is the serial number of the actuator you're trying to control.

To see all data from an actuator use the following URL (you can set a custom port number other than 8080 via the config.js):
http://yourLocalIP:8080/info/ABB123456789/

An overview of all available commands can be found in the [REST API](lib/api/webapi.js) and the [SysAP API (parse function)](lib/freeathome/sysap-external.js)
### Websocket API
Connect with a websocket client on port 8001
You will automatically receive status updates in JSON format. 

To switch on a light use the following command syntax: set/switch/ABB123456789/ch0000/on
ABB123456789 is the serial number of the actuator you're trying to control.

An overview of all available commands can be found in the [Websocket API](lib/api/socketapi.js) and the [SysAP API (parse function)](lib/freeathome/sysap-external.js)

## Known Limitations
- Only one single user can be logged in at the same time. When you login in the webinterface as the same user you are using for the API you will be disconnected. It is recommended that you create an extra user just for the API which does not have admin status.
- After a restart of the SysAP the user has to login once into the webinterface before the user can access the API.
- Only actuators that are used in the webinterface can be accessed by the API. If an actuator is not used (i.e. dragged on the floor plan) it can not be controlled with the API.

# Current Status

## Known Bugs
- see here for more information: https://github.com/sstadlberger/home/issues

## Planned Improvements
### Timers
Add the ability to execute actions at certain times or intervalls. For example:
- Switch the light off in 10 minutes
- Open the shutters at 7:00
- Turn on the ambient light at 30 minutes after sunset

### Triggers
Add the abilities to exectute actions at certain conditions. For example:
- Add a timer for 10 minutes after Light has been switched on
- Close the shutters if the light has been switched on after sunset

### Homematic
Add support for Homematic sensors and actuators to enable easy expansion of the system.

### Philips Hue
Native support for Philips Hue, including switches and motion sensors

### Amazon Alexa
Development is currently on hold, depending on the release of the Busch Jaeger version

# License
This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Current Version
Version numbering will start when the first set of features is complete.
