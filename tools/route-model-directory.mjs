import fs from 'node:fs';
import path from 'node:path';

// Explicit model-only previews do not change animation records or game rules.
export async function routeModelDirectory(page,directory){
 if(!directory)return;
 const root=path.resolve(directory);
 if(!fs.statSync(root).isDirectory())throw Error('Model directory is not a directory: '+root);
 const names=fs.readdirSync(root).filter(name=>/^[a-z-]+\.glb$/.test(name));
 if(!names.length)throw Error('Model directory contains no character GLBs: '+root);
 for(const name of names)await page.route(`**/models/${name}*`,route=>route.fulfill({contentType:'model/gltf-binary',path:path.join(root,name)}));
}
