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
  // ctx.putImageData(background, 0, 0);
  // Set SVG size
  svg.setAttribute('viewBox', `0 0 ${background.width} ${background.height}`);
}

function drawCamera(viewport, camera) {
  const svg = clearSvg(viewport.getElementsByTagName('svg')[0]);

  const fragment = document.createDocumentFragment();
  fragment.appendChild(createCircle(camera.eye, 10, 'green'));
  const direction = camera.look.sub(camera.eye).normalize();
  const horizon = camera.eye.add(direction.mul(camera.depth));
  fragment.appendChild(createCircle(horizon, 10, 'green'));
  fragment.appendChild(createPolyline([camera.eye, horizon], '5', 'green'));

  {
    const { left, right } = getLeftRight(camera, camera.depth);
    fragment.appendChild(createCircle(left, 10, 'green'));
    fragment.appendChild(createCircle(right, 10, 'green'));
    fragment.appendChild(createPolyline([left, right], '5', 'green'));
  }

  svg.appendChild(fragment);
}

function getLeftRight(camera, distance) {
  const direction = camera.look.sub(camera.eye).normalize();
  const orthogonalVector = getOrthogonalVector(direction).normalize();
  const fovWidthAtDistance = camera.fov.width * (distance / camera.depth);
  const horizon = camera.eye.add(direction.mul(distance));
  return {
    left: horizon.add(orthogonalVector.mul(fovWidthAtDistance / 2)),
    right: horizon.sub(orthogonalVector.mul(fovWidthAtDistance / 2)),
  };
}

// From two points x and y return a and b so that y = a.x + b
function getLine(x, y) {
  const a = (y[1] - x[1]) / (y[0] - x[0]);
  return {
    a,
    b: x[1] - x[0] * a,
  }
}

async function main() {
  const model = {
    camera: new Observable.BehaviorSubject({
      look: [1, 1, 128],
      eye: [0, 0, 128],
      fov: {
        width: 300,
        height: 300,
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

  // For debug purposes
  window.model = model
}

window.onload = main()
