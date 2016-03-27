var sysap = require('./sysap.js');
var webapi = require('./webapi.js');
var socketapi = require('./socketapi.js');
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

helper.log.info('home started');
