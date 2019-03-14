/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var http = express();
var sysap_external = require('../freeathome/sysap-external');
var data = require('../data');
var helper = require('../helper');
var config = require('../../config/config');
var storage = require('../data/storage');

http.use(cors());
http.use(bodyParser.urlencoded({ extended: false }));
http.use(bodyParser.json());

http.get('/info/:serialnumber?/:channel?/:datapoint*?', function (req, res) {
	var d = data.getData('actuators');
	if (req.params.serialnumber && d[req.params.serialnumber]) {
		d = d[req.params.serialnumber];
		if (req.params.channel && d.channels[req.params.channel]) {
			d = d.channels[req.params.channel];
			if (req.params.datapoint && d.datapoints[req.params.datapoint]) {
				d = d.datapoints[req.params.datapoint];
			}
		}
	}
	helper.log.debug('[' + req.connection.remoteAddress + '] web get info call');
	res.json(d);
});

http.get('/structure/:mode?/:floor*?', function (req, res) {
	var d = data.getData('external');
	if (req.params.mode && d[req.params.mode]) {
		d = d[req.params.mode];
		if (req.params.floor && d[req.params.floor]) {
			d = d[req.params.floor];
		}
	}
	helper.log.debug('[' + req.connection.remoteAddress + '] web get external call');
	res.json(d);
});

http.get('/legacy', function (req, res) {
	// old format: bj.php?type=setSwitch&actuator=ABB26B081851&channel=2&command=on
	var type = req.query.type.substring(3).toLowerCase();
	var serialnumber = req.query.actuator;
	var channel = 'ch000' + req.query.channel;
	var action = req.query.command;
	
	helper.log.debug('[' + req.connection.remoteAddress + '] web legacy set channel ' + channel + ' of ' + type + ' ' + serialnumber + ' to ' + action);
	var status = sysap_external.parse(type, serialnumber, channel, action, null);
	
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	res.send(status);
});

http.get('/set/:type/:serialnumber/:channel/:action/:value*?', function (req, res) {
	helper.log.debug('[' + req.connection.remoteAddress + '] web set channel ' + req.params.channel + ' of ' + req.params.type + ' ' + req.params.serialnumber + ' to ' + req.params.action + (req.params.value ? ' (' + req.params.value + ')' : ''));
	var status = sysap_external.parse(req.params.type, req.params.serialnumber, req.params.channel, req.params.action, (req.params.value ? req.params.value : null));
	res.send(status);
});

http.get('/raw/:serialnumber/:channel/:datapoint/:value', function (req, res) {
	helper.log.debug('[' + req.connection.remoteAddress + '] web raw set: ' + req.params.serialnumber + '/' + req.params.channel + '/' + req.params.datapoint + ': ' + req.params.value);
	sysap_external.set(req.params.serialnumber, req.params.channel, req.params.datapoint, req.params.value);
	res.send(req.params.serialnumber + '/' + req.params.channel + '/' + req.params.datapoint + ': ' + req.params.value);
});

http.get('/input/:serialnumber/:channel/:datapoint/:value', function (req, res) {
	helper.log.debug('[' + req.connection.remoteAddress + '] input raw data: ' + req.params.serialnumber + '/' + req.params.channel + '/' + req.params.datapoint + ': ' + req.params.value);
	data.setDatapoint(req.params.serialnumber, req.params.channel, req.params.datapoint, req.params.value, true);
	res.set('Connection', 'close');
	res.send('OK');
	res.end();
});

http.get('/message', function (req, res) {
	helper.log.info('[' + req.connection.remoteAddress + '] http message: ' + req.query.message);
	res.set('Connection', 'close');
	res.send('OK');
	res.end();
});

http.post('/message', function (req, res) {
	helper.log.info('[' + req.connection.remoteAddress + '] http message: ' + req.body.message);
	res.set('Connection', 'close');
	res.send('OK');
	res.end();
});

http.post('/powermeter', function (req, res) {
	helper.log.trace('[' + req.connection.remoteAddress + '] http power meter: ' + "\n" + req.body.result);
	storage.inputPowermeter(req.body.result);
	res.set('Connection', 'close');
	res.send('OK');
	res.end();
});

http.get('/power', function (req, res) {
	helper.log.debug('[' + req.connection.remoteAddress + '] http get power');
	
	var httpReturn = function (ok, result) {
		if (ok) {
			res.json(result);
		} else {
			res.send('Error');
		}
		res.end();
	}
	
	storage.currentPower(httpReturn);
});

http.get('/powerdata', function (req, res) {
	helper.log.debug('[' + req.connection.remoteAddress + '] http get power');
	
	var httpReturn = function (ok, result) {
		if (ok) {
			res.json(result);
		} else {
			res.send('Error');
		}
		res.end();
	};
	
	storage.currentPower(httpReturn);
});

http.listen(config.webapi.port, function () {
	helper.log.info('http api loaded');
});
