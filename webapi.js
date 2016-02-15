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
	res.json(data);
});

http.listen(8080, function () {
  console.log('http api loaded');
});
