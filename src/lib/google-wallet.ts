/**
 * Google Wallet Pass generation for PSFC member cards.
 * Uses JWT-based Generic passes with PDF417 barcode.
 */

import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID!;
const CLASS_ID = `${ISSUER_ID}.foodcoop.news.wallet`;

// Load service account credentials from GOOGLE_APPLICATION_CREDENTIALS (base64 JSON string)
function getServiceAccountCredentials(): {
  client_email: string;
  private_key: string;
  private_key_id: string;
} {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsJson) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS environment variable not set",
    );
  }
  let decodedCredentials: string;
  try {
    decodedCredentials = Buffer.from(credentialsJson, "base64").toString(
      "utf8",
    );
  } catch (error) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not valid base64");
  }

  let credentials: {
    client_email: string;
    private_key: string;
    private_key_id: string;
  };
  try {
    credentials = JSON.parse(decodedCredentials) as {
      client_email: string;
      private_key: string;
      private_key_id: string;
    };
  } catch (error) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not valid JSON");
  }
  return {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
    private_key_id: credentials.private_key_id,
  };
}

/**
 * Create a Generic pass object for an individual member.
 */
export function createGenericObject(params: {
  memberId: string;
  memberName: string;
  serialNumber: string;
}) {
  const { memberId, memberName, serialNumber } = params;
  const objectId = `${ISSUER_ID}.${serialNumber}`;

  return {
    id: objectId,
    classId: CLASS_ID,
    cardTitle: {
      defaultValue: {
        language: "en-US",
        value: "Park Slope Food Coop",
      },
    },
    subheader: {
      defaultValue: {
        language: "en-US",
        value: "Member",
      },
    },
    header: {
      defaultValue: {
        language: "en-US",
        value: `${memberName} (${memberId})`,
      },
    },
    textModulesData: [
      {
        id: "member",
        localizedHeader: {
          defaultValue: {
            language: "en-US",
            value: "Member",
          },
        },
        localizedBody: {
          defaultValue: {
            language: "en-US",
            value: memberName,
          },
        },
      },
      {
        id: "member_id",
        localizedHeader: {
          defaultValue: {
            language: "en-US",
            value: "Member ID",
          },
        },
        localizedBody: {
          defaultValue: {
            language: "en-US",
            value: memberId,
          },
        },
      },
    ],
    barcode: {
      type: "PDF_417",
      value: memberId,
      alternateText: "",
    },
    hexBackgroundColor: "#fff6dc",
    logo: {
      sourceUri: {
        uri: "https://www.foodcoop.com/wp-content/themes/coop2018/favicon.png",
      },
      contentDescription: {
        defaultValue: {
          language: "en-US",
          value: "The Park Slope Food Coop Carrot",
        },
      },
    },
    appLinkData: {
      uri: {
        uri: "https://foodcoop.news",
        description: "foodcoop.news",
      },
    },
    wideLogo: {
      sourceUri: {
        uri: "https://www.foodcoop.com/wp-content/themes/coop2018/images/logo.png",
      },
      contentDescription: {
        defaultValue: {
          language: "en-US",
          value: "Park Slope Food Coop Logo",
        },
      },
    },
  };
}

/**
 * Generate a signed JWT for Google Wallet.
 */
export function generateGoogleWalletJWT(params: {
  memberId: string;
  memberName: string;
  serialNumber: string;
}): string {
  const { claims, credentials } = buildGoogleWalletClaims(params);
  return jwt.sign(claims, credentials.private_key, {
    algorithm: "RS256",
    header: {
      alg: "RS256",
      kid: credentials.private_key_id,
      typ: "JWT",
    },
  });
}

function buildGoogleWalletClaims(params: {
  memberId: string;
  memberName: string;
  serialNumber: string;
}) {
  const credentials = getServiceAccountCredentials();
  const serialNumber =
    process.env.NODE_ENV === "production" ? params.serialNumber : randomUUID();
  const genericObject = createGenericObject({
    ...params,
    serialNumber,
  });
  const issuedAt = Math.floor(Date.now() / 1000);
  const claims = {
    iss: credentials.client_email,
    aud: "google",
    iat: issuedAt,
    exp: issuedAt + 60 * 60,
    origins: ["foodcoop.news", "localhost:3000"],
    typ: "savetowallet",
    payload: {
      genericObjects: [genericObject],
    },
  };

  return {
    claims,
    credentials,
    classId: CLASS_ID,
    objectId: genericObject.id,
    serialNumber,
  };
}

/**
 * Generate the Google Wallet "Add to Wallet" URL.
 */
export function generateGoogleWalletURL(params: {
  memberId: string;
  memberName: string;
  serialNumber: string;
}): string {
  const token = generateGoogleWalletJWT(params);
  return `https://pay.google.com/gp/v/save/${token}`;
}
