import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

/**
 * Generates a geo-tagged hero image with EXIF GPS coordinates injected via exiftool.
 */
export async function generateGeoTaggedImage(
  lat: number,
  lng: number,
  label: string
): Promise<{ buffer: Buffer; tempPath: string }> {
  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1e293b"/>
      <text x="50%" y="45%" text-anchor="middle" fill="#f8fafc" font-size="42" font-family="Arial">
        ${escapeXml(label)}
      </text>
      <text x="50%" y="58%" text-anchor="middle" fill="#94a3b8" font-size="24" font-family="Arial">
        ${lat.toFixed(4)}, ${lng.toFixed(4)}
      </text>
    </svg>
  `;

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'omglaunch-exif-'));
  const tempPath = path.join(tempDir, 'hero.png');
  await fs.writeFile(tempPath, pngBuffer);

  const { exiftool } = await import('exiftool-vendored');
  await exiftool.write(
    tempPath,
    {
      GPSLatitude: Math.abs(lat),
      GPSLatitudeRef: lat >= 0 ? 'N' : 'S',
      GPSLongitude: Math.abs(lng),
      GPSLongitudeRef: lng >= 0 ? 'E' : 'W',
      ImageDescription: label,
    },
    ['-overwrite_original']
  );

  const buffer = await fs.readFile(tempPath);
  return { buffer, tempPath };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function cleanupTempImage(tempPath: string): Promise<void> {
  try {
    await fs.unlink(tempPath);
    await fs.rmdir(path.dirname(tempPath));
  } catch {
    // best-effort cleanup
  }
}
