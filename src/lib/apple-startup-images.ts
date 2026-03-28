type Orientation = 'portrait' | 'landscape';

type AppleStartupDeviceSpec = {
  deviceWidth: number;
  deviceHeight: number;
  pixelRatio: number;
};

type AppleStartupImage = {
  href: string;
  media: string;
};

const APPLE_STARTUP_DEVICES: ReadonlyArray<AppleStartupDeviceSpec> = [
  { deviceWidth: 1024, deviceHeight: 1366, pixelRatio: 2 },
  { deviceWidth: 834, deviceHeight: 1194, pixelRatio: 2 },
  { deviceWidth: 768, deviceHeight: 1024, pixelRatio: 2 },
  { deviceWidth: 820, deviceHeight: 1180, pixelRatio: 2 },
  { deviceWidth: 834, deviceHeight: 1112, pixelRatio: 2 },
  { deviceWidth: 810, deviceHeight: 1080, pixelRatio: 2 },
  { deviceWidth: 744, deviceHeight: 1133, pixelRatio: 2 },
  { deviceWidth: 440, deviceHeight: 956, pixelRatio: 3 },
  { deviceWidth: 402, deviceHeight: 874, pixelRatio: 3 },
  { deviceWidth: 420, deviceHeight: 912, pixelRatio: 3 },
  { deviceWidth: 430, deviceHeight: 932, pixelRatio: 3 },
  { deviceWidth: 393, deviceHeight: 852, pixelRatio: 3 },
  { deviceWidth: 390, deviceHeight: 844, pixelRatio: 3 },
  { deviceWidth: 428, deviceHeight: 926, pixelRatio: 3 },
  { deviceWidth: 375, deviceHeight: 812, pixelRatio: 3 },
  { deviceWidth: 414, deviceHeight: 896, pixelRatio: 3 },
  { deviceWidth: 414, deviceHeight: 896, pixelRatio: 2 },
  { deviceWidth: 414, deviceHeight: 736, pixelRatio: 3 },
  { deviceWidth: 375, deviceHeight: 667, pixelRatio: 2 },
  { deviceWidth: 320, deviceHeight: 568, pixelRatio: 2 },
];

const ORIENTATIONS: ReadonlyArray<Orientation> = ['portrait', 'landscape'];

function toSplashImage(spec: AppleStartupDeviceSpec, orientation: Orientation): AppleStartupImage {
  const portraitWidth = spec.deviceWidth * spec.pixelRatio;
  const portraitHeight = spec.deviceHeight * spec.pixelRatio;
  const imageWidth = orientation === 'portrait' ? portraitWidth : portraitHeight;
  const imageHeight = orientation === 'portrait' ? portraitHeight : portraitWidth;

  return {
    href: `/splash/apple-splash-${imageWidth}-${imageHeight}.jpg`,
    media: `(device-width: ${spec.deviceWidth}px) and (device-height: ${spec.deviceHeight}px) and (-webkit-device-pixel-ratio: ${spec.pixelRatio}) and (orientation: ${orientation})`,
  };
}

export const APPLE_STARTUP_IMAGES: ReadonlyArray<AppleStartupImage> = APPLE_STARTUP_DEVICES.flatMap(
  (spec) => ORIENTATIONS.map((orientation) => toSplashImage(spec, orientation)),
);
