// src/cytosol/initField.ts

export function createCytosolTextures(
    device: GPUDevice,
    size: number,
  ) {
    const desc: GPUTextureDescriptor = {
      size: { width: size, height: size, depthOrArrayLayers: size },
      dimension: "3d",
      format: "rgba16float",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST,
    };
  
    return {
      a: device.createTexture(desc),
      b: device.createTexture(desc),
    };
  }
  