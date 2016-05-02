var express = require('express');
var cors = require('cors');
var http = express();
var sysap_external = require('./sysap-external.js');
var helper = require('./helper.js');

http.use(cors());

http.get('/info/:serialnumber?/:channel?/:datapoint*?', function (req, res) {
	var data = sysap_external.info('actuators');
	if (req.params.serialnumber && data[req.params.serialnumber]) {
		data = data[req.params.serialnumber];
		if (req.params.channel && data.channels[req.params.channel]) {
			data = data.channels[req.params.channel];
			if (req.params.datapoint && data.datapoints[req.params.datapoint]) {
				data = data.datapoints[req.params.datapoint];
			}
		}
	}
	helper.log.debug('web get info call');
	res.json(data);
});

http.get('/structure/:mode?/:floor*?', function (req, res) {
	var data = sysap_external.info('external');
	if (req.params.mode && data[req.params.mode]) {
		data = data[req.params.mode];
		if (req.params.floor && data[req.params.floor]) {
			data = data[req.params.floor];
		}
	}
	helper.log.debug('web get external call');
	res.json(data);
});

http.get('/legacy', function (req, res) {
	// old format: bj.php?type=setSwitch&actuator=ABB26B081851&channel=2&command=on
	var type = req.query.type.substring(3).toLowerCase();
	var serialnumber = req.query.actuator;
	var channel = 'ch000' + req.query.channel;
	var action = req.query.command;
	
	helper.log.debug('web legacy set channel ' + channel + ' of ' + type + ' ' + serialnumber + ' to ' + action);
	var status = sysap_external.parse(type, serialnumber, channel, action, null);
	
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	res.send(status);
});

http.get('/set/:type/:serialnumber/:channel/:action/:value*?', function (req, res) {
	helper.log.debug('web set channel ' + req.params.channel + ' of ' + req.params.type + ' ' + req.params.serialnumber + ' to ' + req.params.action + (req.params.value ? ' (' + req.params.value + ')' : ''));
	var status = sysap_external.parse(req.params.type, req.params.serialnumber, req.params.channel, req.params.action, (req.params.value ? req.params.value : null));
	res.send(status);
});

http.get('/raw/:serialnumber/:channel/:datapoint/:value', function (req, res) {
	helper.log.debug('web raw set: ' + req.params.serialnumber + '/' + req.params.channel + '/' + req.params.datapoint + ': ' + req.params.value);
	sysap_external.set(req.params.serialnumber, req.params.channel, req.params.datapoint, req.params.value);
	res.send(req.params.serialnumber + '/' + req.params.channel + '/' + req.params.datapoint + ': ' + req.params.value);
});

http.get('/input/:serialnumber/:channel/:datapoint/:value', function (req, res) {
	helper.log.debug('input raw data: ' + req.params.serialnumber + '/' + req.params.channel + '/' + req.params.datapoint + ': ' + req.params.value);
	sysap_external.setDP(req.params.serialnumber, req.params.channel, req.params.datapoint, req.params.value);
	res.set('Connection', 'close');
	res.send('OK');
	res.end();
});

http.listen(8080, function () {
	helper.log.info('http api loaded');
});
