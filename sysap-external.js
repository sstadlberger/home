var xmpp_client = require('node-xmpp-client');

var info = function (what) {
	return module.parent.exports.getData('actuators');
};

var set = function (sn, ch, dp, vl) {
	var setData = new xmpp_client.Element('iq', {
		type: 'set',
		to: 'mrha@busch-jaeger.de/rpc',
	})
		.c('query', {
			xmlns: 'jabber:iq:rpc'
		})
			.c('methodCall', {})
				.c('methodName', {})
					.t('RemoteInterface.setDatapoint').up()
				.c('params', {})
					.c('param', {})
						.c('value', {})
							.c('string', {})
								.t(sn + '/' + ch + '/' + dp)
								.up()
							.up()
						.up()
					.c('param', {})
						.c('value', {})
							.c('string', {})
								.t(vl);
	
	module.parent.exports.sysap.send(setData);
	console.log('[OUT] set actuator: ' + sn + '/' + ch + '/' + dp + ': ' + vl);
}

module.exports.info = info;
module.exports.set = set;