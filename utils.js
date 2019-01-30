const xmlns = 'http://www.w3.org/2000/svg';

function getEventPosition(event) {
  // getBoundingClientRect is slow
  const rect = event.target.getBoundingClientRect();
  return [
    event.clientX - rect.left,
    event.clientY - rect.top,
  ];
}

function createCircle(pos, radius, color) {
  const circle = document.createElementNS(xmlns, 'circle');
  circle.setAttributeNS(null, 'cx', pos[0]);
  circle.setAttributeNS(null, 'cy', pos[1]);
  circle.setAttributeNS(null, 'r', radius);
  circle.setAttributeNS(null, 'fill', color);
  return circle;
}

function createPolyline(points, strokeWidth, color) {
  const polyline = document.createElementNS(xmlns, 'polyline');
  polyline.setAttributeNS(null, 'points', points.reduce((acc, value) => acc + `${value[0]},${value[1]} `, ''));
  polyline.setAttributeNS(null, 'style', `fill:none;stroke:${color};stroke-width:${strokeWidth}`);
  return polyline;
}

function createPolygon(points, fillColor, strokeColor, strokeWidth) {
  // <polygon points="200,10 250,190 160,210" style="fill:lime;stroke:purple;stroke-width:1" />
  const polygon = document.createElementNS(xmlns, 'polygon');
  polygon.setAttributeNS(null, 'points', points.reduce((acc, value) => acc + `${value[0]},${value[1]} `, ''));
  polygon.setAttributeNS(null, 'style', `fill:${fillColor};stroke:${strokeColor};stroke-width:${strokeWidth}`);
  return polygon;
}


function createText(str, pos, color, fontSize) {
  //<text x="20" y="20" font-family="sans-serif" font-size="20px" fill="red">Hello!</text>
  const text = document.createElementNS(xmlns, 'text');
  text.setAttributeNS(null, 'font-family', 'sans-serif');
  text.setAttributeNS(null, 'x', pos[0]);
  text.setAttributeNS(null, 'y', pos[1]);
  text.setAttributeNS(null, 'font-size', 'fontSize');
  text.setAttributeNS(null, 'fill', color);
  text.innerHTML = str;
  return text;
}

function clearSvg(element) {
  var cNode = element.cloneNode(false);
  element.parentNode.replaceChild(cNode, element);
  return cNode;
}

function computeLine(points) {
  [pointA, pointB] = points;
  slope = (pointB[1] - pointA[1]) / (pointB[0] - pointA[0]);
  intercept = pointA[1] - pointA[0] * slope;
  return { slope, intercept };
}
