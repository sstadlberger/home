var config = {};

config.bosh = {
	url: 'http://URL_TO_SYSAP:5280/http-bind',
	jid: 'JID@busch-jaeger.de',
	resource: 'nodeapi',
	password: 'PASSWORD'
};

config.websocket = {
	url: 'ws://URL_TO_SYSAP:5280/xmpp-websocket/',
	jid: 'JID@busch-jaeger.de',
	resource: 'nodeapi',
	password: 'PASSWORD'
};

config.weather = {
	url: 'https://api.forecast.io/forecast/APIKEY/LAT,LONG?units=si&lang=de'
};

module.exports = config;