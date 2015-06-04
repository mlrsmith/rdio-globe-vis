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

wss.on("connection", function(ws) {
  var received = 0
  process.stdin.pipe(split()).on('data', function(line) {
    received += 1;

    if (true) {
      data = JSON.parse(line)
      console.log("Received message: "+data);

      data = { plays: [
        {
          lat: data.latitude,
          lon: data.longitude
        }
      ]};
      ws.send(JSON.stringify(data));
    }

  });
});


