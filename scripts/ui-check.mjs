import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const key=(await readFile('.private/data/api-key','utf8')).trim();
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:13246/#key='+key);await page.getByText('账号已连接',{exact:true}).waitFor();
 assert.equal(new URL(page.url()).hash,'');
 await page.locator('#search').fill('glm-5.3-flash');await page.locator('.model').click();
 await page.getByText('已选择 GLM-5.3-Flash。点击“应用到 Codex”使切换生效。',{exact:true}).waitFor();
 await page.locator('#configure').click();await page.getByText('已应用 glm-5.3-flash。请重新打开 Codex，并新建聊天。',{exact:true}).waitFor();
 await page.locator('#search').fill('');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'evidence/ui-desktop.png',fullPage:true,mask:[page.locator('#account-name')],maskColor:'#e6eedf'});
 await page.reload();await page.locator('#selected').getByText('GLM-5.3-Flash',{exact:true}).waitFor();
 await page.locator('#search').fill('不存在的模型');assert.equal(await page.locator('.model').count(),0);assert.match(await page.locator('.empty').innerText(),/没有匹配/);
 await page.locator('#search').fill('deepseek-v4.1');await page.locator('.model').click();await page.locator('#selected').getByText('DeepSeek-V4.1-Flash',{exact:true}).waitFor();
 await page.locator('#search').fill('glm-5.3-flash');await page.locator('.model').click();await page.locator('#selected').getByText('GLM-5.3-Flash',{exact:true}).waitFor();await page.locator('#search').fill('');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(200);await page.screenshot({path:'evidence/ui-mobile.png',mask:[page.locator('#account-name')],maskColor:'#e6eedf'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 await writeFile('evidence/ui-check.json',JSON.stringify({browser:'Google Chrome',desktop:[1440,1100],mobile:[390,844],flows:['authenticated opening','fragment removed','search','select','apply to isolated Codex','selection persists across reload','empty search','switch models','no horizontal overflow'],consoleErrors:errors,passed:true},null,2));console.log('UI flows passed; desktop and mobile screenshots saved.');
}finally{await browser.close();}
