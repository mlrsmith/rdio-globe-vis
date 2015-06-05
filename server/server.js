var ws = require("ws");
var http = require("http");
var split = require("split");

var server = http.createServer();

server.listen(8081, function() { console.log("Started!"); });

var wss = new ws.Server({server: server});

/*
wss.on("connection", function(ws) {
  var id = setInterval(function() {
    data = { plays: [
      {
        lat: (Math.random() - 0.5) * 360,
        lon: (Math.random() - 0.5) * 360
      }
    ]};

    ws.send(JSON.stringify(data));
  }, 1000);

  ws.on("close", function() {
    clearInterval(id);
  });

});
*/

console.log("Starting");

clientId = 0;
clients = {};

function sendToConnectedClients(payload) {

  for (var i in clients) {
    clients[i].send(JSON.stringify(payload));
  }
}

process.stdin.pipe(split()).on('data', function(line) {
  // console.log("Received message: "+data);
  data = JSON.parse(line)

  // We could send these in batches but don't currently.
  payload = {
    plays: [
      {
        lat: data.latitude,
        lon: data.longitude
      }
    ]
  };
  sendToConnectedClients(payload);
});

wss.on("connection", function(ws) {
  clientId++;
  clients[clientId] = ws;

  ws.on("close", function(code, message) {
    delete clients[clientId];
  });
  ws.on("error", function(code, message) {
    delete clients[clientId];
  });
});


