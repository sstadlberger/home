/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var mysql = require('mysql');
var helper = require('./helper.js');
var config = require('./config.js');
var connection;
var isConnected = false;

/**
 * connects to the mySQL DB, sets error handling and checks if the connection is
 * functional
 */
var _connectDB = function () {
	connection = mysql.createConnection({
		host: config.mysql.host,
		user: config.mysql.user,
		password: config.mysql.password,
		database: config.mysql.database,
		port: config.mysql.port
	});
		
	connection.on('error', function(err) {
		helper.log.error('DB error: ' + err.code);
		_connectionTest(_reconnectDB);
	});
	
	connection.connect();
	_connectionTest();
}

/**
 * reconnects to the mySQL DB if the connection is not working after waiting for three
 * seconds
 */
var _reconnectDB = function () {
	if (!isConnected) {
		helper.log.info('trying to reconnect to DB in 3 seconds.');
		setTimeout(_connectDB, 3000);
	}
}

/**
 * tests the connection to the mySQL DB with a simple query
 * if the test fails, a reconnect is attempted
 * @var {boolean} isConnected is set to true if the connection works
 * 
 * @param {function} callback - if set, it is called after the connection check
 */
var _connectionTest = function (callback) {
	connection.query('SELECT 1;', function (err, rows, fields) {
		if (err) {
			helper.log.error('could not connect to DB: ' + err);
			isConnected = false;
			_reconnectDB();
		} else {
			helper.log.info('connected to DB');
			isConnected = true;
		}
		if (callback) {
			callback();
		}
	});
}

if (global.useDB) {
	_connectDB();
	// ping the db every hour to prevent timeout if db is not accessed regularly 
	setInterval(_connectionTest, 1000 * 60 * 60);
}


/**
 * parses and inserts the power meter data into the db
 * 
 * @param {string} data - raw input from the power meter
 */
var inputPowermeter = function (data) {
	var mapping = {
		'1.8.0': 'kwh_in',
		'2.8.0': 'kwh_out',
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
	if (global.useDB && isConnected) {
		var query = connection.query('INSERT INTO powerdata SET ?', result, function (err, result) {
			if (err) {
				helper.log.error('powermeter insert failed: ' + err);
			} else {
				helper.log.debug('powermeter storage updated');
			}
		});
	} else {
		if (global.useDB) {
			helper.log.warn('Data was not written to DB because DB support is disabled.');
		} else {
			helper.log.warn('Data was not written to DB because DB is not connected.');
		}
	}
};

/**
 * returns the latest power meter dataset from the db
 * 
 * @param {function} callback - is called with true and the result row if succesful or with false for failure
 */
var currentPower = function (callback) {
	var sql = 'SELECT id, (SELECT MIN(ts) FROM powerdata) AS min, ts AS max, kwh_in, kwh_out, v1, v2, v3, a1, a2, a3, pf, hz, outages, kw FROM powerdata ORDER BY id DESC LIMIT 1';
	if (global.useDB && isConnected) {
		var query = connection.query(sql, function (err, result, fields, res) {
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
	} else {
		if (global.useDB) {
			helper.log.warn('Data was not written to DB because DB support is disabled.');
		} else {
			helper.log.warn('Data was not written to DB because DB is not connected.');
		}
		callback(false);
	}
};

module.exports.inputPowermeter = inputPowermeter;
module.exports.currentPower = currentPower;
