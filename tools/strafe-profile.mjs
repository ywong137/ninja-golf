// Sideways running turns the hips toward travel while the upper body watches
// the opponent. Dimensions are metres in the native, unscaled character.
export const STRAFE_VERSION=1;
export const STRAFE_CLIPS={Run_Right:1,Run_Left:-1};
export const STRAFE_PROFILE=Object.freeze({
 duration:.7,support:.28,amplitude:.30,width:.13,lift:.22,
 hipTurn:85,chestTurn:55,headTurn:20,toeOut:8,
 pelvisDrop:.10,pelvisBounce:.011,pelvisSway:.012,sourceChestYaw:.25,
});
