export const HEADLIGHT_TILE = 256;
export const HEADLIGHT_COLUMNS = 4;
export const HEADLIGHT_ROWS = 2;

// One depth atlas, reused each frame. All lights see the same live articulated
// geometry; the lighting pass uses a small PCF filter inside each tile.
export function createHeadlightShadowTarget(gl) {
  let target;
  return {
    ensure() {
      if(target!==undefined)return target;
      const texture=gl.createTexture(),framebuffer=gl.createFramebuffer();
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,HEADLIGHT_TILE*HEADLIGHT_COLUMNS,HEADLIGHT_TILE*HEADLIGHT_ROWS,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
      for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.NEAREST);
      for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,texture,0);
      gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) {
        gl.deleteTexture(texture);gl.deleteFramebuffer(framebuffer);target=null;
      } else target={texture,framebuffer};
      return target;
    },
  };
}

export function inHeadlightRange(object,origin,direction) {
  if(object.noShadow)return false;
  const radius=Math.hypot(...(object.mesh.bounds??[32,32,32]))*object.units/2;
  const dx=object.position[0]-origin[0],dz=object.position[2]-origin[2];
  const ahead=dx*direction[0]+dz*direction[1],side=Math.abs(-dx*direction[1]+dz*direction[0]);
  return ahead+radius>.5 && ahead-radius<direction[2] && side<Math.max(0,ahead)*.5+radius;
}
