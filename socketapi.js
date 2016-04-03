var nodejsWebsocket = require('nodejs-websocket');
var sysap_external = require('./sysap-external.js');
var helper = require('./helper.js');
var md5 = require('md5');

var valid = ['set', 'info', 'structure', 'raw', 'status', 'update', 'loglevel'];

var socket = nodejsWebsocket.createServer(function (conn) {
	helper.log.info('websocket started');
	conn.on('text', function (str) {
		var parts = str.split('/');
		if (valid.indexOf(parts[0]) != -1) {
			set(parts, conn);
		} else {
			conn.sendText(JSON.stringify({'error': 'invalid command: ' + parts[0] + ' (' + str + ')'}));
			helper.log.debug('invalid websocket command: ' + parts[0] + ' (' + str + ')');
		}
	});
	conn.on('close', function (code, reason) {
		helper.log.info('websocket closed');
	});
	conn.on('error', function (err) {
		switch (err) {
			// most of these errors are cause by a sudden client disconnect
			// e.g. closing the browser window
			case 'ECONNRESET':
				helper.log.error('client has exited ungracefully (ECONNRESET)');
				break;
			case 'EHOSTUNREACH':
				helper.log.error('where has the client gone? (EHOSTUNREACH)');
				break;
			default:
				helper.log.error(err.code);
				throw err;
		}
	})
}).listen(8001);

function set (data, conn) {
	var command = data.shift();
	switch (command) {
		case 'set':
			if (data.length == 4 || data.length == 5) {
				helper.log.debug('set channel ' + data[2] + ' of ' + data[0] + ' ' + data[1] + ' to ' + data[3] + (data.length == 5 ? ' (' + data[4] + ')' : ''));
				var status = sysap_external.parse(data[0], data[1], data[2], data[3], (data.length == 5 ? data[4] : null));
				conn.sendText(JSON.stringify({'result': status}));
			} else {
				conn.sendText(JSON.stringify({'error': 'invalid set command: ' + data.join('/')}));
				helper.log.error('invalid set command: ' + data.join('/'));
			}
			break;
			
		case 'raw':
			if (data.length == 4) {
				helper.log.debug('raw set: ' + data[0] + '/' + data[1] + '/' + data[2] + ': ' + data[3]);
				var status = sysap_external.set(data[0], data[1], data[2], data[3]);
				conn.sendText(JSON.stringify({'result': status}));
			} else {
				conn.sendText(JSON.stringify({'error': 'invalid raw command: ' + data.join('/')}));
				helper.log.error('invalid raw command: ' + data.join('/'));
			}
			break;
		
		case 'status':
			var status = sysap_external.info('status');
			conn.sendText(JSON.stringify({'status': status}));
			break;
		
		case 'structure':
			var structure = sysap_external.info('structure');
			conn.sendText(JSON.stringify({'structure': structure}));
			break;
		
		case 'update':
			sysap_external.updateStructure(true);
			conn.sendText(JSON.stringify({'result': 'pushed update'}));
			break;
			
		case 'loglevel':
			if (data.length == 1) {
				var newLoglevel = data[0];
				var valid = Object.keys(helper.log.loglevel);
				if (valid.indexOf(newLoglevel) == -1) {
					conn.sendText(JSON.stringify({'error': 'invalid loglevel command: ' + newLoglevel}));
					helper.log.error('invalid loglevel command: ' + newLoglevel);
				} else {
					global.loglevel = helper.log.loglevel[newLoglevel];
					conn.sendText(JSON.stringify({'result': 'loglevel set to ' + newLoglevel}));
					helper.log.info('loglevel set to ' + newLoglevel);
				}
			} else {
				conn.sendText(JSON.stringify({'error': 'invalid loglevel command: ' + data.join(' ')}));
				helper.log.error('invaild loglevel command: ' + data.join('/'));
			}
			break;
			
		default:
			helper.log.error('should not reach this code block');
	}
}

var lastBroadcast = '';

var broadcast = function (msg) {
	var msgMD5 = md5(msg);
	// not every update from the sysap contains info that is relevant for the interface (e.g. switch pressed event)
	if (msgMD5 != lastBroadcast) {
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
