// Bounded camera translation only: no roll, zoom or simulation changes. The HUD
// remains a separate layer. Presentation-time sampling also freezes on pause.
export function shakenCamera(camera, forward, player, impacts, enabled = true) {
  if (!enabled) return camera.slice();
  let side=0,up=0;
  for(const hit of impacts) {
    const strong=(hit.strength??1)>1, duration=strong?.42:.24, t=hit.age;
    if(t<0||t>=duration)continue;
    const distance=Math.hypot(hit.x-player.x,hit.y-player.y);
    const proximity=Math.max(0,1-distance/180)**2;
    const envelope=Math.min(1,t/.025)*(1-t/duration)**2;
    const amount=(strong?1.05:.32)*proximity*envelope, phase=hit.seed*.73;
    side+=Math.sin(t*91+phase)*amount;
    up+=Math.sin(t*117+phase*1.3)*amount*.65;
  }
  // Simultaneous impacts cannot combine into a large camera excursion.
  const limit=Math.min(1,1.1/Math.max(Math.hypot(side,up),1e-6));
  return [camera[0]-forward[1]*side*limit,camera[1]+up*limit,camera[2]+forward[0]*side*limit];
}
