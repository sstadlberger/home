/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var nodejsWebsocket = require('nodejs-websocket');
var sysap_external = require('../freeathome/sysap-external');
var data = require('../data');
var helper = require('../helper');
var config = require('../../config/config');
var md5 = require('md5');

var valid = ['set', 'info', 'structure', 'raw', 'status', 'update', 'logLevel', 'logFilter', 'weather', 'message', 'powermeter', 'daynight'];

var socket = nodejsWebsocket.createServer(function (conn) {
	helper.log.info('[' + conn.socket.remoteAddress + '] websocket started');
	conn.on('text', function (str) {
		var parts = str.split('/');
		if (valid.indexOf(parts[0]) != -1) {
			set(parts, conn);
		} else {
			conn.sendText(JSON.stringify({'error': 'invalid command: ' + parts[0] + ' (' + str + ')'}));
			helper.log.debug('[' + conn.socket.remoteAddress + '] invalid websocket command: ' + parts[0] + ' (' + str + ')');
		}
	});
	conn.on('close', function (code, reason) {
		helper.log.info('websocket closed');
	});
	conn.on('error', function (err) {
		switch (err.code) {
			// most of these errors are cause by a sudden client disconnect
			// e.g. closing the browser window or turning off the computer
			case 'ECONNRESET':
				helper.log.error('client has exited ungracefully (ECONNRESET)');
				break;
			case 'EHOSTUNREACH':
				helper.log.error('where has the client gone? (EHOSTUNREACH)');
				break;
			case 'ETIMEDOUT':
				helper.log.error('where has the client gone? (ETIMEDOUT)');
				break;
			case 'EHOSTDOWN':
				helper.log.error('where has the client gone? (EHOSTDOWN)');
				break;
			case 'EPIPE':
				helper.log.error('where has the client gone? (EPIPE)');
				break;
			default:
				helper.log.error(err.code);
				throw err;
		}
	})
}).listen(config.socketapi.port);

function set (d, conn) {
	var command = d.shift();
	switch (command) {
		case 'info':
				helper.log.debug('[' + conn.socket.remoteAddress + '] info call');
				var actuators = data.getData('actuators');

				if (d.length >= 1 && actuators[d[0]]) {
					actuators = actuators[d[0]];
					if (d.length >= 2 && actuators.channels[d[1]]) {
						actuators = actuators.channels[d[1]];
						if (d.length >= 3 && actuators.datapoints[d[2]]) {
							actuators = actuators.datapoints[d[2]];
						}
					}
				}

				conn.sendText(JSON.stringify({'result': actuators}));
			break;
		case 'set':
			if (d.length == 4 || d.length == 5) {
				helper.log.debug('set channel ' + d[2] + ' of ' + d[0] + ' ' + d[1] + ' to ' + d[3] + (d.length == 5 ? ' (' + d[4] + ')' : ''));
				var status = sysap_external.parse(d[0], d[1], d[2], d[3], (d.length == 5 ? d[4] : null));
				conn.sendText(JSON.stringify({'result': status}));
			} else {
				conn.sendText(JSON.stringify({'error': 'invalid set command: ' + d.join('/')}));
				helper.log.error('[' + conn.socket.remoteAddress + '] invalid set command: ' + d.join('/'));
			}
			break;

		case 'raw':
			if (d.length == 4) {
				helper.log.debug('raw set: ' + d[0] + '/' + d[1] + '/' + d[2] + ': ' + d[3]);
				var status = sysap_external.set(d[0], d[1], d[2], d[3]);
				conn.sendText(JSON.stringify({'result': status}));
			} else {
				conn.sendText(JSON.stringify({'error': 'invalid raw command: ' + d.join('/')}));
				helper.log.error('[' + conn.socket.remoteAddress + '] invalid raw command: ' + d.join('/'));
			}
			break;

		case 'weather':
			var weather = data.getActuatorData('weather', 'ch0000');
			conn.sendText(JSON.stringify({'weather': weather}));
			break;

		case 'daynight':
			var daynight = data.getActuatorData('daynight', 'ch0000');
			conn.sendText(JSON.stringify({'daynight': daynight}));
			break;

		case 'status':
			var status = data.getData('status');
			conn.sendText(JSON.stringify({'status': status}));
			break;

		case 'structure':
			var structure = data.getData('structure');
			conn.sendText(JSON.stringify({'structure': structure}));
			break;

		case 'update':
			if (d.length == 1 && d[0] == 'all') {
				sysap_external.updateAll();
				conn.sendText(JSON.stringify({'result': 'requested master update'}));
			} else {
				data.updateStructure();
				conn.sendText(JSON.stringify({'result': 'pushed update'}));
			}
			break;

		case 'logLevel':
			if (d.length == 1) {
				var newlogLevel = d[0];
				var valid = Object.keys(helper.log.logLevel);
				if (valid.indexOf(newlogLevel) == -1) {
					conn.sendText(JSON.stringify({'error': 'invalid logLevel command: ' + newlogLevel}));
					helper.log.error('[' + conn.socket.remoteAddress + '] invalid logLevel command: ' + newlogLevel);
				} else {
					global.logLevel = helper.log.logLevel[newlogLevel];
					conn.sendText(JSON.stringify({'result': 'logLevel set to ' + newlogLevel}));
					helper.log.info('[' + conn.socket.remoteAddress + '] logLevel set to ' + newlogLevel);
				}
			} else {
				conn.sendText(JSON.stringify({'error': 'invalid logLevel command: ' + d.join(' ')}));
				helper.log.error('[' + conn.socket.remoteAddress + '] invaild logLevel command: ' + d.join('/'));
			}
			break;

		case 'logFilter':
			if (d.length < 1 || (d.length == 1 && d[0] == '')) {
				global.logFilter = false;
				helper.log.info('logFilter disabled');
			} else {
				helper.log.info('logFilter set to: ' + d.join('/'));
				global.logFilter = d.join('/');
			}
			break;

		case 'message':
			helper.log.info('[' + conn.socket.remoteAddress + '] websocket message: ' + d.join('/'));
			break;

		case 'powermeter':
			helper.log.info('[' + conn.socket.remoteAddress + '] Power Meter: ' + "\n" + d.join('/'));
			break;

		default:
			helper.log.error('[' + conn.socket.remoteAddress + '] unknown command: ' + command);
	}
}

var lastBroadcast = '';

/**
 * sends a message to all currently connected clients
 * The message is usually an encoded JSON or plain text. A message is only sent if the message is different from the previous message (md5).
 *
 * @param {String} msg
 */
var broadcast = function (msg, checkMD5 = true) {
	var msgMD5 = md5(msg);
	// not every update from the sysap contains info that is relevant for the interface (e.g. switch pressed event)
	if (!checkMD5 || msgMD5 != lastBroadcast) {
		helper.log.debug('broadcast message');
		socket.connections.forEach(function (conn) {
			try {
				conn.sendText(msg);
			}
			catch (e) {
				helper.log.error(e);
			}
		});
	}
	if (checkMD5) {
		lastBroadcast = msgMD5;
	}
};

module.exports.broadcast = broadcast;
