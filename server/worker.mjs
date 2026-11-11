// Bundled with DEFAULT_CONTENT, OWNER_EMAIL and STATIC_ASSETS by scripts/build.mjs.
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const failure=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const cleanPath=pathname=>decodeURIComponent(pathname).replace(/^\//,'');
function allowedUrl(value){if(!value)return true;if(/[\x00-\x20<>"'\\]/.test(value)||value.startsWith('//'))return false;try{const u=new URL(value,'https://local.invalid');if(u.protocol==='https:')return !decodeURIComponent(u.pathname).split('/').includes('..');return u.protocol==='mailto:'||u.protocol==='tel:'}catch{return false}}
function validateContent(input){
  const maxArrays={services:12,navigation:8,slides:20,socials:12,directions:8,items:30,steps:12};
  function visit(value,template,path){
    if(Array.isArray(template)){if(!Array.isArray(value)||value.length>(maxArrays[path.split('.').at(-1)]||30))failure('Некорректный список: '+path);return value.map((v,i)=>visit(v,template[0],path+'.'+i))}
    if(template&&typeof template==='object'){if(!value||typeof value!=='object'||Array.isArray(value))failure('Некорректный раздел: '+path);const result={};for(const key of Object.keys(template)){if(!(key in value)){result[key]=visit(template[key],template[key],path?path+'.'+key:key);continue}result[key]=visit(value[key],template[key],path?path+'.'+key:key)}return result}
    if(typeof value!==typeof template)failure('Некорректный тип: '+path);
    if(typeof value==='string'){
      if(value.length>12000)failure('Слишком длинный текст: '+path);
      if(/\.(image|thumbnail|cardImage|preview|video|portrait|cursor|telegram|caseUrl|url|background)$/.test(path)&&!allowedUrl(value))failure('Недопустимая ссылка: '+path);
      if(path==='meta.accent'&&!/^#[0-9a-f]{6}$/i.test(value))failure('Цвет должен иметь формат #RRGGBB');
    }
    if(typeof value==='number'){
      if(!Number.isFinite(value))failure('Некорректное число: '+path);
      if(path.startsWith('effects.')){const key=path.split('.').at(-1),range=key==='grainOpacity'?[0,.3]:key==='videoScale'?[30,100]:key==='videoDim'?[0,100]:[80,5000];if(value<range[0]||value>range[1])failure('Значение вне допустимого диапазона: '+path)}
    }
    return value;
  }
  const c=visit(input,DEFAULT_CONTENT,'');
  if(!c.meta.title.trim()||!c.hero.slides.length)failure('Укажите название сайта и хотя бы один слайд');
  if(!Number.isInteger(c.hero.initialSlide)||c.hero.initialSlide<0||c.hero.initialSlide>=c.hero.slides.length)failure('Выберите существующий начальный слайд');
  for(const slide of c.hero.slides)if(!slide.image||!slide.title.trim())failure('У каждого слайда должны быть название и изображение');
  for(const item of c.works.items)if(!item.title.trim()||!item.preview)failure('У каждой работы должны быть название и превью');
  return c;
}
function identity(request){const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');return id&&email?{id,email}:null}
function admin(request){const user=identity(request);if(!user)failure('Войдите через ChatGPT',401);if(user.email.toLowerCase()!==OWNER_EMAIL.toLowerCase())failure('Доступ разрешён только владельцу сайта',403);return user}
function sameOrigin(request){if(request.headers.get('Origin')!==new URL(request.url).origin)failure('Недопустимый источник запроса',403)}
function bucket(env){if(!env.BUCKET)failure('Хранилище контента не подключено',503);return env.BUCKET}
async function readRecord(store,key){const obj=await store.get(key);return obj?{object:obj,data:await obj.json()}:null}
async function published(env){const value=env.BUCKET?await readRecord(env.BUCKET,'cms/published.json'):null;return value?.data||{revision:null,createdAt:null,content:DEFAULT_CONTENT}}
async function snapshot(env){const store=bucket(env),live=await published(env),draft=await readRecord(store,'cms/draft.json');return{draft:draft?.data||{revision:null,createdAt:null,content:live.content},published:{revision:live.revision,createdAt:live.createdAt}}}
async function saveDraft(store,content,baseRevision,user){const previous=await readRecord(store,'cms/draft.json');if((previous?.data.revision||null)!==(baseRevision||null))failure('Черновик изменён в другой вкладке. Обновите страницу перед сохранением.',409);const draft={revision:crypto.randomUUID(),createdAt:new Date().toISOString(),actor:user.id,content:validateContent(content)};const result=await store.put('cms/draft.json',JSON.stringify(draft),{httpMetadata:{contentType:'application/json'},onlyIf:previous?{etagMatches:previous.object.etag}:{etagDoesNotMatch:'*'}});if(!result)failure('Черновик изменён параллельно. Обновите страницу.',409);return draft}
function safeJson(value){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')}
function pageHtml(content){return STATIC_ASSETS['index.html'].body.replace('<!-- cms-content -->','<script>window.SITE_CONTENT='+safeJson(content)+'</script>')}
function bytes(asset){if(asset.text)return new TextEncoder().encode(asset.body);return Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0))}
function dataResponse(data,type,request,etag,extra={}){
  const headers={'Content-Type':type,'X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Cache-Control':'public, max-age=3600',...extra};if(etag)headers.ETag='"'+etag+'"';
  if(etag&&request.headers.get('If-None-Match')===headers.ETag)return new Response(null,{status:304,headers});
  const range=request.headers.get('Range');let status=200;
  if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m)return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+data.length}});let start=m[1]?Number(m[1]):Math.max(0,data.length-Number(m[2])),end=m[1]?(m[2]?Number(m[2]):data.length-1):data.length-1;end=Math.min(end,data.length-1);if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=data.length)return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+data.length}});headers['Content-Range']=`bytes ${start}-${end}/${data.length}`;data=data.slice(start,end+1);status=206}
  headers['Content-Length']=String(data.length);return new Response(request.method==='HEAD'?null:data,{status,headers});
}
async function upload(request,store){
  const type=request.headers.get('Content-Type')?.split(';')[0];const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/avif':'avif','image/svg+xml':'svg','video/mp4':'mp4','audio/mpeg':'mp3'}[type];if(!ext)failure('Поддерживаются PNG, JPG, WEBP, GIF, AVIF, SVG, MP4 и MP3');
  const limit=25*1024*1024;if(Number(request.headers.get('Content-Length'))>limit)failure('Максимальный размер файла — 25 МБ',413);
  const data=new Uint8Array(await request.arrayBuffer());if(!data.length||data.length>limit)failure('Файл пустой или превышает 25 МБ',413);
  const head=new TextDecoder().decode(data.slice(0,200));const valid=ext==='png'?data[0]===137&&head.includes('PNG'):ext==='jpg'?data[0]===255&&data[1]===216:ext==='webp'?head.startsWith('RIFF')&&head.includes('WEBP'):ext==='gif'?head.startsWith('GIF8'):ext==='mp4'||ext==='avif'?head.includes('ftyp'):ext==='mp3'?head.startsWith('ID3')||data[0]===255:true;if(!valid)failure('Содержимое файла не соответствует формату');
  if(ext==='svg'){const source=new TextDecoder().decode(data);if(!/<svg[\s>]/i.test(source)||/<script|<foreignObject|on\w+\s*=|javascript:|<!ENTITY|<\?xml-stylesheet|(?:href|src)\s*=\s*["'](?!#)/i.test(source))failure('SVG содержит неподдерживаемые активные элементы')}
  const id=crypto.randomUUID(),key='media/'+id+'.'+ext;let name='Файл';try{name=decodeURIComponent(request.headers.get('X-File-Name')||'Файл').slice(0,200)}catch{}
  const item={id,name,url:'/'+key,type,size:data.length,createdAt:new Date().toISOString()};await store.put(key,data,{httpMetadata:{contentType:type},customMetadata:{name}});await store.put('cms/uploads/'+id+'.json',JSON.stringify(item));return item;
}
async function adminApi(request,env,path){
  const user=admin(request);if(!['GET','HEAD'].includes(request.method))sameOrigin(request);
  if(path==='/api/admin/session')return json({user:{email:user.email},storage:!!env.BUCKET});
  const store=bucket(env);
  if(path==='/api/admin/content'&&request.method==='GET')return json(await snapshot(env));
  if(path==='/api/admin/content'&&request.method==='PUT'){const input=await request.json();const draft=await saveDraft(store,input.content,input.baseRevision,user);return json({draft,published:(await snapshot(env)).published})}
  if(path==='/api/admin/publish'&&request.method==='POST'){
    const input=await request.json(),draft=await readRecord(store,'cms/draft.json');if(!draft||draft.data.revision!==input.revision)failure('Сохраните актуальный черновик перед публикацией',409);
    const previous=await readRecord(store,'cms/published.json'),live={...draft.data,revision:crypto.randomUUID(),createdAt:new Date().toISOString(),actor:user.id,content:validateContent(draft.data.content)};
    await store.put('cms/history/'+live.revision+'.json',JSON.stringify(live));
    const result=await store.put('cms/published.json',JSON.stringify(live),{onlyIf:previous?{etagMatches:previous.object.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});if(!result)failure('Публикация изменена в другой вкладке. Обновите страницу.',409);
    return json({revision:live.revision,createdAt:live.createdAt});
  }
  if(path==='/api/admin/history'&&request.method==='GET'){
    const list=await store.list({prefix:'cms/history/',limit:1000});const items=await Promise.all(list.objects.map(async obj=>{const record=await readRecord(store,obj.key);return record?{revision:record.data.revision,createdAt:record.data.createdAt}:null}));return json({items:items.filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,50)});
  }
  if(path==='/api/admin/restore'&&request.method==='POST'){const input=await request.json();if(!/^[\da-f-]{36}$/.test(input.revision||''))failure('Некорректная версия');const record=await readRecord(store,'cms/history/'+input.revision+'.json');if(!record)failure('Версия не найдена',404);const draft=await saveDraft(store,record.data.content,input.baseRevision,user);return json({draft,published:(await snapshot(env)).published})}
  if(path==='/api/admin/media'&&request.method==='POST')return json(await upload(request,store),201);
  if(path==='/api/admin/media'&&request.method==='GET'){const list=await store.list({prefix:'cms/uploads/',limit:1000});const items=await Promise.all(list.objects.map(async obj=>(await readRecord(store,obj.key))?.data));return json({items:items.filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))})}
  if(path.startsWith('/api/admin/media/')&&request.method==='DELETE'){const id=path.split('/').at(-1);if(!/^[\da-f-]{36}$/.test(id))failure('Некорректный файл');const record=await readRecord(store,'cms/uploads/'+id+'.json');if(!record)failure('Файл не найден',404);const state=await snapshot(env);if(JSON.stringify(state.draft.content).includes(record.data.url)||JSON.stringify((await published(env)).content).includes(record.data.url))failure('Файл используется в черновике или опубликованном сайте',409);await store.delete(record.data.url.slice(1));await store.delete('cms/uploads/'+id+'.json');return json({ok:true})}
  failure('Не найдено',404);
}
// ZIP with stored entries keeps the existing downloadable site export available.
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc32(data){let crc=0xffffffff;for(const value of data)crc=crcTable[(crc^value)&255]^(crc>>>8);return(crc^0xffffffff)>>>0}
function zipEntries(entries){const encoder=new TextEncoder(),chunks=[],central=[];let offset=0;for(const [path,data] of entries){const name=encoder.encode(path),crc=crc32(data),header=new Uint8Array(30+name.length),v=new DataView(header.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);header.set(name,30);chunks.push(header,data);const dir=new Uint8Array(46+name.length),d=new DataView(dir.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);dir.set(name,46);central.push(dir);offset+=header.length+data.length}const size=central.reduce((sum,c)=>sum+c.length,0),end=new Uint8Array(22),view=new DataView(end.buffer);view.setUint32(0,0x06054b50,true);view.setUint16(8,entries.length,true);view.setUint16(10,entries.length,true);view.setUint32(12,size,true);view.setUint32(16,offset,true);const result=new Uint8Array(offset+size+22);let pos=0;for(const chunk of [...chunks,...central,end]){result.set(chunk,pos);pos+=chunk.length}return result}
async function downloadZip(env){const live=await published(env),entries=[],encoder=new TextEncoder();for(const [path,asset] of Object.entries(STATIC_ASSETS)){if(path.startsWith('admin'))continue;entries.push([path,path==='index.html'?encoder.encode(pageHtml(live.content)):path==='content-defaults.js'?encoder.encode('window.SITE_DEFAULTS='+safeJson(live.content)+';'):bytes(asset)])}const urls=[...new Set(JSON.stringify(live.content).match(/\/media\/[\da-f-]+\.[a-z0-9]+/g)||[])];let total=entries.reduce((n,e)=>n+e[1].length,0);for(const url of urls){const obj=await bucket(env).get(url.slice(1));if(obj){if(total+obj.size>50*1024*1024)failure('Экспорт превышает 50 МБ. Экспортируйте контент JSON из админки.',413);const data=new Uint8Array(await obj.arrayBuffer());total+=data.length;entries.push([url.slice(1),data])}}return new Response(zipEntries(entries),{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="ANDREIKO-Agency.zip"','Cache-Control':'no-store'}})}
export default{async fetch(request,env){try{
  const url=new URL(request.url),path=url.pathname;
  if(path.startsWith('/api/admin/'))return await adminApi(request,env,path);
  if(path==='/api/content')return json((await published(env)).content);
  if(path==='/admin'||path==='/admin/'){
    if(!identity(request))return Response.redirect(url.origin+'/signin-with-chatgpt?return_to=%2Fadmin',302);admin(request);return new Response(STATIC_ASSETS['admin.html'].body,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'SAMEORIGIN'}});
  }
  if(path==='/preview'){admin(request);const state=await snapshot(env);return new Response(pageHtml(state.draft.content),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex','X-Frame-Options':'SAMEORIGIN'}})}
  if(path==='/ANDREIKO-Agency.zip')return await downloadZip(env);
  if(path==='/media/'||path.startsWith('/media/')){if(!/^\/media\/[\da-f-]{36}\.(png|jpg|webp|gif|avif|svg|mp4|mp3)$/.test(path))failure('Не найдено',404);const obj=await bucket(env).get(path.slice(1));if(!obj)failure('Файл не найден',404);return dataResponse(new Uint8Array(await obj.arrayBuffer()),obj.httpMetadata?.contentType||'application/octet-stream',request,obj.etag,{'Cache-Control':'public, max-age=31536000, immutable','Content-Security-Policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'"})}
  if(!['GET','HEAD'].includes(request.method))failure('Метод не поддерживается',405);
  if(path==='/'||path==='/index.html')return new Response(request.method==='HEAD'?null:pageHtml((await published(env)).content),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  const key=cleanPath(path);if(key==='admin.html')failure('Не найдено',404);const asset=STATIC_ASSETS[key];if(!asset)failure('Не найдено',404);return dataResponse(bytes(asset),asset.type,request,asset.etag,asset.text?{'Cache-Control':'no-cache'}:{});
}catch(error){return json({error:error.status?error.message:'Не удалось выполнить операцию. Повторите попытку.'},error.status||500)}}};
