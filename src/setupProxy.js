const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use('/web', createProxyMiddleware({
    target: 'http://127.0.0.1:8069', // IPv4 صریح
    changeOrigin: true,
    logLevel: 'debug',
    onError(err, req, res) {
      console.error('Proxy error:', err);
      res.status(500).send('Proxy error');
    }
  }));
};
