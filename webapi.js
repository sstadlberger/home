var express = require('express');
var http = express();
var sysap = require('./sysap.js');

http.get('/info/:sn?/:ch?/:dp*?', function (req, res) {
	var data = sysap.info();
	if (req.params.sn && data[req.params.sn]) {
		data = data[req.params.sn];
		if (req.params.sn && data.channels[req.params.ch]) {
			data = data.channels[req.params.ch];
			if (req.params.dp && data.datapoints[req.params.dp]) {
				data = data.datapoints[req.params.dp];
			}
		}
	}
	console.log('[WEB] get info');
	res.json(data);
});

http.get('/set/:sn/:ch/:dp/:vl', function (req, res) {
	var data = sysap.info();
	sysap.action(req.params.sn, req.params.ch, req.params.dp, req.params.vl);
	console.log('[WEB] set actuator: ' + req.params.sn + '/' + req.params.ch + '/' + req.params.dp + ': ' + req.params.vl);
	res.send(req.params.sn + '/' + req.params.ch + '/' + req.params.dp + ': ' + req.params.vl);
});

http.listen(8080, function () {
  console.log('[WEB] http api loaded');
});
