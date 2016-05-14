var xmpp_client = require('node-xmpp-client');
var config = require('./config.js');
var helper = require('./helper.js');
var sysap_internal = require('./sysap-internal.js');
var sysap_external = require('./sysap-external.js');

// this set of vars contains/will contain the master status
var data = {
	'house': {
		'floor': {},
		'room': {}
	},
	'actuators': {},
	'strings': {},
	'status': [],
	'structure': []
};
var count = 0;
var lastping;
var subscribed = false;

var sysap = new xmpp_client({
	'websocket': {
		'url': config.websocket.url
	},
	'jid': config.websocket.jid + '/' + config.websocket.resource,
	'password': config.websocket.password,
	'preferred': 'DIGEST-MD5'
});

sysap.on('online', function() {
	helper.log.info('sysap online');
	keepAlive();
	sysap_internal.subscribe();
});

sysap.on('stanza', function(stanza) {
	
	helper.log.trace('[RECEIVED] ' + stanza.toString());
	
	// UPDATE PACKET
	if (stanza.getName() == 'message' &&
		stanza.attrs.type == 'headline' && 
		stanza.attrs.from == 'mrha@busch-jaeger.de' && 
		helper.ltx.getElementAttr(stanza, ['event', 'items'], 'node') == 'http://abb.com/protocol/update') {
		
		helper.log.debug('update packet received');
		sysap_internal.update(stanza, data);
		sysap_internal.status(data);
	
	
	// MASTER STATUS UPDATE
	} else if (stanza.getName() == 'iq' &&
			   stanza.attrs.type == 'result' && 
			   stanza.attrs.from == 'mrha@busch-jaeger.de/rpc') {
		if (stanza.attrs.id == lastping) {
			// ping result;
			helper.log.trace('ping result packet received');
		} else {
			helper.log.debug('result packet received');
			sysap_internal.response(stanza, data);
			sysap_internal.status(data);
		}
	
	} else if (stanza.getName() == 'presence') {
		helper.log.debug('presence packet received');
		var is_sysap = sysap_internal.presence(stanza);
		if (is_sysap && !subscribed) {
			sysap_internal.subscribed();
			sysap_internal.all();
			subscribed = true;
		}
	
	// EVERYTHING ELSE
	} else {
		helper.log.warn('unknown stanza');
	}
	
});

sysap.on('error', function (e) {
	helper.log.error('sysap error:');
	helper.log.error(e);
});


function keepAlive () {
	count++;
	var ping = new xmpp_client.Element('iq', {
		type: 'get',
		to: 'mrha@busch-jaeger.de/rpc',
		id: count,
		xmlns: 'jabber:client'
	})
		.c('ping', {
			xmlns: 'urn:xmpp:ping'
		})
	helper.log.trace('[SEND] ' + ping.root().toString());
	lastping = count;
	sysap.send(ping);
	
	setTimeout(keepAlive, 10 * 1000);
}

var setDP = function (sn, cn, dp, value) {
	if (!data.actuators[sn]) {
		data.actuators[sn] = {
			'serialNumber': sn,
			'channels': {}
		};
	}
	if (!data.actuators[sn]['channels'][cn]) {
		data.actuators[sn]['channels'][cn] = {
			'datapoints': {}
		};
	}
	data.actuators[sn]['channels'][cn]['datapoints'][dp] = value;
	sysap_internal.status(data);
}

Object.assign(module.exports, { 'getData': function (what) { return data[what]; } });
Object.assign(module.exports, { 'setDP': setDP });
Object.assign(module.exports, { 'setStructure': function (structure) { data.structure = structure; } });
Object.assign(module.exports, { 'sysap': sysap });

sysap_internal.updateStructure(false);
