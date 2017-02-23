/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */



// startup with parameters (currently only debug info)
var helper = require('./helper.js');
var argv = require('minimist')(process.argv.slice(2));

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


// all paramaters are ok, load the rest
var sysap = require('./sysap.js');
var webapi = require('./webapi.js');
var socketapi = require('./socketapi.js');
var logic = require('./logic.js');
var weather = require('./weather.js');

helper.log.info('home started');
