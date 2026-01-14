declare module "pdf417-generator" {
  const PDF417: {
    draw(
      text: string,
      canvas: HTMLCanvasElement,
      scale?: number,
      aspectRatio?: number,
      padding?: number
    ): void;
  };
  export default PDF417;
}
