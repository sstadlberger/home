/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var mysql = require('mysql');
var helper = require('./helper.js');
var config = require('./config.js');

var connection = mysql.createConnection({
	host : config.mysql.host,
	user : config.mysql.user,
	password : config.mysql.password,
	database : config.mysql.database,
	port : config.mysql.port
});

connection.connect();

connection.query('SELECT 1;', function(err, rows, fields) {
	if (err) {
		helper.log.error('could not connect to DB: ' + err);
	} else {
		helper.log.info('connected to DB');
	}
});

var inputPowermeter = function (data) {
	var mapping = {
		'1.8.0': 'kwh',
		'32.7': 'v1',
		'52.7': 'v2',
		'72.7': 'v3',
		'31.7': 'a1',
		'51.7': 'a2',
		'71.7': 'a3',
		'13.7': 'pf',
		'14.7': 'hz',
		'C.7.0': 'outages',
		'16.7': 'kw'
	};
	var result = {};
	var lines = data.split(/\r\n/);
	lines.forEach(function (line) {
		var matches = line.match(/^([0-9A-F\.]*)\(([^\*]*?)\*?([a-zA-Z]*)\)/);
		if (matches) {
			var cat = matches[1];
			var value = parseFloat(matches[2]);
			var unit = matches[3];
			helper.log.trace(mapping[cat] + ' (' + cat + '): ' + value + (unit ? ' ' + unit : ''));
			if (mapping[cat] && !isNaN(value)) {
				result[mapping[cat]] = value;
			}
		}
	});
	var query = connection.query('INSERT INTO powerdata SET ?', result, function(err, result) {
		if (err) {
			helper.log.error('powermeter insert failed: ' + err);
		} else {
			helper.log.debug('powermeter storage updated');
		}
	});
};

var currentPower = function (callback) {
	var sql = 'SELECT id, (SELECT MIN(ts) FROM powerdata) AS min, ts AS max, kwh, v1, v2, v3, a1, a2, a3, pf, hz, outages, kw FROM powerdata ORDER BY id DESC LIMIT 1';
	var query = connection.query(sql, function(err, result, fields, res) {
		if (err) {
			helper.log.error('currentPower query failed: ' + err);
			callback(false);
		} else {
			if (result.length == 1) {
				callback(true, result[0]);
			} else {
				callback(false);
			}
		}
	});
};

module.exports.inputPowermeter = inputPowermeter;
module.exports.currentPower = currentPower;
