// Animation and render studies construct actors directly, outside the selection UI.
// Load their roster explicitly; production UI tests must use the actual lazy path.
export async function preloadWarriorFixtures(page){
 await page.evaluate(async()=>{const {loadWarriorAssets}=await import('/src/actors.js');await loadWarriorAssets();});
}
