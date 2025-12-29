// src/gpu/pipeline.ts

import mipWGSL from "./shaders/mip.wgsl?raw";
import type { Camera } from "../camera/camera";
import { computeInvViewProj } from "../camera/matrices";

export type MipRenderer = {
  render: (camera: Camera) => void;
  resize: () => void;
};

const UNIFORM_SIZE = 80; // 64 (mat4) + 16 (vec4)

export function createVolumeTexture(
  device: GPUDevice,
  data: Uint8Array,
  width: number,
  height: number,
  depth: number,
): GPUTexture {
  const expected = width * height * depth;
  if (data.byteLength !== expected) {
    throw new Error(
      `RAW size mismatch. Expected ${expected} bytes, got ${data.byteLength}.`,
    );
  }

  const tex = device.createTexture({
    size: { width, height, depthOrArrayLayers: depth },
    dimension: "3d",
    format: "r8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  // TODO: padded upload for arbitrary widths.
  device.queue.writeTexture(
    { texture: tex },
    data.buffer,
    {
      bytesPerRow: width,
      rowsPerImage: height,
    },
    {
      width,
      height,
      depthOrArrayLayers: depth,
    },
  );

  return tex;
}

export function createMipRenderer(
  device: GPUDevice,
  context: GPUCanvasContext,
  format: GPUTextureFormat,
  rawVolume: GPUTexture,
  cytosolVolume: GPUTexture,
): MipRenderer {
  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
  });

  const uniformBuffer = device.createBuffer({
    size: UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "3d" } }, // RAW
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "3d" } }, // Cytosol
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
    ],    
  });

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: {
      module: device.createShaderModule({ code: mipWGSL }),
      entryPoint: "vs",
    },
    fragment: {
      module: device.createShaderModule({ code: mipWGSL }),
      entryPoint: "fs",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
    },
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: rawVolume.createView({ dimension: "3d" }) },
      { binding: 2, resource: cytosolVolume.createView({ dimension: "3d" }) },
      { binding: 3, resource: { buffer: uniformBuffer } },
    ],
  });
    
  function resize() {
    const canvas = (context as unknown as { canvas: HTMLCanvasElement }).canvas;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function render(camera: Camera) {
    resize();

    const { invViewProj, eye } = computeInvViewProj(camera);

    const uniformData = new Float32Array(20); // 16 + 4
    uniformData.set(invViewProj, 0);
    uniformData.set(eye, 16);

    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const colorTex = context.getCurrentTexture();
    const encoder = device.createCommandEncoder();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: colorTex.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(6);
    pass.end();

    device.queue.submit([encoder.finish()]);
  }

  return { render, resize };
}
