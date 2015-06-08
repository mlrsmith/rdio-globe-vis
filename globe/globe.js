/**
 * dat.globe Javascript WebGL Globe Toolkit
 * http://dataarts.github.com/dat.globe
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var DAT = DAT || {};

DAT.Globe = function(container, opts) {
  opts = opts || {};
  
  var colorFn = opts.colorFn || function(x) {
    var c = new THREE.Color();
    c.setHSL( ( 0.6 - ( x * 0.5 ) ), 1.0, 0.5 );
    return c;
  };
  var imgDir = opts.imgDir || '/globe/';

  var Shaders = {
    'earth' : {
      uniforms: {
        'texture': { type: 't', value: null },
        'uLightLocation': { type: 'v3', value: new THREE.Vector3(0, 0, 0) },
        'uLightColor': { type: 'c', value: new THREE.Color(0xffffff) }
      },

      // Modifications to support 'sun' lighting based on http://learningwebgl.com/blog/?p=1523
      vertexShader: [
        'uniform vec3 uLightLocation;',
        'varying vec3 vNormal;',
        'varying vec2 vUv;',
        'varying vec4 vPosition;',
        'varying vec4 vLightPosition;',
        'void main() {',
          'vPosition = modelViewMatrix * vec4( position, 1.0);',
          'vLightPosition = modelViewMatrix * vec4 (uLightLocation, 1.0);',
          'gl_Position = projectionMatrix * vPosition;',
          'vNormal = normalize( normalMatrix * normal );',
          'vUv = uv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D texture;',
        'uniform vec3 uLightColor;',
        'varying vec3 vNormal;',
        'varying vec2 vUv;',
        'varying vec4 vPosition;',
        'varying vec4 vLightPosition;',
        'void main() {',
          'vec3 lightDirection = normalize(vLightPosition.xyz - vPosition.xyz);',
          'float directionalLightWeight = max(dot(normalize(vNormal), lightDirection), 0.1);',
          //'float directionalLightWeight = max(dot(normalize(vNormal), lightDirection), 0.0);',
          //'float directionalLightWeightA = max(dot(normalize(vNormal), lightDirection), 0.0);',
          //'float directionalLightWeight = directionalLightWeightA * step(0.2, directionalLightWeightA);',
          'vec3 diffuse = texture2D( texture, vUv ).xyz;',
          'vec3 light = uLightColor * directionalLightWeight;',
          'float intensity = 1.05 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) );',
          //'vec3 atmosphere = vec3( 1.0, 1.0, 1.0 ) * pow( intensity, 3.0 );',
          'vec3 atmosphere = vec3( 0.0, 0.2, 0.5 ) * pow( intensity, 3.0 );',
          //'gl_FragColor = vec4( diffuse * light + atmosphere, 1.0 );',
          'gl_FragColor = vec4( diffuse * light * 15.0 + atmosphere, 1.0 );', // * 15 is a totally arbitrary thing that seems to look nice.
          //'gl_FragColor = vec4( light, 1.0 );',
        '}'
      ].join('\n')
    },
    'atmosphere' : {
      uniforms: {
        'uLightLocation': { type: 'v3', value: new THREE.Vector3(0, 0, 0) },
        'uLightColor': { type: 'c', value: new THREE.Color(0xffffff) }
      },
      vertexShader: [
        'uniform vec3 uLightLocation;',
        'varying vec3 vNormal;',
        'varying vec4 vLightPosition;',
        'varying vec4 vPosition;',
        'void main() {',
          'vPosition = modelViewMatrix * vec4( position, 1.0);',
          'vNormal = normalize( normalMatrix * normal );',
          'vLightPosition = modelViewMatrix * vec4 (uLightLocation, 1.0);',
          'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vNormal;',
        'varying vec4 vPosition;',
        'varying vec4 vLightPosition;',
        'uniform vec3 uLightColor;',
        'void main() {',
          'vec3 lightDirection = normalize(vPosition.xyz - vLightPosition.xyz);',
          'float directionalLightWeight = max(dot(normalize(vNormal), lightDirection), 0.2);',
          'vec3 light = uLightColor * directionalLightWeight;',

          'float intensity = pow( 0.8 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 12.0 );',
          //'gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 ) * intensity;',
          'gl_FragColor = vec4( light, 1.0) * intensity * 0.5;',
        '}'
      ].join('\n')
    }
  };

  var camera, scene, renderer, w, h;
  var mesh, atmosphere, point;

  var overRenderer;

  var curZoomSpeed = 0;
  var zoomSpeed = 50;

  var mouse = { x: 0, y: 0 }, mouseOnDown = { x: 0, y: 0 };
  var rotation = { x: 0, y: 0 },
      target = { x: Math.PI*3/2, y: Math.PI / 6.0 },
      targetOnDown = { x: 0, y: 0 };

  var distance = 100000, distanceTarget = 100000;
  var padding = 40;
  var PI_HALF = Math.PI / 2;

  var autoRotationId = null;
  var autoRotationStartId = null;

  var earthMaterial = null;
  var atmosMaterial = null;

  function init() {

    container.style.color = '#fff';
    container.style.font = '13px/20px Arial, sans-serif';

    var shader, uniforms, material;
    w = container.offsetWidth || window.innerWidth;
    h = container.offsetHeight || window.innerHeight;

    camera = new THREE.PerspectiveCamera(30, w / h, 1, 10000);
    camera.position.z = distance;

    scene = new THREE.Scene();

    var geometry = new THREE.SphereGeometry(200, 40, 30);

    shader = Shaders['earth'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    imageFile = "world.jpg"
    //imageFile = "worldrdio.png"
    uniforms['texture'].value = THREE.ImageUtils.loadTexture(imgDir+imageFile);
    // A pretty sea-blueish color. Because lazy and it looks nice!?
    uniforms['uLightColor'].value = new THREE.Color(0x006994);

    material = new THREE.ShaderMaterial({

          uniforms: uniforms,
          vertexShader: shader.vertexShader,
          fragmentShader: shader.fragmentShader

        });
    earthMaterial = material;


    mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.y = Math.PI;
    scene.add(mesh);

    shader = Shaders['atmosphere'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);
    uniforms['uLightColor'].value = new THREE.Color(0x003280);

    material = new THREE.ShaderMaterial({

          uniforms: uniforms,
          vertexShader: shader.vertexShader,
          fragmentShader: shader.fragmentShader,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          transparent: true

        });
    atmosMaterial = material;

    mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set( 1.2, 1.2, 1.2 );
    scene.add(mesh);

    geometry = new THREE.BoxGeometry(0.75, 0.75, 1);
    geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0,0,-0.5));

    point = new THREE.Mesh(geometry);

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(w, h);

    renderer.domElement.style.position = 'absolute';

    container.appendChild(renderer.domElement);

    container.addEventListener('mousedown', onMouseDown, false);

    container.addEventListener('mousewheel', onMouseWheel, false);

    document.addEventListener('keydown', onDocumentKeyDown, false);

    window.addEventListener('resize', onWindowResize, false);

    container.addEventListener('mouseover', function() {
      overRenderer = true;
    }, false);

    container.addEventListener('mouseout', function() {
      overRenderer = false;
    }, false);
  }

  function createPoints(data, opts) {
    var lat, lng, size, color, i, step, colorFnWrapper;

    step = 4;

    var subgeo = new THREE.Geometry();
    for (i = 0; i < data.length; i += step) {
      lat = data[i];
      lng = data[i + 1];
      color = colorFn(data[i+2]);
      size = data[i + 3];
      createPoint(lat, lng, size, color, subgeo);
    }

    return subgeo;

  }

  function createPoint(lat, lng, size, color, subgeo) {

    var phi = (90 - lat) * Math.PI / 180;
    var theta = (180 - lng) * Math.PI / 180;

    point.position.x = 200 * Math.sin(phi) * Math.cos(theta);
    point.position.y = 200 * Math.cos(phi);
    point.position.z = 200 * Math.sin(phi) * Math.sin(theta);

    point.lookAt(mesh.position);

    point.scale.z = Math.max( size, 0.1 ); // avoid non-invertible matrix
    point.updateMatrix();

    for (var i = 0; i < point.geometry.faces.length; i++) {

      point.geometry.faces[i].color = color;

    }
    if(point.matrixAutoUpdate){
      point.updateMatrix();
    }
    subgeo.merge(point.geometry, point.matrix);
  }

  function addPoints(geo) {
    var points = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: 0xffffff,
          vertexColors: THREE.FaceColors,
          morphTargets: false
        }));
    scene.add(points);

    return points;
  }

  function removePoints(mesh) {
    scene.remove(mesh);
  }

  function onMouseDown(event) {
    event.preventDefault();

    container.addEventListener('mousemove', onMouseMove, false);
    container.addEventListener('mouseup', onMouseUp, false);
    container.addEventListener('mouseout', onMouseOut, false);

    mouseOnDown.x = - event.clientX;
    mouseOnDown.y = event.clientY;

    targetOnDown.x = target.x;
    targetOnDown.y = target.y;

    container.style.cursor = 'move';

    cancelAutoRotation();
  }

  function onMouseMove(event) {
    mouse.x = - event.clientX;
    mouse.y = event.clientY;

    var zoomDamp = distance/1000;

    target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * 0.005 * zoomDamp;
    target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * 0.005 * zoomDamp;

    target.y = target.y > PI_HALF ? PI_HALF : target.y;
    target.y = target.y < - PI_HALF ? - PI_HALF : target.y;
  }

  function onMouseUp(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
    container.style.cursor = 'auto';

    startAutoRotation(2500);
  }

  function onMouseOut(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);

    startAutoRotation(2500);
  }

  function onMouseWheel(event) {
    event.preventDefault();
    if (overRenderer) {
      zoom(event.wheelDeltaY * 0.3);
    }

    cancelAutoRotation();
    startAutoRotation(2500);

    return false;
  }

  function onDocumentKeyDown(event) {
    switch (event.keyCode) {
      case 38:
        zoom(100);
        event.preventDefault();
        break;
      case 40:
        zoom(-100);
        event.preventDefault();
        break;
    }

    cancelAutoRotation();
    startAutoRotation(2500);
  }

  function cancelAutoRotation() {

    if (autoRotationId != null) {
      clearInterval(autoRotationId);
      autoRotationId = null;
    }

    if (autoRotationStartId != null) {
      clearTimeout(autoRotationStartId);
      autoRotationStartId = null;
    }

  }

  function startAutoRotation(time) {
    autoRotationStartId = setTimeout(function () {
      autoRotate();
      autoRotationId = setInterval(autoRotate, 50);
    }, time);
  }

  function autoRotate() {
    target.x += 0.005;

  }

  function onWindowResize( event ) {
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( container.offsetWidth, container.offsetHeight );
  }

  function zoom(delta) {
    distanceTarget -= delta;
    distanceTarget = distanceTarget > 1000 ? 1000 : distanceTarget;
    distanceTarget = distanceTarget < 350 ? 350 : distanceTarget;
  }

  function animate() {
    requestAnimationFrame(animate);
    render();
  }

  function render() {
    zoom(curZoomSpeed);

    rotation.x += (target.x - rotation.x) * 0.1;
    rotation.y += (target.y - rotation.y) * 0.1;
    distance += (distanceTarget - distance) * 0.3;

    camera.position.x = distance * Math.sin(rotation.x) * Math.cos(rotation.y);
    camera.position.y = distance * Math.sin(rotation.y);
    camera.position.z = distance * Math.cos(rotation.x) * Math.cos(rotation.y);

    camera.lookAt(mesh.position);

    var sunDist = 10000000;
    // normalized time_of_day ranges from [-1, 1]
    date = new Date();
    time_of_day = (date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds()) / (3600*24) * 2 - 1;
    time_of_day = -time_of_day;

    // For testing a 'day' lasts 60 seconds
    //time_of_day = (date.getUTCSeconds() + (date.getUTCMilliseconds()/1000)) / 60 * 2 - 1;

    // cos vs sin and arbitrary looking + 0.5 --> bogus?
    var x = sunDist * Math.sin((time_of_day + 0.5)* Math.PI);
    var z = sunDist * Math.cos((time_of_day + 0.5)* Math.PI);

    var time = date.getTime();
    var startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
    // time_of_year ranges from [-1, 1] also!
    time_of_year = ((time - startOfYear)/(365*24*60*60*1000) - 0.5) * 2;

    // Why sin? Why + 0.5?
    var y = Math.sin((time_of_year + 0.5) * 23.5 / 180 * Math.PI) * sunDist;

    var pos = new THREE.Vector3(x, y, z);
    //console.log("Computed sun position as ("+pos.x+", "+pos.y+", "+pos.z+")");

    earthMaterial.uniforms['uLightLocation'].value = pos
    // This is apparently not actually needed.
    //earthMaterial.needsUpdate = true;
    atmosMaterial.uniforms['uLightLocation'].value = pos

    renderer.render(scene, camera);
  }

  init();
  this.animate = animate;
  this.startAutoRotation = startAutoRotation;


  this.createPoints = createPoints;
  this.addPoints = addPoints;
  this.removePoints = removePoints;

  this.renderer = renderer;
  this.scene = scene;

  return this;

};

