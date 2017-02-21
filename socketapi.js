/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var nodejsWebsocket = require('nodejs-websocket');
var sysap_external = require('./sysap-external.js');
var data = require('./data.js');
var helper = require('./helper.js');
var md5 = require('md5');

var valid = ['set', 'info', 'structure', 'raw', 'status', 'update', 'loglevel', 'weather', 'message', 'powermeter'];

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
}).listen(8001);

function set (d, conn) {
	var command = d.shift();
	switch (command) {
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
			var weather = data.getData('weather');
			conn.sendText(JSON.stringify({'weather': weather}));
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
				sysap_external.updateStructure();
				conn.sendText(JSON.stringify({'result': 'pushed update'}));
			}
			break;
			
		case 'loglevel':
			if (d.length == 1) {
				var newLoglevel = d[0];
				var valid = Object.keys(helper.log.loglevel);
				if (valid.indexOf(newLoglevel) == -1) {
					conn.sendText(JSON.stringify({'error': 'invalid loglevel command: ' + newLoglevel}));
					helper.log.error('[' + conn.socket.remoteAddress + '] invalid loglevel command: ' + newLoglevel);
				} else {
					global.loglevel = helper.log.loglevel[newLoglevel];
					conn.sendText(JSON.stringify({'result': 'loglevel set to ' + newLoglevel}));
					helper.log.info('[' + conn.socket.remoteAddress + '] loglevel set to ' + newLoglevel);
				}
			} else {
				conn.sendText(JSON.stringify({'error': 'invalid loglevel command: ' + d.join(' ')}));
				helper.log.error('[' + conn.socket.remoteAddress + '] invaild loglevel command: ' + d.join('/'));
			}
			break;
		
		case 'message':
			helper.log.info('[' + conn.socket.remoteAddress + '] websocket message: ' + d.join('/'));
			break;
		
		case 'powermeter':
			helper.log.info('[' + conn.socket.remoteAddress + '] Power Meter: ' + "\n" + d.join('/'));
			break;
		
		default:
			helper.log.error('[' + conn.socket.remoteAddress + '] should not reach this code block');
	}
}

var lastBroadcast = '';

/**
 * sends a message to all currently connected clients
 * The message is usually an encoded JSON or plain text. A message is only sent if the message is different from the previous message (md5).
 * 
 * @param {String} msg
 */
var broadcast = function (msg) {
	var msgMD5 = md5(msg);
	// not every update from the sysap contains info that is relevant for the interface (e.g. switch pressed event)
	if (msgMD5 != lastBroadcast) {
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
	lastBroadcast = msgMD5;
}

module.exports.broadcast = broadcast;
