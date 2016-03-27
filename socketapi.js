var nodejsWebsocket = require('nodejs-websocket');
var sysap_external = require('./sysap-external.js');
var helper = require('./helper.js');
var md5 = require('md5');

var valid = ['set', 'info', 'structure', 'raw', 'status', 'update'];

var socket = nodejsWebsocket.createServer(function (conn) {
	helper.log.info('websocket started');
	conn.on('text', function (str) {
		var parts = str.split('/');
		if (valid.indexOf(parts[0]) != -1) {
			set(parts, conn);
		} else {
			conn.sendText(JSON.stringify({'error': 'invaild command: ' + parts[0] + ' (' + str + ')'}));
			helper.log.debug('invaild websocket command: ' + parts[0] + ' (' + str + ')');
		}
	});
	conn.on('close', function (code, reason) {
		helper.log.info('websocket closed');
	});
}).listen(8001);

function set (data, conn) {
	var command = data.shift();
	switch (command) {
		case 'set':
        	if (data.length == 4) {
				var status = sysap_external.parse(data[0], data[1], data[2], data[3]);
				conn.sendText(JSON.stringify({'result': status}));
			} else {
				conn.sendText(JSON.stringify({'error': 'invaild websocket set command: ' + data.join('/')}));
				helper.log.debug('invaild set command: ' + data.join('/'));
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
			conn.sendText(msg);
		});
	}
	lastBroadcast = msgMD5;
}

module.exports.broadcast = broadcast;
