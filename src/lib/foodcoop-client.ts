import * as cheerio from "cheerio";
import sharp from "sharp";
import {
  BinaryBitmap,
  HybridBinarizer,
  PDF417Reader,
  RGBLuminanceSource,
} from "@zxing/library";
import type { AuthSession, Member, Shift } from "./types";

const MEMBER_SERVICES_URL = "https://members.foodcoop.com/services";

async function fetchAndDecodeBarcode(
  cookies: string,
  memberId: string
): Promise<string | null> {
  try {
    // Fetch the barcode image from PSFC
    const response = await fetch(
      `${MEMBER_SERVICES_URL}/member_barcode/${memberId}/`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Cookie: cookies,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch barcode image:", response.status);
      return null;
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Use sharp to get raw pixel data
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Compute luminance values from RGBA
    // RGBLuminanceSource expects pre-computed luminance values (1 byte per pixel)
    // Luminance formula: L = 0.299*R + 0.587*G + 0.114*B
    const luminanceData = new Uint8ClampedArray(info.width * info.height);
    for (let i = 0; i < info.width * info.height; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      luminanceData[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    // Create luminance source and binary bitmap
    const luminanceSource = new RGBLuminanceSource(
      luminanceData,
      info.width,
      info.height
    );
    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

    // Decode the PDF417 barcode
    const reader = new PDF417Reader();
    const result = reader.decode(binaryBitmap);

    console.log("Decoded barcode value:", result.getText());
    return result.getText();
  } catch (error) {
    console.error("Error decoding barcode:", error);
    return null;
  }
}

interface LoginResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
}

export async function login(
  username: string,
  password: string
): Promise<LoginResult> {
  try {
    // First, get the login page to obtain the CSRF token and session cookie
    const loginPageResponse = await fetch(`${MEMBER_SERVICES_URL}/login/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });

    const loginPageHtml = await loginPageResponse.text();
    const $ = cheerio.load(loginPageHtml);

    // Extract Django CSRF token
    const csrfToken = $('input[name="csrfmiddlewaretoken"]').val() as string;
    if (!csrfToken) {
      return {
        success: false,
        error: "Could not obtain CSRF token from login page",
      };
    }

    // Parse cookies from initial request (need csrftoken and sessionid)
    const setCookieHeaders = loginPageResponse.headers.getSetCookie?.() || [];
    const cookieString =
      setCookieHeaders.length > 0
        ? setCookieHeaders
            .map((c) => c.split(";")[0])
            .join("; ")
        : loginPageResponse.headers.get("set-cookie")?.split(",").map((c) => c.split(";")[0]).join("; ") || "";

    console.log("CSRF Token:", csrfToken);
    console.log("Initial cookies:", cookieString);

    // Submit login form
    const formData = new URLSearchParams();
    formData.append("csrfmiddlewaretoken", csrfToken);
    formData.append("username", username);
    formData.append("password", password);
    formData.append("next", "");

    const loginResponse = await fetch(`${MEMBER_SERVICES_URL}/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        Cookie: cookieString,
        Referer: `${MEMBER_SERVICES_URL}/login/`,
        Origin: "https://members.foodcoop.com",
      },
      body: formData.toString(),
      redirect: "manual",
    });

    console.log("Login response status:", loginResponse.status);
    console.log("Login response location:", loginResponse.headers.get("location"));

    // Collect all cookies from the login response
    const loginSetCookies = loginResponse.headers.getSetCookie?.() || [];
    const newCookies =
      loginSetCookies.length > 0
        ? loginSetCookies.map((c) => c.split(";")[0]).join("; ")
        : loginResponse.headers.get("set-cookie")?.split(",").map((c) => c.split(";")[0]).join("; ") || "";

    // Merge cookies (new ones override old)
    const allCookies = mergeCookies(cookieString, newCookies);
    console.log("Merged cookies:", allCookies);

    // Check if login was successful (Django redirects to /services/home on success)
    const location = loginResponse.headers.get("location");
    if (loginResponse.status === 302 && location?.includes("/home")) {
      // Fetch the home page to get member info (no trailing slash!)
      const homeResponse = await fetch(`${MEMBER_SERVICES_URL}/home`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Cookie: allCookies,
        },
        redirect: "manual",
      });

      console.log("Home response status:", homeResponse.status);
      console.log("Home response location:", homeResponse.headers.get("location"));

      // If home page redirects to login, session didn't persist
      const homeLocation = homeResponse.headers.get("location");
      if (homeResponse.status === 302 && homeLocation?.includes("/login")) {
        return {
          success: false,
          error: "Session did not persist after login",
        };
      }

      // Follow redirect or get content
      let homeHtml: string;
      if (homeResponse.status === 302) {
        const finalResponse = await fetch(`https://members.foodcoop.com${homeLocation}`, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Cookie: allCookies,
          },
        });
        homeHtml = await finalResponse.text();
      } else if (homeResponse.ok) {
        homeHtml = await homeResponse.text();
      } else {
        return {
          success: false,
          error: `Failed to fetch home page: ${homeResponse.status}`,
        };
      }

      console.log("Home page length:", homeHtml.length);
      const member = parseMemberInfo(homeHtml);
      console.log("Parsed member:", JSON.stringify(member));

      // Decode the barcode to get the zero-padded member ID
      if (member.memberNumber) {
        const barcodeValue = await fetchAndDecodeBarcode(
          allCookies,
          member.memberNumber
        );
        if (barcodeValue) {
          member.barcodeValue = barcodeValue;
          console.log("Decoded barcode value:", barcodeValue);
        }
      }

      return {
        success: true,
        session: {
          authenticated: true,
          member,
          cookies: allCookies,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        },
      };
    }

    // If we get a 200, it means we're still on the login page (error)
    // If we get a 302 to login page, also an error
    const errorHtml = loginResponse.status === 200
      ? await loginResponse.text()
      : loginPageHtml;
    const error$ = cheerio.load(errorHtml);

    // Look for Django error messages
    const errorMessage =
      error$(".errorlist li").first().text().trim() ||
      error$(".alert-danger").first().text().trim() ||
      error$(".error").first().text().trim() ||
      error$("#loginform .errorlist").text().trim() ||
      "Invalid username or password";

    return {
      success: false,
      error: errorMessage,
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Login failed",
    };
  }
}

function mergeCookies(existing: string, newCookies: string): string {
  const cookieMap = new Map<string, string>();

  // Parse existing cookies
  existing.split(";").forEach((c) => {
    const [name, ...valueParts] = c.trim().split("=");
    if (name) {
      cookieMap.set(name.trim(), valueParts.join("="));
    }
  });

  // Parse and override with new cookies
  newCookies.split(";").forEach((c) => {
    const [name, ...valueParts] = c.trim().split("=");
    if (name) {
      cookieMap.set(name.trim(), valueParts.join("="));
    }
  });

  // Reconstruct cookie string
  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function parseMemberInfo(html: string): Member {
  const $ = cheerio.load(html);

  // Extract member number from member_card or member_barcode URL
  // Pattern: /services/member_card/XXXXX/ or /services/member_barcode/XXXXX/
  const memberCardMatch = html.match(/\/services\/member_(?:card|barcode)\/(\d+)\//);
  const memberNumber = memberCardMatch?.[1] || "";

  // Extract name from the red-colored span in the member card section
  // Pattern: <span style="color:#c00">Name</span>
  const nameMatch = html.match(/<span[^>]*color:#c00[^>]*>([^<]+)<\/span>/);
  const name = nameMatch?.[1]?.trim() || "Member";

  // Check status from the status section
  // Pattern: <span class='status active'>Active</span>
  let status: Member["status"] = "unknown";
  const statusMatch = html.match(/<span[^>]*class=['"]status\s+(\w+)['"][^>]*>/i);
  if (statusMatch) {
    const statusClass = statusMatch[1].toLowerCase();
    if (statusClass === "active") {
      status = "active";
    } else if (statusClass === "alert") {
      status = "alert";
    } else if (statusClass === "suspended") {
      status = "suspended";
    }
  }

  return {
    id: memberNumber || "unknown",
    name,
    memberNumber,
    status,
  };
}

export async function fetchShifts(cookies: string): Promise<Shift[]> {
  try {
    const response = await fetch(`${MEMBER_SERVICES_URL}/home`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FoodCoopTech/1.0; +https://foodcoop.tech)",
        Cookie: cookies,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch shifts");
    }

    const html = await response.text();
    return parseShifts(html);
  } catch (error) {
    console.error("Error fetching shifts:", error);
    return [];
  }
}

function parseShifts(html: string): Shift[] {
  const $ = cheerio.load(html);
  const shifts: Shift[] = [];

  // Parse shift table or list - adjust selectors based on actual structure
  $(".shift, .workslot, tr[data-shift]").each((index, element) => {
    const $el = $(element);

    const date = $el.find(".date, td:nth-child(1)").text().trim();
    const time = $el.find(".time, td:nth-child(2)").text().trim();
    const squad = $el.find(".squad, td:nth-child(3)").text().trim();
    const location = $el.find(".location, td:nth-child(4)").text().trim();

    if (date) {
      shifts.push({
        id: `shift-${index}`,
        date,
        time,
        squad,
        location,
        status: "scheduled",
      });
    }
  });

  return shifts;
}

export async function fetchMemberPage(
  cookies: string,
  path: string
): Promise<string> {
  const response = await fetch(`${MEMBER_SERVICES_URL}${path}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; FoodCoopTech/1.0; +https://foodcoop.tech)",
      Cookie: cookies,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }

  return response.text();
}
