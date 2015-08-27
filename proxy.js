var fs = require('fs');
var httpProxy = require('http-proxy');


// use environment variables if present.
var httpPort = process.env.PORT || 3000;
var httpsPort = process.env.HTTPS_PORT || 443;


//
// Create the proxy server listening on httpsPort, defaulting to 443
//
var proxy = httpProxy.createProxyServer({
    ssl: {
        key: fs.readFileSync('cert/key.pem', 'utf8'),
        cert: fs.readFileSync('cert/cert.pem', 'utf8')
    },
    target: 'http://localhost:' + httpPort,
    secure: false
}).listen(httpsPort);

proxy.on('error', function(e, req, res) {
    res.writeHead(500, {
        'Content-Type': 'text/plain'
    });
    res.end('An error occurred with the proxied application.\n  Perhaps it is not currently running.');
});

// add 'X-Forwarded-For' header
proxy.on('proxyRes', function(e, req, res) {
    res.setHeader('X-Forwarded-For', req.connection.remoteAddress);
});

console.log('Reverse proxy is proxying :' + httpPort + ' and listening on :' + httpsPort);
