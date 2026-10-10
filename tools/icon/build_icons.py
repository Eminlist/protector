import asyncio, re
from playwright.async_api import async_playwright
from PIL import Image
src=open('/home/claude/protector/tools/icon/icon.svg').read()
inner=re.search(r'(<defs>.*</defs>)(.*)</svg>',src,re.S)
defs,body=inner.group(1),inner.group(2)
# body without tile rects
art=re.sub(r'<!-- tile -->.*?<!-- phone back -->','<!-- phone back -->',body,flags=re.S)
tilefull='<rect width="512" height="512" fill="url(#tile)"/><rect width="512" height="512" fill="url(#glow)"/>'
def wrap(x,size): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="{size}" height="{size}">{defs}{x}</svg>'
variants={
 'rounded': body,
 'square': tilefull+art,
 'maskable': tilefull+'<g transform="translate(256 256) scale(.8) translate(-256 -256)">'+art+'</g>',
}
async def shot(b,svg,size,out):
  pg=await b.new_page(viewport={'width':size,'height':size})
  await pg.set_content('<html><body style="margin:0;background:transparent">'+svg+'</body></html>')
  await pg.screenshot(path=out,omit_background=True); await pg.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    R='/home/claude/protector/'
    await shot(b,wrap(variants['rounded'],512),512,R+'icon-512.png')
    await shot(b,wrap(variants['rounded'],192),192,R+'icon-192.png')
    await shot(b,wrap(variants['square'],180),180,R+'icon-180.png')
    await shot(b,wrap(variants['maskable'],512),512,R+'icon-512-maskable.png')
    await shot(b,wrap(variants['rounded'],256),256,'/tmp/claude-0/sp/ico256.png')
    # Android launcher sizes (for the APK project)
    import os; os.makedirs('/home/claude/protector/tools/icon/android',exist_ok=True)
    for d,s in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
      await shot(b,wrap(variants['rounded'],s),s,f'/home/claude/protector/tools/icon/android/{d}.png')
      await shot(b,wrap(variants['maskable'],s),s,f'/home/claude/protector/tools/icon/android/{d}_sq.png')
    await shot(b,wrap(variants['maskable'],512),512,'/home/claude/protector/tools/icon/android/play512.png')
    await b.close()
  im=Image.open('/tmp/claude-0/sp/ico256.png')
  im.save('/home/claude/protector/ProTechtor™.ico',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
asyncio.run(main())
