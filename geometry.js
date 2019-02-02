function getOrthogonalVector(v) {
  return [[0, -1, 0], [1, 0, 0], [0, 0, 1]].mul(v);
}
