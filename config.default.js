var config = {};

// config for Busch Jäger free@home
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


// config for Homematic
config.homematic = {
	ccuIP: 'CCUIP',
	ccuPort: '2001',
	localPort: '8030'
}


// used for weather (optional)
config.location = {
	lat: '1.2345',
	long: '1.2345'
};

config.weather = {
	url: 'https://api.forecast.io/forecast/APIKEY/' + config.location.lat + ',' + config.location.long + '?units=si&lang=de'
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
