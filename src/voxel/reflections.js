// Reflect around the shoreline water level. Animated normals distort sampling;
// they do not tilt the whole reflected scene on every wave.
export const REFLECTION_HEIGHT = .12;
export const reflectionSize = (width, height) => [Math.max(1,Math.ceil(width/2)),Math.max(1,Math.ceil(height/2))];

export function createReflectionTarget(gl) {
  let target=null,width=0,height=0,complete=false;
  return {
    ensure(w,h) {
      const [nextW,nextH]=reflectionSize(w,h);
      if(!target)target={framebuffer:gl.createFramebuffer(),texture:gl.createTexture(),depth:gl.createRenderbuffer()};
      if(nextW!==width||nextH!==height) {
        width=nextW;height=nextH;
        gl.bindTexture(gl.TEXTURE_2D,target.texture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.LINEAR);
        for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);
        gl.bindRenderbuffer(gl.RENDERBUFFER,target.depth);
        gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,width,height);
        gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target.texture,0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,target.depth);
        complete=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
      }
      return complete?{...target,width,height}:null;
    },
    dispose() {
      if(target){gl.deleteTexture(target.texture);gl.deleteRenderbuffer(target.depth);gl.deleteFramebuffer(target.framebuffer);}
      target=null;width=0;height=0;complete=false;
    },
  };
}
