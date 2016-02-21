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

http.get('/set/:command/:serialnumber/:channel/:action', function (req, res) {
	var data = sysap.info();
	sysap.set(req.params.serialnumber, req.params.channel, req.params.datapoint, req.params.value);
	console.log('[WEB] set: ' + req.params.serialnumber + '/' + req.params.channel + '/' + req.params.datapoint + ': ' + req.params.value);
	res.send(req.params.serialnumber + '/' + req.params.channel + '/' + req.params.datapoint + ': ' + req.params.value);
});

http.get('/raw/:serialnumber/:channel/:datapoint/:value', function (req, res) {
	var data = sysap.info();
	sysap.set(req.params.serialnumber, req.params.channel, req.params.datapoint, req.params.value);
	console.log('[WEB] raw set: ' + req.params.serialnumber + '/' + req.params.channel + '/' + req.params.datapoint + ': ' + req.params.value);
	res.send(req.params.serialnumber + '/' + req.params.channel + '/' + req.params.datapoint + ': ' + req.params.value);
});

http.listen(8080, function () {
  console.log('[WEB] http api loaded');
});
