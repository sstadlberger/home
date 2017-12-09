/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */



// startup with parameters
var helper = require('./helper.js');
var argv = require('minimist')(process.argv.slice(2));


// set log level
// helper.log.loglevel contains all log levels
// info (helper.log.loglevel.info) is set as default if no other loglevel is chosen
global.loglevel = helper.log.loglevel.info;
if (argv.loglevel) {
	var valid = Object.keys(helper.log.loglevel);
	if (valid.indexOf(argv.loglevel) == -1) {
		console.log('invalid loglevel argument: ' + argv.loglevel);
		console.log('valid arguments are: ' + valid.join(', '));
		process.exit();
	} else {
		global.loglevel = helper.log.loglevel[argv.loglevel];
	}
}
if (argv.logFilter) {
	console.log('logFilter set to: ' + argv.logFilter);
	global.logFilter = argv.logFilter;
} else {
	global.logFilter = false;
}


// set weather
global.useWeather = false;
if (argv.useWeather == true) {
	global.useWeather = true;
}


// set database
global.useDB = false;
if (argv.useDB == true) {
	global.useDB = true;
}


// set Homematic
global.useHomematic = false;
if (argv.useHomematic == true) {
	global.useHomematic = true;
}


// all paramaters are ok, load the rest
var sysap = require('./sysap.js');
var sysap = require('./homematic.js');
var webapi = require('./webapi.js');
var socketapi = require('./socketapi.js');
var logic = require('./logic.js');
var weather = require('./weather.js');

helper.log.info('home started');
