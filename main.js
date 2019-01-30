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
      resolve(imageData.data);
    };
  });
  image.src = url;
  return promise;
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
    colorMap: loadImage('C10W.png'),
    heightMap: loadImage('D10.png'),
  };
}

window.onload = main()
