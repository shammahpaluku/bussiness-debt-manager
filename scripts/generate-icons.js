const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

(async () => {
  try {
    const svgPath = path.join(__dirname, '..', 'public', 'icon.svg');
    const outPng = path.join(__dirname, '..', 'public', 'icon.png');
    const outIco = path.join(__dirname, '..', 'public', 'icon.ico');

    if (!fs.existsSync(svgPath)) {
      throw new Error(`Missing icon.svg at ${svgPath}`);
    }

    // Generate 512x512 PNG from SVG
    const pngBuffer = await sharp(svgPath).resize(512, 512).png().toBuffer();
    fs.writeFileSync(outPng, pngBuffer);

    // Generate ICO from multiple sizes for better scaling
    const icoSizes = [16, 24, 32, 48, 64, 128, 256];
    const pngBuffers = await Promise.all(
      icoSizes.map(size => sharp(pngBuffer).resize(size, size).png().toBuffer())
    );
    const icoBuffer = await pngToIco(pngBuffers);
    fs.writeFileSync(outIco, icoBuffer);

    console.log('Icons generated: icon.png, icon.ico');
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
})();
