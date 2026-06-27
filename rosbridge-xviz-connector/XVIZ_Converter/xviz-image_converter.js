const xvizServer = require('../xviz-server');
const sharp = require('sharp');
var maxHeight = null;
var maxWidth = null;
function getResizeDimension(width__, height__) {
  const ratio = width__ / height__;
  let resizeWidth = null;
  let resizeHeight = null;
  if (maxHeight > 0 && maxWidth > 0) {
    resizeWidth = Math.min(maxWidth, maxHeight * ratio);
    resizeHeight = Math.min(maxHeight, maxWidth / ratio);
  }
  else if (maxHeight > 0) {
    resizeWidth = maxHeight * ratio;
    resizeHeight = maxHeight;
  }
  else if (maxWidth > 0) {
    resizeWidth = maxWidth;
    resizeHeight = maxWidth / ratio;
  }
  else {
    resizeWidth = width__;
    resizeHeight = height__;
  }
  return {
    resizeWidth: Math.floor(resizeWidth),
    resizeHeight: Math.floor(resizeHeight)
  }
}
module.exports = {
  //using camrea xviz builder (base64 -> uint8Array(camera input type))
  nodeBufferToTypedArray: function (buffer) {
    const typedArray = new Uint8Array(buffer);
    return typedArray;
  },
  //base64 type image(94312) => compressed image (base64, png, resize)
  createSharpImg: async function (data, width = 1242, height = 375, encoding = 'rgb8') {
    const { resizeWidth, resizeHeight } = getResizeDimension(width, height, maxWidth, maxHeight);

    let channels = 3;
    if (encoding.includes('rgba') || encoding.includes('bgra')) {
      channels = 4;
    } else if (encoding.includes('mono8')) {
      channels = 1;
    }

    const image = await sharp(data, {
      raw: {
        width,
        height,
        channels: channels
      }
    })
      //.raw()
      .removeAlpha()
      .png()
      .rotate()
      .resize({
        width: 640,
        height: 360,
        position: "left top"
      })
      .toFormat('png')
      .toBuffer();
    console.log(`[CAMERA] sharp created png buffer of size ${image.length}`);
    xvizServer.updateCameraImage(image, resizeWidth, resizeHeight);
  },
  compressedimage: function (message) {
    format
  }
}