import cytosolWGSL from "./cytosol.wgsl?raw";

export type CytosolSimulator = {
  step: () => void;
  texture: () => GPUTexture;
};

export function createCytosolSimulator(
  device: GPUDevice,
  size: number,
): CytosolSimulator {
  const module = device.createShaderModule({ code: cytosolWGSL });

  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module, entryPoint: "main" },
  });

  const sampler = device.createSampler({
    minFilter: "linear",
    magFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
  });

  function makeTexture() {
    return device.createTexture({
      size: { width: size, height: size, depthOrArrayLayers: size },
      dimension: "3d",
      format: "rgba16float",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST,
    });
  }

  const texA = makeTexture();
  const texB = makeTexture();
  let ping = true;

  function step() {
    const src = ping ? texA : texB;
    const dst = ping ? texB : texA;
    ping = !ping;

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: src.createView() },
        { binding: 1, resource: dst.createView() },
        { binding: 2, resource: sampler },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(
      Math.ceil(size / 4),
      Math.ceil(size / 4),
      Math.ceil(size / 4),
    );
    pass.end();

    device.queue.submit([encoder.finish()]);
  }

  function texture() {
    return ping ? texB : texA;
  }

  return { step, texture };
}
