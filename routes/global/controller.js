// routes/global/controller.js

//  DO NOT require any route or app files here
// ✅ Only require services, utils, or models

exports.ping = (req, res) => {
  res.json({
    status: 'success',
    message: 'pong',
    timestamp: new Date().toISOString()
  });
};

exports.getVersion = (req, res) => {
  res.json({
    status: 'success',
    version: '1.0.0',
    name: 'XIBO Components API'
  });
};