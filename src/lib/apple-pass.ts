/**
 * Apple Wallet Pass data structure and generation for PSFC member cards.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  APPLE_PASS_CERT_BASE64,
  APPLE_PASS_KEY_BASE64,
  APPLE_PASS_KEY_PASSPHRASE,
  APPLE_PASS_TYPE_ID,
  APPLE_TEAM_ID,
  APPLE_WWDR_CERT_BASE64,
} from '$env/static/private';
import { PKPass } from 'passkit-generator';
import sharp from 'sharp';

async function loadIconAsset(): Promise<Buffer> {
  const sourcePath = path.join(process.cwd(), 'static', 'assets', 'coop.png');

  return readFile(sourcePath);
}

async function loadLogoAsset(): Promise<Buffer> {
  const sourcePath = path.join(process.cwd(), 'static', 'assets', 'coop-padded.png');

  return readFile(sourcePath);
}

async function loadStripAsset(): Promise<Buffer> {
  const sourcePath = path.join(process.cwd(), 'static', 'assets', 'coop-strip.png');

  return readFile(sourcePath);
}

function generateIconFromAsset(sourceBuffer: Buffer, size: number): Promise<Buffer> {
  return sharp(sourceBuffer)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

function generateLogoFromAsset(
  sourceBuffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(sourceBuffer)
    .resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

function generateStripFromAsset(
  sourceBuffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(sourceBuffer)
    .resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

/**
 * Generate a signed .pkpass file for Apple Wallet.
 */
export async function generatePKPass(config: {
  memberId: string;
  memberName: string;
  serialNumber: string;
}): Promise<Buffer> {
  const pass = new PKPass(
    {},
    {
      wwdr: Buffer.from(APPLE_WWDR_CERT_BASE64, 'base64'),
      signerCert: Buffer.from(APPLE_PASS_CERT_BASE64, 'base64'),
      signerKey: Buffer.from(APPLE_PASS_KEY_BASE64, 'base64'),
      signerKeyPassphrase: APPLE_PASS_KEY_PASSPHRASE,
    },
    {
      serialNumber: config.serialNumber,
      passTypeIdentifier: APPLE_PASS_TYPE_ID,
      teamIdentifier: APPLE_TEAM_ID,
      organizationName: 'Park Slope Food Coop',
      description: 'Park Slope Food Coop Member Card',
      foregroundColor: 'rgb(51, 51, 51)',
      backgroundColor: 'rgb(255, 246, 220)',
      labelColor: 'rgb(51, 51, 51)',
    },
  );

  pass.type = 'storeCard';

  pass.secondaryFields.push({
    key: 'name',
    label: 'MEMBER',
    value: config.memberName,
    textAlignment: 'PKTextAlignmentLeft',
  });

  pass.secondaryFields.push({
    key: 'id',
    label: 'Member ID',
    value: config.memberId,
    textAlignment: 'PKTextAlignmentLeft',
  });

  pass.backFields.push({
    key: 'website',
    label: 'Website',
    value: 'https://foodcoop.news',
  });

  pass.backFields.push({
    key: 'member information',
    label: 'Member Information',
    value: 'https://foodcoop.com',
  });

  pass.backFields.push({
    key: 'description',
    label: 'Description',
    value: 'Good Food at Low Prices for Working Members through Cooperation since 1973.',
  });

  pass.setBarcodes({
    format: 'PKBarcodeFormatPDF417',
    message: config.memberId,
  });

  pass.setLocations({
    latitude: 40.67490404780709,
    longitude: -73.9767898621368,
  });

  const [iconAsset, logoAsset, stripAsset] = await Promise.all([
    loadIconAsset(),
    loadLogoAsset(),
    loadStripAsset(),
  ]);
  const [icon1x, icon2x, icon3x, logo1x, logo2x, strip1x, strip2x] = await Promise.all([
    generateIconFromAsset(iconAsset, 29),
    generateIconFromAsset(iconAsset, 58),
    generateIconFromAsset(iconAsset, 87),
    generateLogoFromAsset(logoAsset, 160, 50),
    generateLogoFromAsset(logoAsset, 320, 100),
    generateStripFromAsset(stripAsset, 320, 123),
    generateStripFromAsset(stripAsset, 640, 246),
  ]);

  pass.addBuffer('icon.png', icon1x);
  pass.addBuffer('icon@2x.png', icon2x);
  pass.addBuffer('icon@3x.png', icon3x);
  pass.addBuffer('logo.png', logo1x);
  pass.addBuffer('logo@2x.png', logo2x);
  pass.addBuffer('strip.png', strip1x);
  pass.addBuffer('strip@2x.png', strip2x);

  return pass.getAsBuffer();
}
