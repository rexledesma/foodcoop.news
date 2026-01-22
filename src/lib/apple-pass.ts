/**
 * Apple Wallet Pass data structure for PSFC member cards.
 *
 * This module defines the pass.json structure for future Apple Wallet integration.
 * Actual pass generation requires Apple Developer credentials which are not yet available.
 *
 * Future implementation will need:
 * - Apple Developer Account with Pass Type ID
 * - Pass signing certificate (.p12)
 * - WWDR intermediate certificate
 * - node-forge for PKCS#7 signing
 * - jszip for .pkpass ZIP creation
 */

export interface PassData {
  formatVersion: 1;
  passTypeIdentifier: string;
  serialNumber: string;
  teamIdentifier: string;
  organizationName: "Park Slope Food Coop";
  description: "PSFC Member Card";
  foregroundColor: string;
  backgroundColor: string;
  labelColor: string;
  storeCard: {
    primaryFields: Array<{
      key: string;
      label: string;
      value: string;
    }>;
    secondaryFields: Array<{
      key: string;
      label: string;
      value: string;
    }>;
  };
  barcode: {
    format: "PKBarcodeFormatPDF417";
    message: string;
    messageEncoding: "iso-8859-1";
  };
}

/**
 * Generate pass.json data structure for a member card.
 * This does not create a signed .pkpass file - that requires Apple credentials.
 */
export function generatePassData(params: {
  memberId: string;
  memberName: string;
  serialNumber: string;
}): PassData {
  const { memberId, memberName, serialNumber } = params;

  return {
    formatVersion: 1,
    // These will be replaced with actual values when Apple credentials are available
    passTypeIdentifier: "pass.com.example.psfc.member",
    serialNumber,
    teamIdentifier: "XXXXXXXXXX",
    organizationName: "Park Slope Food Coop",
    description: "PSFC Member Card",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(22, 101, 52)", // Green to match PSFC branding
    labelColor: "rgb(255, 255, 255)",
    storeCard: {
      primaryFields: [
        {
          key: "name",
          label: "MEMBER",
          value: memberName,
        },
      ],
      secondaryFields: [
        {
          key: "id",
          label: "MEMBER ID",
          value: memberId,
        },
      ],
    },
    barcode: {
      format: "PKBarcodeFormatPDF417",
      message: memberId,
      messageEncoding: "iso-8859-1",
    },
  };
}

/**
 * Log pass data for verification during development.
 */
export function logPassData(passData: PassData): void {
  console.log("Apple Wallet Pass Data:", JSON.stringify(passData, null, 2));
}
