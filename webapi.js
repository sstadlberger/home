var http = require('http');
var router = require('router');
var finalhandler = require('finalhandler');
var compression = require('compression');
var sysap = require('./sysap.js');

var rt = router();
var server = http.createServer(function onRequest(req, res) {
	rt(req, res, finalhandler(req, res));
});
 
rt.use(compression());
 
rt.get('/test', function (req, res) {
	res.statusCode = 200;
	res.setHeader('Content-Type', 'text/plain; charset=utf-8');
	res.end(sysap.test('asd') + '\n');
});
 
rt.get('/info', function (req, res) {
	res.statusCode = 200;
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.end(sysap.info() + '\n');
});

server.listen(8080);
