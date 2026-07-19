const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const apps = [
  { name: 'mobile', port: 19001 },
  { name: 'mechanic', port: 19002 },
  { name: 'rider', port: 19003 },
  { name: 'seller-mobile', port: 19004 },
  { name: 'admin-mobile', port: 19005 }
];

const outputDir = 'C:\\Users\\MechBazar\\qr-codes';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateQRCodes() {
  for (const app of apps) {
    const url = `exp://192.168.1.7:${app.port}`;
    const filePath = path.join(outputDir, `${app.name}-qr.png`);
    
    try {
      await QRCode.toFile(filePath, url, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.95,
        margin: 1,
        width: 300
      });
      console.log(`✓ Generated QR code for ${app.name} at ${filePath}`);
    } catch (err) {
      console.error(`✗ Failed to generate QR for ${app.name}:`, err.message);
    }
  }
}

generateQRCodes().catch(console.error);
