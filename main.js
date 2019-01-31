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
    const { left, right } = getLeftRight(camera)(camera.depth);
    fragment.appendChild(createCircle(left, 10, 'green'));
    fragment.appendChild(createCircle(right, 10, 'green'));
    fragment.appendChild(createPolyline([left, right], '5', 'green'));
  }

  svg.appendChild(fragment);
}

function getLeftRight(camera) {
  const direction = camera.look.sub(camera.eye).normalize();
  const orthogonalVector = getOrthogonalVector(direction).normalize();
  return (distance) => {
    const fovWidthAtDistance = camera.fov.width * (distance / camera.depth);
    // camera.eye.add(direction.mul(distance)) is too slow
    const horizonX = camera.eye[0] + direction[0] * distance;
    const horizonY = camera.eye[1] + direction[1] * distance;
    const halfFovWidthAtDistance = fovWidthAtDistance / 2
    const halfOrthogonalVectorX = orthogonalVector[0] * halfFovWidthAtDistance;
    const halfOrthogonalVectorY = orthogonalVector[1] * halfFovWidthAtDistance;
    // left: horizon.add(orthogonalVector.mul(fovWidthAtDistance / 2)),
    const left = [
      horizonX + halfOrthogonalVectorX | 0,
      horizonY + halfOrthogonalVectorY | 0,
    ];
    // right: horizon.sub(orthogonalVector.mul(fovWidthAtDistance / 2)),
    const right = [
      horizonX - halfOrthogonalVectorX | 0,
      horizonY - halfOrthogonalVectorY | 0,
    ];
    return { left, right };
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

function drawVerticalLine(buffer, { width, height }, x, y, color) {
  const iwidth = width | 0;
  const iheight = height | 0;
  for (let j = y | 0; j < iheight; j = j + 1 | 0) {
    buffer[x + j * iwidth] = color;
  }
}


function drawImage(viewport, model) {
  const then = performance.now();
  const canvas = viewport.getElementsByTagName('canvas')[0];
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height } = imageData;
  const { mapWidth, mapHeight } = (() => {
    const { width, height } = model.colorMap;
    return { mapWidth: width, mapHeight: height };
  })();
  const buffer = new Uint32Array(imageData.data.buffer);
  const camera = model.camera.get();
  const direction = camera.look.sub(camera.eye);
  const directionNorm = direction.norm();
  const getLeftRightWithCamera = getLeftRight(camera);
  for (let distance = camera.depth; distance > directionNorm; --distance) {
    let { left, right } = getLeftRightWithCamera(distance);
    if (left[0] > right[0]) {
      const tmp = left;
      left = right;
      right = tmp;
    }
    const { a, b } = getLine(left, right);
    const dx = ((right[0] - left[0]) / width);
    const dy = ((right[1] - left[1]) / width);
    const distanceRatio = distance / camera.depth;
    for (let x = 0; x < width; ++x) {
      const index = ((left[0] + dx * x) + ((left[1] + dy * x) * mapWidth)) | 0;
      const color = model.colorMapBuffer[index];
      const topoHeight = model.heightMap[index];
      const y = camera.eye[2] + (camera.eye[2] - topoHeight) * distanceRatio;
      drawVerticalLine(buffer, { width, height }, x | 0, y | 0, color);
      // buffer[x + y * width] = 0xFF000000;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  console.log(`done in ${(performance.now() - then).toFixed(2)}`);
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
    colorMap: await loadImage('maps/C1W.png'),
    // RGBA to (width x height) 8 bits array
    heightMap: new Uint8Array((await loadImage('maps/D1.png')).data.filter((x, i) => i % 4 === 0)),
  };
  // For faster access to the color map
  model.colorMapBuffer = new Uint32Array(model.colorMap.data.buffer);
  // Retrieve and intialize viewports
  const viewport = document.getElementById('main');
  const mapViewport = document.getElementById('map');
  initViewport(viewport);
  initViewport(mapViewport);
  // Start drawing
  drawMapBackground(mapViewport, model.colorMap);
  model.camera.subscribe(camera => {
    drawCamera(mapViewport, camera);
    for (var i = 0; i < 1; i++) {
      drawImage(viewport, model);
    }
  });

  // For debug purposes
  window.model = model
}

window.onload = main()
