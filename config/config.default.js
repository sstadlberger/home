var SYSAP_HOST = 'SYSAP_HOSTNAME_OR_IP';
var SYSAP_JID = 'JID@busch-jaeger.de';
var SYSAP_PASSWORD = 'PASSWORD';

var SOCKET_API_PORT = 8001;
var WEB_API_PORT = 8080;

var config = {};

config.socketapi = {
	port: SOCKET_API_PORT
};

config.webapi = {
	port: WEB_API_PORT
};

// config for Busch Jäger free@home
config.bosh = {
	url: 'http://' + SYSAP_HOST + ':5280/http-bind',
	jid: SYSAP_URL,
	resource: 'nodeapi',
	password: SYSAP_PASSWORD
};

config.websocket = {
	url: 'ws://' + SYSAP_HOST + ':5280/xmpp-websocket/',
	jid: SYSAP_JID,
	resource: 'nodeapi',
	password: SYSAP_PASSWORD
};

// config for Homematic
config.homematic = {
	ccuIP: 'CCUIP',
	ccuPort: '2001',
	localPort: '8030'
};

// used for weather (optional)
config.location = {
	lat: '1.2345',
	long: '1.2345'
};

// config for weather
config.weather = {
	host: 'api.forecast.io',
	path: '/forecast/APIKEY/' + config.location.lat + ',' + config.location.long + '?units=si&lang=de'
};

//  used for data storage (optional)
config.mysql = {
	host : 'localhost',
	user : 'root',
	password : '',
	database : 'db',
	port : 3306
};


module.exports = config;
