@group(0) @binding(0) var srcField : texture_3d<f32>;
@group(0) @binding(1) var dstField : texture_storage_3d<rgba16float, write>;
@group(0) @binding(2) var samp : sampler;

fn hash(p: vec3<f32>) -> f32 {
  return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453);
}

fn velocity(p: vec3<f32>) -> vec3<f32> {
  let n1 = hash(p + vec3(0.0, 17.0, 29.0));
  let n2 = hash(p + vec3(19.0, 3.0, 11.0));
  let n3 = hash(p + vec3(7.0, 23.0, 5.0));
  return normalize(vec3(n1 - 0.5, n2 - 0.5, n3 - 0.5));
}

@compute @workgroup_size(4,4,4)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let sizeU = textureDimensions(dstField);
  if (any(gid >= sizeU)) { return; }

  let p  = vec3<i32>(gid);
  let pf = vec3<f32>(gid) / vec3<f32>(sizeU);

  // --- Diffusion ---
  var sum = 0.0;
  var count = 0.0;

  let offs = array<vec3<i32>,6>(
    vec3(1,0,0),vec3(-1,0,0),
    vec3(0,1,0),vec3(0,-1,0),
    vec3(0,0,1),vec3(0,0,-1)
  );

  for (var i=0;i<6;i++){
    let q = p + offs[i];
    if (all(q>=vec3(0)) && all(q<vec3<i32>(sizeU))){
      sum += textureLoad(srcField,q,0).r;
      count += 1.0;
    }
  }

  let center   = textureLoad(srcField,p,0).r;
  let diffused = mix(center, sum/max(count,1.0), 0.25);

  // --- Advection (stronger & larger-scale) ---
  let v      = velocity(pf * 3.0);
  let advPos = clamp(pf - 0.03 * v, vec3(0.0), vec3(0.999));
  let adv    = textureSampleLevel(srcField, samp, advPos, 0.0).r;

  // --- Noise ---
  let n = hash(vec3<f32>(gid));

  // --- Final update ---
  var value =
    mix(diffused, adv, 0.9) * 0.995 +
    0.08 * (n - 0.5);

  textureStore(dstField, p, vec4(clamp(value,0.0,1.0),0,0,1));
}
