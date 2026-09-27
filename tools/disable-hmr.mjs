// Keep Vite's development CSS loader without reloads during asset capture.
export async function disableHmr(page){
 await page.route('**/@vite/client',route=>route.fulfill({contentType:'application/javascript',body:`
 const styles=new Map();
 export function updateStyle(id,content){let s=styles.get(id);if(!s){s=document.createElement('style');document.head.append(s);styles.set(id,s);}s.textContent=content;}
 export function removeStyle(id){styles.get(id)?.remove();styles.delete(id);}
 export function createHotContext(){return {data:{},accept(){},acceptExports(){},dispose(){},prune(){},invalidate(){},on(){},off(){},send(){}};}
 export function injectQuery(url){return url;}
 `}));
}
