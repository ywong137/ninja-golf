// Animation and render studies construct actors directly, outside the selection UI.
// Load their roster explicitly; production UI tests must use the actual lazy path.
export async function preloadWarriorFixtures(page){
 await page.evaluate(async()=>{
  // Vite can timestamp the application's import after an edit. Import that
  // same module; an unversioned import would create a second asset cache.
  const url=performance.getEntriesByType('resource').map(entry=>entry.name).find(name=>new URL(name).pathname==='/src/actors.js')??'/src/actors.js';
  const {loadWarriorAssets}=await import(url);await loadWarriorAssets();
 });
}
