const { loadImage, createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');

async function test() {
  const filePath = path.join(__dirname, '../uploads/cert-1790574528657-4bb69aad.png');
  const img = await loadImage(filePath);
  console.log('Image dimensions:', img.width, 'x', img.height);

  // Try 1: Normal
  const res1 = await Tesseract.recognize(filePath, 'eng');
  console.log('--- Res 1 (normal) ---');
  console.log(res1.data.text);

  // Try 2: Scaled 2x
  const canvas = createCanvas(img.width * 2, img.height * 2);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, img.width * 2, img.height * 2);
  const buf = canvas.toBuffer('image/png');
  const res2 = await Tesseract.recognize(buf, 'eng');
  console.log('--- Res 2 (2x scaled) ---');
  console.log(res2.data.text);

  // Try 3: Scaled 3x + Grayscale
  const canvas3 = createCanvas(img.width * 3, img.height * 3);
  const ctx3 = canvas3.getContext('2d');
  ctx3.drawImage(img, 0, 0, img.width * 3, img.height * 3);
  const imgData = ctx3.getImageData(0, 0, canvas3.width, canvas3.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const val = avg > 170 ? 255 : avg < 85 ? 0 : avg;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }
  ctx3.putImageData(imgData, 0, 0);
  const buf3 = canvas3.toBuffer('image/png');
  const res3 = await Tesseract.recognize(buf3, 'eng');
  console.log('--- Res 3 (3x + grayscale contrast) ---');
  console.log(res3.data.text);
}

test().catch(console.error);
