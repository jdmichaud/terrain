async function loadImage(url) {
  const image = new Image();
  const promise = new Promise(resolve => {
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve(imageData);
    };
  });
  image.src = url;
  return promise;
}

function initViewport(viewport) {
  const canvas = viewport.getElementsByTagName('canvas')[0];
  const svg = viewport.getElementsByTagName('svg')[0];
  canvas.width = viewport.clientWidth;
  canvas.height = viewport.clientHeight;
  svg.setAttribute('viewBox', `0 0 ${viewport.clientWidth} ${viewport.clientHeight}`);
}

function drawMapBackground(viewport, background) {
  const canvas = viewport.getElementsByTagName('canvas')[0];
  const svg = viewport.getElementsByTagName('svg')[0];
  // Put background
  const ctx = canvas.getContext('2d');
  canvas.width = background.width;
  canvas.height = background.height;
  ctx.putImageData(background, 0, 0);
  // Set SVG size
  svg.setAttribute('viewBox', `0 0 ${background.width} ${background.height}`);
}

function drawCamera(viewport, camera) {
  const svg = clearSvg(viewport.getElementsByTagName('svg')[0]);
  console.log(svg);
  console.log(camera.eye);

  const fragment = document.createDocumentFragment();
  fragment.appendChild(createCircle(camera.eye, 10, 'white'));
  const horizon = camera.look.sub(camera.eye).mul(camera.depth);
  fragment.appendChild(createCircle(horizon, 10, 'white'));
  fragment.appendChild(createPolyline([camera.eye, horizon], '5', 'white'));

  svg.appendChild(fragment);
}


async function main() {
  const model = {
    camera: new Observable.BehaviorSubject({
      look: [1, 1, 128],
      eye: [0, 0, 128],
      fov: {
        width: 100,
        height: 100,
      },
      depth: 300,
    }),
    colorMap: await loadImage('C10W.png'),
    heightMap: await loadImage('D10.png'),
  };
  const viewport = document.getElementById('main');
  const mapViewport = document.getElementById('map');
  initViewport(viewport);
  initViewport(mapViewport);

  drawMapBackground(mapViewport, model.colorMap);
  model.camera.subscribe(camera => {
    drawCamera(mapViewport, camera);
  });
}

window.onload = main()
