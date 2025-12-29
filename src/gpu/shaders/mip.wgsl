struct Camera {
  invViewProj : mat4x4<f32>,
  eye : vec4<f32>,
};

@group(0) @binding(0) var samp : sampler;
@group(0) @binding(1) var rawVol : texture_3d<f32>;
@group(0) @binding(2) var cytoVol : texture_3d<f32>;
@group(0) @binding(3) var<uniform> cam : Camera;

struct VSOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) uv : vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) i : u32) -> VSOut {
  var p = array<vec2<f32>,6>(
    vec2(-1,-1), vec2(1,-1), vec2(-1,1),
    vec2(-1,1), vec2(1,-1), vec2(1,1)
  );
  var o : VSOut;
  o.pos = vec4(p[i],0,1);
  o.uv = p[i]*0.5 + vec2(0.5);
  return o;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4<f32> {
  let ndc = vec4(in.uv*2.0-1.0,1.0,1.0);
  let world = cam.invViewProj * ndc;
  let pos = world.xyz / world.w;

  let rayO = cam.eye.xyz;
  let rayD = normalize(pos - rayO);

  let invD = 1.0 / rayD;
  
  let boxMin = vec3(-0.5);
  let boxMax = vec3( 0.5);
  let t0 = (boxMin - rayO) * invD;
  let t1 = (boxMax - rayO) * invD;

  let tmin = max(max(min(t0.x,t1.x),min(t0.y,t1.y)),min(t0.z,t1.z));
  let tmax = min(min(max(t0.x,t1.x),max(t0.y,t1.y)),max(t0.z,t1.z));

  if (tmax <= tmin) { discard; }

  let steps = 256.0;
  let dt = (tmax - tmin) / steps;

  var t = tmin;
  var m = 0.0;
  for (var i=0.0; i<steps; i=i+1.0) {
    let p = rayO + rayD*t;
    let uvw = p + vec3(0.5);
    let raw  = textureSample(rawVol, samp, uvw).r;
    let cyto = textureSample(cytoVol, samp, uvw).r;
    let combined = max(raw, cyto * 0.6);

    m = max(m, combined);

    t += dt;
  }

  return vec4(m,m,m,1.0);
}
