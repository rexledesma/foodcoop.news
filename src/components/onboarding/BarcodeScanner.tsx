"use client";

import { useCallback, useState } from "react";
import { BrowserPDF417Reader } from "@zxing/browser";

interface BarcodeScannerProps {
  onScanSuccess: (memberId: string) => void;
  onScanError: (error: string) => void;
}

export function BarcodeScanner({
  onScanSuccess,
  onScanError,
}: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);

  const scanImage = useCallback(
    async (imageFile: File) => {
      setIsScanning(true);

      try {
        const reader = new BrowserPDF417Reader();
        const imageUrl = URL.createObjectURL(imageFile);

        try {
          const result = await reader.decodeFromImageUrl(imageUrl);
          const barcodeText = result.getText();

          // Extract member ID from barcode
          // PSFC barcodes typically contain the member ID as a numeric string
          const memberId = extractMemberId(barcodeText);

          if (memberId) {
            onScanSuccess(memberId);
          } else {
            onScanError(
              "Could not extract member ID from barcode. Please try again or enter manually."
            );
          }
        } finally {
          URL.revokeObjectURL(imageUrl);
        }
      } catch (error) {
        console.error("Barcode scan error:", error);
        onScanError(
          "Could not read barcode from image. Please try again or enter manually."
        );
      } finally {
        setIsScanning(false);
      }
    },
    [onScanSuccess, onScanError]
  );

  return { scanImage, isScanning };
}

/**
 * Extract member ID from the barcode text.
 * PSFC member cards use PDF417 barcodes that contain the member ID.
 * The exact format may vary, so we try multiple extraction strategies.
 */
function extractMemberId(barcodeText: string): string | null {
  // Clean the barcode text
  const cleaned = barcodeText.trim();

  // Strategy 1: If it's all digits, use it directly
  if (/^\d+$/.test(cleaned)) {
    return cleaned.padStart(6, "0");
  }

  // Strategy 2: Extract numeric portion if mixed with letters
  const numericMatch = cleaned.match(/\d{4,}/);
  if (numericMatch) {
    return numericMatch[0].padStart(6, "0");
  }

  // Strategy 3: Return null if no valid ID found
  return null;
}
