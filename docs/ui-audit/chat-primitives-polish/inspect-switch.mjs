import { config } from "dotenv"; config({ path: ".env.local" });
import { chromium } from "playwright";
const BASE="http://localhost:3100", PASS="FourPie!Demo2026";
const b=await chromium.launch({channel:"chrome",headless:true});
const p=await (await b.newContext({viewport:{width:1100,height:1000}})).newPage();
await p.goto(`${BASE}/login`,{waitUntil:"domcontentloaded"});
await p.fill("input[type=email]","demo-client@example.com"); await p.fill("input[type=password]",PASS);
await p.click('button:has-text("Sign in")'); await p.waitForURL("**/dashboard",{timeout:30000}).catch(()=>{});
await p.goto(`${BASE}/settings`,{waitUntil:"networkidle"}); await p.waitForTimeout(1200);
const info = await p.evaluate(()=>{
  const el = document.querySelector('[data-slot="switch"]');
  if(!el) return {found:false};
  const cs = getComputedStyle(el);
  return { found:true, attrs: el.getAttributeNames(), bg: cs.backgroundColor, w: cs.width, h: cs.height, outer: el.outerHTML.slice(0,200) };
});
console.log(JSON.stringify(info,null,2));
await b.close();
