if(!Detector.webgl){
  Detector.addGetWebGLMessage();
} else {

  var container = document.getElementById('container');
  var globe = new DAT.Globe(container);

  console.log(globe);

  N = 5000;
  // The last N received data points, raw.
  all_data_points = [];

  var points_mesh = null;

  var ws = new WebSocket("ws://localhost:8081/websocket/playdata");
  ws.onmessage = function(event) {
    //console.log(event.data);
    data = JSON.parse(event.data);

    // data looks like (TODO: add more info):
    // {
    //   plays: [
    //     {
    //       lat: -123.2,
    //       lon: 19.2
    //     }
    //   ]
    // }
    //    

    for (var i = 0; i < data.plays.length; i++) {
      all_data_points.push(data.plays[i]);
    }

    if (all_data_points.length > N) {
      all_data_points.splice(0, all_data_points.length - N);
    }
  };

  function replacePoints() {
    data_array = [];
    buckets = {};
    for (i = 0; i < all_data_points.length; i++) {
      var play = all_data_points[i];

      // Bogus events at (0,) - skip them!
      if (play.lat == 0 && play.lon == 0) {
        continue;
      }

      // 0.5 degree buckets
      bucket_size = 0.5
      var lat = Math.round(play.lat / bucket_size) * bucket_size;
      var lon = Math.round(play.lon / bucket_size ) * bucket_size;
      
      if (buckets[[lat,lon]] !== undefined) {
        buckets[[lat,lon]] += 1;
      }
      else {
        buckets[[lat,lon]] = 1;
      }
    }

    for (val in buckets) {
      // This is super-ghetto, there must be a better way to do this sort of thing
      // in JS?
      vals = val.split(',');
      lat = parseInt(vals[0]);
      lon = parseInt(vals[1]);

      // We non-linearly map the number of hits in the range [1, inf] to approximately 
      // [0, 1.2] for color, and [0, 200] for size, using a sigmoid function.
      color = (1/(1+Math.exp(-buckets[val]/60)) - 0.5) * 2.4
      size = (1/(1+Math.exp(-buckets[val]/60)) - 0.5) * 400

      data_array.push(lat, lon, color, size);
    }

    if (points_mesh != null) {
      globe.removePoints(points_mesh);
    }

    var points_geo = globe.createPoints(data_array);
    points_mesh = globe.addPoints(points_geo);
  }

  id = setInterval(replacePoints, 250);

  globe.startAutoRotation(0);
  globe.animate();
  document.body.style.backgroundImage = 'none'; // remove loading
}
