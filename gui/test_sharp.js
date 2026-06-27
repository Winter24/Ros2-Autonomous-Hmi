const sharp = require('sharp');
const data = Buffer.alloc(3686400); // 1280 * 720 * 4
try {
  const image = sharp(data, {
      raw: {
          width: 1280,
          height: 720,
          channels: 3
      }
  });
  console.log("Success");
} catch (e) {
  console.log("Sync Error:", e.message);
}
