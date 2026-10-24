// Multisample coverage smooths silhouettes without blurring voxel faces or HUD.
export function createTrackAntialias(gl) {
  const colorSamples=gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA8,gl.SAMPLES)??[];
  const depthSamples=gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,gl.SAMPLES)??[];
  const samples=Math.max(0,...Array.from(colorSamples).filter(n=>n<=4&&n>1&&Array.from(depthSamples).includes(n)));
  let framebuffer=null,color=null,depth=null,width=0,height=0,failed=false;
  return {
    ensure(w,h) {
      if(!samples||failed)return null;
      if(!framebuffer){framebuffer=gl.createFramebuffer();color=gl.createRenderbuffer();depth=gl.createRenderbuffer();}
      if(w!==width||h!==height){
        width=w;height=h;gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
        for(const [buffer,format,attachment] of [[color,gl.RGBA8,gl.COLOR_ATTACHMENT0],[depth,gl.DEPTH_COMPONENT24,gl.DEPTH_ATTACHMENT]]) {
          gl.bindRenderbuffer(gl.RENDERBUFFER,buffer);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,format,w,h);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER,attachment,gl.RENDERBUFFER,buffer);
        }
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){
          gl.deleteFramebuffer(framebuffer);gl.deleteRenderbuffer(color);gl.deleteRenderbuffer(depth);failed=true;return null;
        }
      }
      return framebuffer;
    },
    resolve(target) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,framebuffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,target);
      gl.blitFramebuffer(0,0,width,height,0,0,width,height,gl.COLOR_BUFFER_BIT,gl.NEAREST);
    },
  };
}
