var xmpp_client = require('node-xmpp-client');
var config = require('./config.js');
var helper = require('./ltxhelper.js');
var sysap_external = require('./sysap-external.js');
var sysap_internal = require('./sysap-internal.js');

// this set of vars contains/will contain the master status
var data = {
	house : {
		floor : {},
		room : {}
	},
	actuators : {},
	strings : {}
};

var sysap = new xmpp_client({
	bosh: {
		url: config.bosh.url
	},
	jid: config.bosh.jid + '/' + config.bosh.resource,
	password: config.bosh.password,
	preferred: 'DIGEST-MD5'
});

sysap.on('online', function() {
	console.log('[SYSAP] online');
	
	var talkToMe =  new xmpp_client.Element('presence', {
		from: config.bosh.jid,
		type: 'subscribe',
		to: 'mrha@busch-jaeger.de/rpc',
		xmlns: 'jabber:client'
	});
	sysap.send(talkToMe);
	
	var talkToMe2 =  new xmpp_client.Element('presence', {
		xmlns: 'jabber:client'
	})
		.c('c', {
			xmlns: 'http://jabber.org/protocol/caps',
			ver: '1.0',
			node: 'http://gonicus.de/caps',
		});
	sysap.send(talkToMe2);
	
	console.log('[OUT] subscribe');
	
	sysap_internal.all();
});

sysap.on('stanza', function(stanza) {
	
	// UPDATE PACKET
	if (stanza.getName() == 'message' &&
		stanza.attrs.type == 'headline' && 
		stanza.attrs.from == 'mrha@busch-jaeger.de' && 
		helper.getElementAttr(stanza, ['event', 'items'], 'node') == 'http://abb.com/protocol/update') {
		
		console.log('[IN] update packet');
		sysap_internal.update(stanza, data);
	
	
	// MASTER STATUS UPDATE
	} else if (stanza.getName() == 'iq' &&
			   stanza.attrs.type == 'result' && 
			   stanza.attrs.from == 'mrha@busch-jaeger.de/rpc') {
		
		console.log('[IN] result packet');
		sysap_internal.response(stanza, data);
	
	
	} else if (stanza.getName() == 'presence') {
		console.log('[IN] presence');
		sysap_internal.presence(stanza);
	
	
	// EVERYTHING ELSE
	} else {
		console.log('[IN] unknown stanza:');
		console.log(stanza.toString());
	}
	
});

sysap.on('error', function (e) {
	console.log(e)
});

Object.assign(module.exports, { getData : function (what) { return data[what]; } });
Object.assign(module.exports, { sysap : sysap });
Object.assign(module.exports, sysap_internal);
Object.assign(module.exports, sysap_external);
