(() => {
  const $=s=>document.querySelector(s),create=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el};
  const adminPath=location.pathname.startsWith('/cpanel')?'/cpanel':'/admin';
  const returnTo=encodeURIComponent(adminPath);
  let config=null,revision=null,published=null,dirty=false,busy=false,tab='home';
  const titles={home:'Главная',slides:'Слайдер',principles:'Принципы',process:'Процесс',faq:'FAQ',works:'Работы',contacts:'Контакты и меню',effects:'Анимации и оформление',media:'Медиафайлы',history:'История публикаций'};
  function notice(message,error=false){const node=$('#notice');node.hidden=!message;node.textContent=message;node.className=error?'error':''}
  const date=value=>value?new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(value)):'ещё не опубликован';
  function state(){ $('#save-state').textContent=busy?'Сохраняю…':dirty?'Есть несохранённые изменения':revision?'Черновик сохранён':'Контент загружен';$('#published-state').textContent='Последняя публикация: '+date(published?.createdAt);for(const id of ['save','publish','preview','import'])$('#'+id).disabled=busy||!config; }
  function changed(){dirty=true;notice('');state()}
  let cmsApi='auto';
  function apiUrl(path){
    if(cmsApi==='php')return '/api/admin/index.php?path='+encodeURIComponent(path);
    return '/api/admin/'+path;
  }
  async function api(path,options={}){
    const headers={...(options.body&&typeof options.body==='string'?{'Content-Type':'application/json'}:{}),...options.headers};
    const exec=async url=>{
      const response=await fetch(url,{credentials:'same-origin',...options,headers});
      const text=await response.text();
      return {response,text};
    };
    let {response,text}=await exec(apiUrl(path));
    // mchost nginx HTML 404 → retry through PHP front controller.
    if(cmsApi!=='php'&&text.trimStart().startsWith('<')){
      cmsApi='php';
      ({response,text}=await exec(apiUrl(path)));
    }else if(cmsApi==='auto')cmsApi='worker';
    let data=null;
    if(text){
      try{data=JSON.parse(text)}
      catch{
        throw new Error(response.ok
          ? 'Сервер вернул некорректный JSON'
          : 'API админки недоступно (HTTP '+response.status+'). На статическом хостинге нужен PHP CMS.');
      }
    }
    if(!response.ok)throw new Error((data&&data.error)||('Не удалось выполнить запрос (HTTP '+response.status+')'));
    return data||{};
  }
  function apply(data){config=structuredClone(data.draft.content);revision=data.draft.revision;published=data.published;dirty=false;state()}
  async function save(){if(busy)return false;busy=true;state();try{const data=await api('content',{method:'PUT',body:JSON.stringify({content:config,baseRevision:revision})});apply(data);notice('Черновик сохранён. Посетители увидят изменения после публикации.');return true}catch(error){notice(error.message,true);return false}finally{busy=false;state()}}
  async function publish(){if(dirty||!revision){if(!await save())return}busy=true;state();try{published=await api('publish',{method:'POST',body:JSON.stringify({revision})});notice('Изменения опубликованы. Обновите сайт, чтобы увидеть новую версию.')}catch(error){notice(error.message,true)}finally{busy=false;state()}}
  const read=path=>path.split('.').reduce((obj,key)=>obj[key],config);
  const write=(path,value)=>{const parts=path.split('.');const key=parts.pop();parts.reduce((obj,k)=>obj[k],config)[key]=value;changed()};
  function section(title){const panel=create('section','section'),heading=create('h2','',title),fields=create('div','fields');panel.append(heading,fields);$('#content').append(panel);return{panel,fields,heading}}
  function field(target,path,label,type='text',hint=''){
    const wrap=create('label','field'+(['textarea','media','video'].includes(type)?' wide':'')+(type==='checkbox'?' checkbox':''));wrap.append(create('span','',label));const value=read(path);let input;
    if(type==='textarea'){input=create('textarea');input.rows=4;input.value=value}
    else{input=create('input');input.type=type==='checkbox'?'checkbox':type==='number'?'number':type==='color'?'color':'text';if(type==='checkbox')input.checked=value;else input.value=value;if(type==='number')input.step=path.endsWith('grainOpacity')?'0.001':'1'}
    input.dataset.path=path;const update=()=>write(path,type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value);input.addEventListener(type==='checkbox'?'change':'input',update);
    if(type==='media'||type==='video'){
      const row=create('div','media-input'),button=create('button','secondary','Загрузить'),picker=create('input');button.type='button';picker.type='file';picker.hidden=true;picker.accept=type==='video'?'video/mp4':'image/*';button.onclick=event=>{event.preventDefault();picker.click()};picker.onchange=async()=>{const file=picker.files[0];if(!file)return;button.disabled=true;button.textContent='Загружаю…';try{const item=await upload(file);input.value=item.url;write(path,item.url);preview.src=item.url;preview.hidden=false;notice('Файл загружен. Сохраните черновик, чтобы закрепить его в контенте.')}catch(error){notice(error.message,true)}finally{button.disabled=false;button.textContent='Загрузить'}};row.append(input,button,picker);wrap.append(row);const preview=create(type==='video'?'video':'img','media-preview');preview.src=value;preview.hidden=!value;if(type==='video'){preview.controls=true;preview.preload='metadata';preview.muted=true}else preview.alt=label;input.addEventListener('change',()=>{preview.src=input.value;preview.hidden=!input.value});wrap.append(preview)
    }else wrap.append(input);
    if(hint)wrap.append(create('small','hint',hint));target.append(wrap);return input;
  }
  function fields(target,list){for(const [path,label,type,hint] of list)field(target,path,label,type,hint)}
  function intro(copy){$('#content').append(create('p','intro-copy',copy))}
  function listItem(title,index,items,{remove=true,slide=false}={}){
    const {panel,fields:body,heading}=section(title),head=create('div','item-head'),controls=create('div','item-controls');heading.remove();head.append(heading,controls);panel.prepend(head);
    function move(direction){const to=index+direction;if(to<0||to>=items.length)return;const active=slide?config.hero.slides[config.hero.initialSlide]?.id:null;[items[index],items[to]]=[items[to],items[index]];if(slide)config.hero.initialSlide=items.findIndex(item=>item.id===active);changed();render()}
    for(const [text,direction] of [['↑',-1],['↓',1]]){const b=create('button','small-button',text);b.type='button';b.setAttribute('aria-label',direction<0?'Переместить выше':'Переместить ниже');b.disabled=index+direction<0||index+direction>=items.length;b.onclick=()=>move(direction);controls.append(b)}
    if(remove){const b=create('button','small-button danger','Удалить');b.type='button';b.onclick=()=>{if(slide&&items.length===1){notice('В слайдере должен остаться хотя бы один слайд.',true);return}if(!confirm('Удалить «'+title+'» из черновика?'))return;const active=slide?config.hero.slides[config.hero.initialSlide]?.id:null;items.splice(index,1);if(slide)config.hero.initialSlide=Math.max(0,items.findIndex(item=>item.id===active));changed();render()};controls.append(b)}return body;
  }
  function addButton(label,action){const row=create('div','list-actions'),button=create('button','secondary',label);button.onclick=action;row.append(button);$('#content').append(row)}
  function home(){intro('Основные тексты первого экрана. Настройки меню и социальных ссылок находятся в разделе «Контакты и меню».');let s=section('Название и описание');fields(s.fields,[['hero.brand','Первая часть названия'],['hero.agency','Вторая часть названия'],['hero.intro','Вводный текст','textarea'],['hero.footerLocation','Подпись внизу'],['hero.footerSince','Год / дополнительная подпись']]);s=section('Услуги');config.hero.services.forEach((item,i)=>{const f=create('div','field wide');f.append(create('h3','',item.title||'Услуга'));const grid=create('div','fields');fields(grid,[[`hero.services.${i}.title`,'Название'],[`hero.services.${i}.body`,'Текст при нажатии','textarea']]);f.append(grid);s.fields.append(f)})}
  function slides(){intro('Управляйте изображениями, миниатюрами и порядком слайдов. Изменения появятся на сайте после публикации.');config.hero.slides.forEach((item,i)=>{const target=listItem(item.title||'Слайд '+(i+1),i,config.hero.slides,{slide:true});const label=create('label','field checkbox'),radio=create('input');radio.type='radio';radio.name='initial-slide';radio.checked=config.hero.initialSlide===i;radio.onchange=()=>{config.hero.initialSlide=i;changed()};label.append(radio,create('span','','Показывать первым'));target.append(label);fields(target,[[`hero.slides.${i}.title`,'Название слайда'],[`hero.slides.${i}.image`,'Основное изображение','media'],[`hero.slides.${i}.thumbnail`,'Миниатюра','media'],[`hero.slides.${i}.thumbnailAlt`,'Описание миниатюры'],[`hero.slides.${i}.thumbnailCrop`,'Обрезка миниатюры как в исходном макете','checkbox'],[`hero.slides.${i}.cardImage`,'Изображение дополнительного превью справа','media'],[`hero.slides.${i}.cardCrop`,'Обрезка правого превью как в исходном макете','checkbox']])});addButton('+ Добавить слайд',()=>{if(config.hero.slides.length>=20){notice('Максимум 20 слайдов.',true);return}config.hero.slides.push({...structuredClone(config.hero.slides.at(-1)),id:crypto.randomUUID(),title:'Новый слайд',thumbnailCrop:false,cardCrop:false});changed();render()})}
  function principles(){intro('Тексты второго экрана. Три части основного текста позволяют сохранить выделение оранжевым.');let s=section('Основной блок');fields(s.fields,[['visibility.principles','Показывать раздел на сайте','checkbox'],['principles.label','Подпись раздела'],['principles.before','Текст до акцента','textarea'],['principles.highlight','Оранжевый фрагмент','textarea'],['principles.after','Текст после акцента','textarea'],['principles.description','Нижний абзац','textarea']]);s=section('Основатель');fields(s.fields,[['principles.portrait','Портрет','media'],['principles.name','Имя'],['principles.role','Должность'],['principles.quote','Цитата','textarea']]);config.principles.directions.forEach((item,i)=>{const p=section('Направление: '+item.label);fields(p.fields,[[`principles.directions.${i}.label`,'Подпись кнопки'],[`principles.directions.${i}.title`,'Заголовок окна'],[`principles.directions.${i}.body`,'Текст окна','textarea']])})}
  function process(){
    if(!config.process)config.process={label:'',titleAccent:'',title:'',term:'',cost:'',background:'assets/process/bg.jpg',steps:[]};
    if(!Array.isArray(config.process.steps))config.process.steps=[];
    intro('Блок «Как мы работаем»: заголовки, summary и карточки этапов. Оранжевый акцент на сайте появляется только при наведении или тапе.');
    let s=section('Раздел');
    fields(s.fields,[['visibility.process','Показывать раздел на сайте','checkbox'],['process.label','Подпись раздела'],['process.titleAccent','Оранжевая строка заголовка'],['process.title','Вторая строка заголовка'],['process.term','Средний срок (нижняя полоса)'],['process.cost','Средняя стоимость (нижняя полоса)'],['process.background','Фон раздела','media']]);
    config.process.steps.forEach((item,i)=>{
      const target=listItem((item.index||'')+' '+(item.title||('Шаг '+(i+1))),i,config.process.steps);
      fields(target,[[`process.steps.${i}.index`,'Номер, например [01]'],[`process.steps.${i}.title`,'Заголовок карточки'],[`process.steps.${i}.body`,'Текст','textarea'],[`process.steps.${i}.days`,'Срок на бейдже']]);
    });
    addButton('+ Добавить этап',()=>{
      if(config.process.steps.length>=12){notice('Максимум 12 этапов.',true);return}
      const n=String(config.process.steps.length+1).padStart(2,'0');
      const example=config.process.steps[0];
      config.process.steps.push(example?{...structuredClone(example),index:'['+n+']',title:'новый этап',body:'',days:''}:{index:'['+n+']',title:'новый этап',body:'',days:''});
      changed();render();
    });
  }
  function faq(){
    if(!config.faq)config.faq={title:'FAQ',items:[]};
    if(!Array.isArray(config.faq.items))config.faq.items=[];
    intro('Блок FAQ после «Процесс»: заголовок и аккордеон вопросов. На сайте одновременно открыт один пункт.');
    let s=section('Раздел');
    fields(s.fields,[['visibility.faq','Показывать раздел на сайте','checkbox'],['faq.title','Заголовок блока']]);
    config.faq.items.forEach((item,i)=>{
      const target=listItem(item.question||('Вопрос '+(i+1)),i,config.faq.items);
      fields(target,[[`faq.items.${i}.question`,'Вопрос'],[`faq.items.${i}.answer`,'Ответ','textarea']]);
    });
    addButton('+ Добавить вопрос',()=>{
      if(config.faq.items.length>=30){notice('Максимум 30 вопросов.',true);return}
      config.faq.items.push({question:'Новый вопрос',answer:''});
      changed();render();
    });
  }
  function works(){intro('Добавляйте работы, меняйте порядок, превью и видео. Выключенная работа остаётся в админке, но скрыта на сайте.');let s=section('Настройки раздела');fields(s.fields,[['visibility.works','Показывать раздел','checkbox'],['works.allLabel','Подпись «Все кейсы»'],['works.caseLabel','Подпись кнопки кейса']]);config.works.items.forEach((item,i)=>{const target=listItem(item.title||'Работа '+(i+1),i,config.works.items);fields(target,[[`works.items.${i}.visible`,'Показывать работу','checkbox'],[`works.items.${i}.title`,'Название'],[`works.items.${i}.client`,'Подпись клиента'],[`works.items.${i}.category`,'Категория'],[`works.items.${i}.number`,'Номер'],[`works.items.${i}.description`,'Описание','textarea'],[`works.items.${i}.duration`,'Срок проекта'],[`works.items.${i}.preview`,'Превью','media'],[`works.items.${i}.previewAlt`,'Описание изображения'],[`works.items.${i}.video`,'Видео','video'],[`works.items.${i}.caseUrl`,'Ссылка на полный кейс','text','Оставьте пустой, чтобы открывалось встроенное окно с видео.']])});addButton('+ Добавить работу',()=>{if(config.works.items.length>=30){notice('Максимум 30 работ.',true);return}const example=config.works.items[0]||window.SITE_DEFAULTS?.works.items[0];config.works.items.push(example?{...structuredClone(example),id:crypto.randomUUID(),title:'Новая работа',visible:false}:{id:crypto.randomUUID(),title:'Новая работа',client:'',category:'web',number:'',description:'',duration:'',preview:'assets/works/render-courses.jpg',previewAlt:'',video:'assets/works/demo.mp4',caseUrl:'',visible:false});changed();render()})}
  function contacts(){let s=section('Контакты');fields(s.fields,[['contacts.telegram','Telegram — полная ссылка'],['contacts.email','Email'],['contacts.buttonLabel','Подпись кнопки связи'],['hero.worksLabel','Пункт меню «Работы»']]);config.hero.navigation.forEach((item,i)=>{const panel=section('Меню: '+item.label);fields(panel.fields,[[`hero.navigation.${i}.label`,'Подпись пункта'],[`hero.navigation.${i}.title`,'Заголовок окна'],[`hero.navigation.${i}.body`,'Текст окна','textarea']])});config.hero.socials.forEach((item,i)=>{const target=listItem(item.label||'Социальная ссылка',i,config.hero.socials);fields(target,[[`hero.socials.${i}.label`,'Подпись'],[`hero.socials.${i}.url`,'Ссылка','text','Поддерживаются https://, mailto: и tel:.']])});addButton('+ Добавить ссылку',()=>{config.hero.socials.push({label:'Новая ссылка',url:''});changed();render()})}
  function effects(){intro('Длительности указаны в миллисекундах. Настройки применяются вместе с публикацией контента.');let s=section('Оформление и метаданные');fields(s.fields,[['meta.title','Название вкладки'],['meta.description','Описание для поисковиков','textarea'],['meta.accent','Акцентный цвет','color'],['effects.grainOpacity','Интенсивность шума, от 0 до 0,3','number'],['effects.cursor','Курсор SVG','media']]);s=section('Главный экран');fields(s.fields,[['effects.heroSlideMs','Сборка первого слайда, мс','number'],['effects.heroTextMs','Появление текстового блока, мс','number'],['effects.heroPreviewMs','Сборка миниатюр, мс','number'],['effects.slideMs','Переход между слайдами, мс','number']]);s=section('Второй экран');fields(s.fields,[['effects.principlesMainMs','Построчное появление основного текста, мс','number'],['effects.principlesDescriptionMs','Нижний абзац, мс','number'],['effects.principlesOtherMs','Остальные элементы, мс','number']]);s=section('Работы и видео');fields(s.fields,[['effects.workTextMs','Расшифровка текста, мс','number'],['effects.videoTransitionMs','Пиксельный переход видео, мс','number'],['effects.videoScale','Размер видео, от 30 до 100%','number'],['effects.videoDim','Затемнение превью, от 0 до 100%','number']])}
  async function upload(file){return api('media',{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream','X-File-Name':encodeURIComponent(file.name)},body:file})}
  async function media(){intro('Загруженные файлы хранятся на сервере. Для использования вставьте ссылку в нужный слайд, работу или текстовый блок. Максимальный размер — 25 МБ.');const button=create('button','secondary','+ Загрузить файлы'),picker=create('input');picker.type='file';picker.multiple=true;picker.accept='image/*,video/mp4,audio/mpeg';picker.hidden=true;button.onclick=()=>picker.click();picker.onchange=async()=>{button.disabled=true;try{for(const file of picker.files)await upload(file);notice('Файлы загружены.');await render()}catch(error){notice(error.message,true)}finally{button.disabled=false}};$('#content').append(button,picker);const data=await api('media');if(tab!=='media')return;if(!data.items.length){$('#content').append(create('p','empty','Здесь появятся загруженные вами файлы. Исходные изображения сайта уже доступны в полях контента.'));return}const grid=create('div','media-grid');grid.style.marginTop='24px';for(const item of data.items){const card=create('article','media-card');if(item.type.startsWith('image/')){const img=create('img');img.src=item.url;img.alt=item.name;img.loading='lazy';card.append(img)}else card.append(create('div','media-placeholder',item.type.startsWith('video/')?'Видео':'Аудио'));const body=create('div','media-card-content');body.append(create('strong','',item.name),create('small','',(item.size/1024/1024).toFixed(2)+' МБ'));const actions=create('div'),copy=create('button','small-button','Ссылка'),remove=create('button','small-button danger','Удалить');copy.onclick=async()=>{try{await navigator.clipboard.writeText(new URL(item.url,location.origin).href);notice('Ссылка скопирована.')}catch{prompt('Ссылка на файл',new URL(item.url,location.origin).href)}};remove.onclick=async()=>{if(!confirm('Удалить файл «'+item.name+'»?'))return;try{await api('media/'+item.id,{method:'DELETE'});await render()}catch(error){notice(error.message,true)}};actions.append(copy,remove);body.append(actions);card.append(body);grid.append(card)}$('#content').append(grid)}
  async function history(){intro('Восстановление переносит выбранную версию в черновик. Чтобы показать её посетителям, нажмите «Опубликовать».');const data=await api('history');if(tab!=='history')return;const s=section('Опубликованные версии');if(!data.items.length){s.panel.append(create('p','muted','Публикаций через админку пока нет.'));return}for(const item of data.items){const row=create('div','history-row'),description=create('div');description.append(create('strong','',date(item.createdAt)),create('small','',item.revision===published?.revision?'Текущая публикация':'Сохранённая версия'));const button=create('button','secondary','Восстановить в черновик');button.onclick=async()=>{if(!confirm('Восстановить эту версию в черновик? Несохранённые изменения будут заменены.'))return;try{apply(await api('restore',{method:'POST',body:JSON.stringify({revision:item.revision,baseRevision:revision})}));notice('Версия восстановлена в черновик. Проверьте её в предпросмотре.');await render()}catch(error){notice(error.message,true)}};row.append(description,button);s.panel.append(row)}}
  async function render(){if(!config)return;$('#page-title').textContent=titles[tab];document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.tab===tab));$('#content').replaceChildren();try{await({home,slides,principles,process,faq,works,contacts,effects,media,history}[tab])()}catch(error){notice(error.message,true)}}
  document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{tab=button.dataset.tab;render()});$('#save').onclick=save;$('#publish').onclick=publish;
  let authMode='chatgpt';
  const signout=$('#signout-link');
  if(signout){
    signout.href='/signout-with-chatgpt?return_to='+returnTo;
    signout.addEventListener('click',async event=>{
      if(authMode!=='password')return;
      event.preventDefault();
      try{await api('logout',{method:'POST',body:'{}'})}catch{}
      location.reload();
    });
  }
  function showLogin(message){
    notice(message||'Войдите, чтобы редактировать сайт.',true);
    $('#content').replaceChildren();
    const form=create('form','login-form');
    form.append(create('p','intro-copy','На этом хостинге вход по паролю владельца. ChatGPT OAuth работает только на Cloudflare Worker.'));
    const label=create('label','field');label.append(create('span','','Пароль админки'));
    const input=create('input');input.type='password';input.name='password';input.autocomplete='current-password';input.required=true;label.append(input);
    const button=create('button','primary','Войти');button.type='submit';
    form.append(label,button);
    form.onsubmit=async event=>{
      event.preventDefault();
      busy=true;state();
      try{
        const session=await api('login',{method:'POST',body:JSON.stringify({password:input.value})});
        authMode='password';
        $('#account').textContent=session.user.email;
        if(signout)signout.textContent='Выйти';
        apply(await api('content'));
        notice('');
        await render();
      }catch(error){notice(error.message,true)}
      finally{busy=false;state()}
    };
    const chatgpt=create('a','notice-link','Войти через ChatGPT');chatgpt.href='/signin-with-chatgpt?return_to='+returnTo;chatgpt.target='_top';
    $('#content').append(form,create('p','muted','или'),chatgpt);
    state();
  }
  function previewSrc(){return (cmsApi==='php'?'/api/admin/preview.php':'/preview')+'?t='+Date.now()}
  $('#preview').onclick=async()=>{if(dirty||!revision){if(!await save())return}const dialog=$('#preview-dialog');dialog.querySelector('iframe').src=previewSrc();dialog.showModal()};$('#close-preview').onclick=()=>$('#preview-dialog').close();$('#preview-dialog').addEventListener('close',()=>$('#preview-dialog iframe').src='about:blank');
  $('#export').onclick=()=>{if(!config)return;const url=URL.createObjectURL(new Blob([JSON.stringify(config,null,2)],{type:'application/json'})),link=create('a');link.href=url;link.download='andreiko-content.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  $('#import').onclick=()=>$('#import-file').click();$('#import-file').onchange=async()=>{const file=$('#import-file').files[0];if(!file)return;if(dirty&&!confirm('Импорт заменит несохранённый черновик. Продолжить?'))return;busy=true;state();try{const content=JSON.parse(await file.text());apply(await api('content',{method:'PUT',body:JSON.stringify({content:content.content||content,baseRevision:revision})}));await render();notice('Контент импортирован в черновик. Проверьте его перед публикацией.')}catch(error){notice(error.message,true)}finally{busy=false;state();$('#import-file').value=''}};
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}});document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save()}});
  (async()=>{
    try{
      const session=await api('session');
      authMode=session.auth==='password'?'password':'chatgpt';
      $('#account').textContent=session.user.email;
      if(authMode==='password'&&signout)signout.textContent='Выйти';
      apply(await api('content'));
      await render();
    }catch(error){
      showLogin(error.message);
    }
  })();
})();
