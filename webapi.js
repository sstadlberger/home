var express = require('express');
var http = express();
var sysap = require('./sysap-external.js');

http.get('/info/:serialnumber?/:channel?/:datapoint*?', function (req, res) {
	var data = sysap.info();
	if (req.params.serialnumber && data[req.params.serialnumber]) {
		data = data[req.params.serialnumber];
		if (req.params.serialnumber && data.channels[req.params.channel]) {
			data = data.channels[req.params.channel];
			if (req.params.datapoint && data.datapoints[req.params.datapoint]) {
				data = data.datapoints[req.params.datapoint];
			}
		}
	}
	console.log('[WEB] get info');
	res.json(data);
});

http.get('/legacy', function (req, res) {
	// old format: bj.php?type=setSwitch&actuator=ABB26B081851&channel=2&command=on
	var type = req.query.type.substring(3).toLowerCase();
	var serialnumber = req.query.actuator;
	var channel = 'ch000' + req.query.channel;
	var action = req.query.command;
	
	console.log('[WEB] legacy set channel ' + channel + ' of ' + type + ' ' + serialnumber + ' to ' + action);
	var status = sysap.parse(type, serialnumber, channel, action);
	
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	res.send(status);
});

http.get('/set/:type/:serialnumber/:channel/:action', function (req, res) {
	console.log('[WEB] set channel ' + req.params.channel + ' of ' + req.params.type + ' ' + req.params.serialnumber + ' to ' + req.params.action);
	var status = sysap.parse(req.params.type, req.params.serialnumber, req.params.channel, req.params.action);
	res.send(status);
});

http.get('/raw/:serialnumber/:channel/:datapoint/:value', function (req, res) {
	console.log('[WEB] raw set: ' + req.params.serialnumber + '/' + req.params.channel + '/' + req.params.datapoint + ': ' + req.params.value);
	sysap.set(req.params.serialnumber, req.params.channel, req.params.datapoint, req.params.value);
	res.send(req.params.serialnumber + '/' + req.params.channel + '/' + req.params.datapoint + ': ' + req.params.value);
});

http.listen(8080, function () {
  console.log('[WEB] http api loaded');
});
