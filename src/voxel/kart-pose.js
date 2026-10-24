// Shared live geometry poses for every driving picture table. Frame counters
// come from the simulation; drawing never advances animation or changes physics.
export function kartPose(car = {}, fx = {}, tick = 0, racer = false) {
  const table=fx.crash?.table??car.pic?.table??'lean';
  const row=fx.crash?.row??car.pic?.row??0;
  const pose={spin:0,tilt:[0,0],lift:0,head:0};
  switch(table){
    case 'lean': pose.tilt[1]=-((car.lean??2)-2)*.035; break;
    case 'drift': pose.spin=((car.lean??2)-2)*.1;pose.tilt[1]=-pose.spin*.3; break;
    case 'spin': pose.spin=row*Math.PI/4;pose.tilt[1]=.08*Math.sin(row*Math.PI/2);break;
    case 'bump': pose.head=(row-2)*.3;pose.tilt[1]=Math.sin(row)*.04;break;
    case 'wobble': pose.head=.35*Math.sin(row*Math.PI/2);pose.tilt=[.05*Math.cos(row*Math.PI/2),.13*Math.sin(row*Math.PI/2)];break;
    case 'pose': pose.head=.25*Math.sin(row);pose.tilt[0]=-.1-.08*Math.sin(row);pose.lift=.5+.5*Math.sin(row);break;
    case 'flight': pose.spin=row*Math.PI/4;pose.tilt=[row*Math.PI/4,.18];break;
    case 'fall': pose.tilt=[.25+row*.18,.45*Math.sin(row+1)];break;
  }
  if(fx.pit||car.special){pose.tilt=[.06*Math.sin((car.specialFrame??0)*Math.PI/2),.04*Math.cos((car.specialFrame??0)*Math.PI/2)];}
  if(car.wrecked||(racer&&car.crashed&&car.crashShown)){pose.tilt=[.25,Math.PI/2];pose.spin=(car.crashPic??car.wreckShown??0)*.45;}
  if(racer&&car.hit){pose.spin=(car.hitSpin??0)*Math.PI/4;pose.tilt[1]=.08*Math.sin(tick*.7);}
  // Waiting/glancing racers keep their live mesh; a small look to either side
  // substitutes for the archive's driver-specific idle sprite artwork.
  if(racer && Number.isInteger(car.blink?.shown) && car.blink.shown>=8)pose.head=(car.blink.shown<10?-1:1)*(.3+.2*(car.blink.shown%2));
  return pose;
}
