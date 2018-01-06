/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 

var xmpp_client = require('node-xmpp-client');
var fs = require('fs');
var config = require('../../config/config');
var helper = require('../helper');
var data = require('../data');
var sysap_internal = require('./sysap-internal');
var sysap_external = require('./sysap-external');

var count = 0;
var lastping;
var subscribed = false;

/**
 * @var {object} sysap setup xmpp client object that will handle all communication with the SysAP
 */
var sysap = new xmpp_client({
	'websocket': {
		'url': config.websocket.url
	},
	'jid': config.websocket.jid + '/' + config.websocket.resource,
	'password': config.websocket.password,
	'preferred': 'DIGEST-MD5'
});

/**
 * This function is called when the connection is established to the SysAP.
 * The keep alive pings are triggered here as well and will continue to be sent every 10 seconds.
 * Afterwards a subscription packet is send to subscribe to mrha@busch-jaeger.de to receive
 * updates of all activities on the SysAP
 */
sysap.on('online', function() {
	helper.log.info('sysap online');
	keepAlive(10);
	sysap_internal.subscribe();
});

/**
 * This function parses the resonses from the SysAP and reactes accordingly
 * @param {object} stanza the stanza (xml object) that is received from the SysAP
 */
sysap.on('stanza', function(stanza) {
	
	helper.log.trace('[RECEIVED] ' + stanza.toString());
	
	/**
	 * a generic status update:
	 * from: mrha@busch-jaeger.de
	 * name: message
	 * type: headline
	 * contains a xml object with all changes since the last update
	 * the resulting content is parsed and updated in the master data object
	 */
	if (stanza.getName() == 'message' &&
		stanza.attrs.type == 'headline' && 
		stanza.attrs.from == 'mrha@busch-jaeger.de' && 
		helper.ltx.getElementAttr(stanza, ['event', 'items'], 'node') == 'http://abb.com/protocol/update') {
		
		helper.log.debug('update packet received');
		// parse the object
		sysap_internal.update(stanza);
		// update the data model
		data.status();
	
	/**
	 * master status update
	 * from: mrha@busch-jaeger.de
	 * name: iq
	 * type: result
	 * This receives and parses a master data object. This is a massive XML object that
	 * contains the complete current status of the SysAP. This replaces all SysAP information
	 * in the master data object with this information
	 */
	} else if (stanza.getName() == 'iq' &&
			   stanza.attrs.type == 'result' && 
			   stanza.attrs.from == 'mrha@busch-jaeger.de/rpc') {
		if (stanza.attrs.id == lastping) {
			// ping result;
			helper.log.trace('ping result packet received');
		} else {
			helper.log.debug('result packet received');
			// parse the master object
			sysap_internal.masterUpdate(stanza);
			// update the data model
			data.status();
		}
	
	/**
	 * xmpp presence
	 * name: presence
	 * to receive realtime updates from the SysAP, this software must be subscribed to the 
	 * mrha@busch-jaeger.de user. If the subscription was successful, it is confirmed and a
	 * master status update request is sent.
	 */
	} else if (stanza.getName() == 'presence') {
		helper.log.debug('presence packet received');
		var is_sysap = sysap_internal.presence(stanza);
		if (is_sysap && !subscribed) {
			// send subscription confirmation 
			sysap_internal.subscribed();
			// request master status update
			sysap_internal.all();
			subscribed = true;
		}
	
	/**
	 * A generic catch-all handler
	 */
	} else {
		helper.log.warn('unknown stanza');
	}
	
});

/**
 * generic error handler, just catches the error and prints out the error message
 */
sysap.on('error', function (e) {
	helper.log.error('sysap error:');
	helper.log.error(e);
});

/**
 * sends a keep alive packet every ten seconds to the SysAP
 * @param {number} seconds how long to wait to between sending keep alive packets
 */
function keepAlive (seconds) {
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
	setTimeout(
		function () {
			keepAlive(seconds);
		}, 
		seconds * 1000
	);
}

data.updateStructure();

module.exports.sysap = sysap;