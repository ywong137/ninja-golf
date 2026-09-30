// Median backward toe speed during native ground contact, in model metres/second.
// All three enemy rigs share these source strides. Runtime scale changes distance.
export const ENEMY_STRIDE_SPEED=Object.freeze({Jog_Fwd_Loop:5.5731,Sprint_Loop:7.9945});
export function enemyStrideRate(clip,speed,scale=1){
 const sourceSpeed=ENEMY_STRIDE_SPEED[clip];
 if(!sourceSpeed||!Number.isFinite(speed)||speed<0||!Number.isFinite(scale)||scale<=0)throw Error('Supply a known enemy gait, nonnegative speed, and positive model scale.');
 return Math.min(3,speed/(sourceSpeed*scale));
}
