const { test, expect } = require('@playwright/test');

const viewports=[
  {name:'mobile',width:375,height:812},
  {name:'desktop',width:1366,height:768}
];

for(const vp of viewports){
  test(`${vp.name} shell loads without horizontal overflow`,async({page})=>{
    await page.setViewportSize({width:vp.width,height:vp.height});
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e.message||e)));
    await page.goto('http://127.0.0.1:4173',{waitUntil:'domcontentloaded'});
    await expect(page).toHaveTitle(/V7 Lite/);
    await expect(page.locator('#loginUser')).toBeVisible();
    await expect(page.locator('#loginPass')).toBeVisible();
    await page.locator('#loginUser').fill('prueba');
    await page.locator('#loginPass').fill('12345678');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
    expect(overflow).toBeFalsy();
    expect(errors).toEqual([]);
  });
}
