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
  viewport.addEventListener('contextmenu', event => event.preventDefault());
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

  const fragment = document.createDocumentFragment();
  fragment.appendChild(createCircle(camera.eye, 10, 'green', 'eye'));
  // fragment.appendChild(createCircle(camera.look, 10, 'red', 'look'));

  {
    const { left, right } = getLeftRight(camera)(camera.depth);
    fragment.appendChild(createPolyline([left, right], '5', 'green'));
    fragment.appendChild(createCircle(left, 10, 'green', 'left'));
    fragment.appendChild(createCircle(right, 10, 'green', 'right'));
  }

  const direction = camera.look.sub(camera.eye).normalize();
  const horizon = camera.eye.add(direction.mul(camera.depth));
  fragment.appendChild(createCircle(horizon, 10, 'green', 'horizon'));
  fragment.appendChild(createPolyline([camera.eye, horizon], '5', 'green'));

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
    const right = [
      horizonX + halfOrthogonalVectorX | 0,
      horizonY + halfOrthogonalVectorY | 0,
    ];
    // right: horizon.sub(orthogonalVector.mul(fovWidthAtDistance / 2)),
    const left = [
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

function drawVerticalLine(buffer, { width, height }, x, y, color, yBuffer) {
  const iwidth = width | 0;
  const iheight = yBuffer[x] | 0;
  const offset = x * iwidth | 0;
  for (let j = y | 0; j < iheight; j = j + 1 | 0) {
    buffer[x + j * iwidth] = color;
  }
  yBuffer[x] = y;
}

(function () {
  let imageData;
  let imageDataBuffer;
  let yBuffer;
  window.render = (colorMap, heightMap, camera) => {
    if (imageData === undefined) {
      // TODO: dynamically decide the
      imageData = new ImageData(512, 512)
      imageDataBuffer = new Uint32Array(imageData.data.buffer);
      yBuffer = new Uint16Array(imageData.height);
    }
    // Initialize the yBuffer to the bottom of the canvas. We will use this yBuffer
    // to avoid having to draw all the way down.
    yBuffer.fill(imageData.height, 0, imageData.height);
    // Set a blue sky
    imageDataBuffer.fill(0xFFEBCE87, 0, imageDataBuffer.length);
    const { width, height } = imageData;
    const { mapWidth, mapHeight } = (() => {
      const { width, height } = colorMap; // We assume colorMapBuffer and heightMap have the same size
      return { mapWidth: width | 0, mapHeight: height | 0 };
    })();
    const colorMap32Buffer = colorMap.colorMap32Buffer;
    const directionNorm = camera.look.sub(camera.eye).norm();
    const getLeftRightWithCamera = getLeftRight(camera);
    const yStretch = 255 / (255 * directionNorm / camera.depth);
    for (let distance = directionNorm | 0; distance <= camera.depth; distance = distance + 1 | 0) {
      let { left, right } = getLeftRightWithCamera(distance);
      // [left, right] = left[0] < right[0] ? [left, right] : [right, left];
      const dx = ((right[0] - left[0]) / width);
      const dy = ((right[1] - left[1]) / width);
      const distanceRatio = directionNorm / distance;
      const compiledRatio = distanceRatio * yStretch;
      const eyeHeight = camera.eye[2];
      for (let x = 0 | 0; x < width; x = x + 1 | 0) {
        const index = ((left[0] + dx * x) + (((left[1] + dy * x) | 0) * mapWidth)) | 0;
        const color = colorMap32Buffer[index];
        const topoHeight = heightMap[index];
        const y = (eyeHeight + (eyeHeight - topoHeight) * compiledRatio);
        if (y < yBuffer[x])
          drawVerticalLine(imageDataBuffer, { width, height }, x | 0, y | 0, color, yBuffer);
      }
    }
    return imageData;
  }
})();

function drawScene(viewport, model) {
  const then = performance.now();
  const canvas = viewport.getElementsByTagName('canvas')[0];
  const ctx = canvas.getContext('2d');
  const camera = model.camera.get();
  const imageData = render(model.colorMap, model.heightMap, camera);
  ctx.putImageData(imageData, 0, 0);
  // console.log(`done in ${(performance.now() - then).toFixed(2)}`);
}

function decorateMap(viewport, model) {
  const canvas = viewport.getElementsByTagName('canvas')[0];
  const widthScale = canvas.width / viewport.clientWidth;
  const heightScale = canvas.height / viewport.clientHeight;

  const mouseup = (event, mousemoveHandler) => {
    viewport.removeEventListener('mousemove', mousemoveHandler);
    viewport.removeEventListener('mouseup', mouseup);
  };
  const mousedown = (event, mousemoveHandler) => {
    viewport.addEventListener('mousemove', mousemoveHandler);
    viewport.addEventListener('mouseup', (event) => mouseup(event, mousemoveHandler));
  };

  const horizonMousemove = (event) => {
    const camera = model.camera.get();
    const clickPos = getEventPosition(event);
    const posInCanvas = [clickPos[0] * widthScale, clickPos[1] * heightScale, camera.eye[2]];
    const newDirection = posInCanvas.sub(camera.eye);
    camera.depth = newDirection.norm();
    camera.look = camera.eye.add(newDirection.normalize());
    model.camera.next(camera);
  };

  const eyeMousemove = (event) => {
    const camera = model.camera.get();
    const clickPos = getEventPosition(event);
    const direction = camera.look.sub(camera.eye);
    const directionNorm = direction.norm();
    const horizon = camera.eye.add(direction.normalize().mul(camera.depth));
    const posInCanvas = [clickPos[0] * widthScale, clickPos[1] * heightScale];
    const eyeHeight = model.heightMap[camera.eye[0] + camera.eye[1] * model.colorMap.width] + 30;
    const horizonHeight = model.heightMap[(horizon[0] + horizon[1] * model.colorMap.width) | 0] + 30;
    const height = Math.max(eyeHeight, horizonHeight);
    camera.eye = [...posInCanvas, camera.eye[2]];
    camera.depth = horizon.sub(camera.eye).norm();
    camera.eye[2] = height;
    camera.look = camera.eye.add(horizon.sub(camera.eye).normalize().mul(directionNorm));
    model.camera.next(camera);
  };

  const sideMousemove = (event, side) => {
    const camera = model.camera.get();
    const clickPos = getEventPosition(event);
    const posInCanvas = [clickPos[0] * widthScale, clickPos[1] * heightScale, camera.eye[2]];
    const direction = camera.look.sub(camera.eye);
    const horizon = camera.eye.add(direction.normalize().mul(camera.depth));
    const { left, right } = getLeftRight(camera)(camera.depth);
    const point = side === 'left' ? [...left, camera.eye[2]] : [...right, camera.eye[2]];
    const newFovWidth = point.sub(horizon).normalize().dot(posInCanvas.sub(horizon)) * 2;
    camera.fov.width = newFovWidth;
    model.camera.next(camera);
  }

  const horizon = viewport.getElementsByClassName('horizon')[0];
  horizon.addEventListener('mousedown', (event) => mousedown(event, horizonMousemove));
  const eye = viewport.getElementsByClassName('eye')[0];
  eye.addEventListener('mousedown', (event) => mousedown(event, eyeMousemove));
  const left = viewport.getElementsByClassName('left')[0];
  left.addEventListener('mousedown', (event) => mousedown(event, (event) => sideMousemove(event, 'left')));
  const right = viewport.getElementsByClassName('right')[0];
  right.addEventListener('mousedown', (event) => mousedown(event, (event) => sideMousemove(event, 'right')));
}

async function main() {
  const model = {
    camera: new Observable.BehaviorSubject({
      look: [101, 101, 128],
      eye: [100, 100, 128],
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
  model.colorMap.colorMap32Buffer = new Uint32Array(model.colorMap.data.buffer);
  // Retrieve and intialize viewports
  const viewport = document.getElementById('main');
  const mapViewport = document.getElementById('map');
  initViewport(viewport);
  initViewport(mapViewport);
  // Start drawing
  drawMapBackground(mapViewport, model.colorMap);
  model.camera.subscribe(camera => {
    drawCamera(mapViewport, camera);
    decorateMap(mapViewport, model);
    drawScene(viewport, model);
  });

  // For debug purposes
  window.model = model
  const positionElement = document.getElementById('position');
  mapViewport.addEventListener('mousemove', (event) => positionElement.innerHTML = getEventPosition(event));
}

window.onload = main()
