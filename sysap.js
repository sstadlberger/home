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

var sysap = new xmpp_client({
	'bosh': {
		'url': config.bosh.url
	},
	'jid': config.bosh.jid + '/' + config.bosh.resource,
	'password': config.bosh.password,
	'preferred': 'DIGEST-MD5'
});

sysap.on('online', function() {
	helper.log.info('sysap online');
	
	var talkToMe =  new xmpp_client.Element('presence', {
		'from': config.bosh.jid,
		'type': 'subscribe',
		'to': 'mrha@busch-jaeger.de/rpc',
		'xmlns': 'jabber:client'
	});
	sysap.send(talkToMe);
	
	var talkToMe2 =  new xmpp_client.Element('presence', {
		'xmlns': 'jabber:client'
	})
		.c('c', {
			'xmlns': 'http://jabber.org/protocol/caps',
			'ver': '1.0',
			'node': 'http://gonicus.de/caps',
		});
	sysap.send(talkToMe2);
	
	helper.log.debug('request subscribe');
	
	sysap_internal.all();
});

sysap.on('stanza', function(stanza) {
	
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
		
		helper.log.debug('result packet received');
		sysap_internal.response(stanza, data);
		sysap_internal.status(data);
	
	
	} else if (stanza.getName() == 'presence') {
		helper.log.debug('presence packet received');
		sysap_internal.presence(stanza);
	
	
	// EVERYTHING ELSE
	} else {
		helper.log.warn('unknown stanza');
	}
	
	helper.log.trace(stanza.toString());
	
});

sysap.on('error', function (e) {
	helper.log.error('sysap error:');
	helper.log.error(e);
});

Object.assign(module.exports, { 'getData': function (what) { return data[what]; } });
Object.assign(module.exports, { 'setStructure': function (structure) { data.structure = structure; } });
Object.assign(module.exports, { 'sysap': sysap });

sysap_internal.updateStructure(false);
