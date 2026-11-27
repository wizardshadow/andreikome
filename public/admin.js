(() => {
  const $=s=>document.querySelector(s),create=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el};
  const adminPath=location.pathname.startsWith('/cpanel')?'/cpanel':'/admin';
  const returnTo=encodeURIComponent(adminPath);
  let config=null,revision=null,published=null,dirty=false,busy=false,tab='home';
  const titles={home:'Главная',slides:'Слайдер',principles:'Принципы',process:'Процесс',about:'Обо мне',faq:'FAQ',works:'Работы',contacts:'Контакты',navigation:'Меню',effects:'Анимации и оформление',media:'Медиафайлы',history:'История публикаций'};
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
  function apply(data){config=window.normalizeSiteContent(structuredClone(data.draft.content));revision=data.draft.revision;published=data.published;dirty=false;state()}
  async function save(){if(busy)return false;busy=true;state();try{const data=await api('content',{method:'PUT',body:JSON.stringify({content:config,baseRevision:revision})});apply(data);notice('Черновик сохранён. Посетители увидят изменения после публикации.');return true}catch(error){notice(error.message,true);return false}finally{busy=false;state()}}
  async function publish(){if(dirty||!revision){if(!await save())return}busy=true;state();try{published=await api('publish',{method:'POST',body:JSON.stringify({revision})});notice('Изменения опубликованы. Обновите сайт, чтобы увидеть новую версию.')}catch(error){notice(error.message,true)}finally{busy=false;state()}}
  const read=path=>path.split('.').reduce((obj,key)=>obj[key],config);
  const write=(path,value)=>{const parts=path.split('.');const key=parts.pop();parts.reduce((obj,k)=>obj[k],config)[key]=value;changed()};
  function section(title){const panel=create('section','section'),heading=create('h2','',title),fields=create('div','fields');panel.append(heading,fields);$('#content').append(panel);return{panel,fields,heading}}
  const mediaUrl=value=>value?.startsWith('assets/')?'/'+value:value||'';
  function field(target,path,label,type='text',hint=''){
    const wrap=create('label','field'+(type==='checkbox'?' checkbox':''));wrap.append(create('span','',label));const value=read(path);let input;
    if(type==='section'){
      input=create('select');
      input.append(new Option('Выберите блок',''));
      for(const [id,title] of Object.entries(window.heroNavigationSections))input.append(new Option(title,id));
      input.value=window.heroNavigationTarget({title:value,label:read(path.replace(/title$/,'label'))});
    }
    else if(type==='textarea'){input=create('textarea');input.rows=3;input.value=value}
    else{input=create('input');input.type=type==='checkbox'?'checkbox':type==='number'?'number':type==='color'?'color':'text';if(type==='checkbox')input.checked=value;else input.value=value;if(type==='number')input.step=path.endsWith('grainOpacity')?'0.001':'1'}
    input.dataset.path=path;const update=()=>write(path,type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value);input.addEventListener(type==='checkbox'||type==='section'?'change':'input',update);
    if(type==='media'||type==='video'){
      const row=create('div','media-input'),button=create('button','secondary','Загрузить'),picker=create('input');button.type='button';picker.type='file';picker.hidden=true;picker.accept=type==='video'?'video/mp4':'image/*';button.onclick=event=>{event.preventDefault();picker.click()};picker.onchange=async()=>{const file=picker.files[0];if(!file)return;button.disabled=true;button.textContent='Загружаю…';try{const item=await upload(file);input.value=item.url;write(path,item.url);preview.src=item.url;preview.hidden=false;notice('Файл загружен. Сохраните черновик, чтобы закрепить его в контенте.')}catch(error){notice(error.message,true)}finally{button.disabled=false;button.textContent='Загрузить'}};row.append(input,button,picker);wrap.append(row);const preview=create(type==='video'?'video':'img','media-preview');preview.src=mediaUrl(value);preview.hidden=!value;if(type==='video'){preview.controls=true;preview.preload='metadata';preview.muted=true}else preview.alt=label;input.addEventListener('change',()=>{preview.src=mediaUrl(input.value);preview.hidden=!input.value});wrap.append(preview)
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
  function home(){
    const s=section('Название и описание');
    fields(s.fields,[['hero.brand','Первая часть названия'],['hero.agency','Вторая часть названия'],['hero.intro','Вводный текст','textarea'],['hero.footerLocation','Подпись внизу'],['hero.footerSince','Год / дополнительная подпись']]);
    const services=section('Услуги');
    config.hero.services.forEach((item,i)=>{
      field(services.fields,`hero.services.${i}.title`,'Услуга '+(i+1));
    });
  }
  async function capturePoster(file){
    const url=URL.createObjectURL(file);
    const video=create('video');
    video.muted=true;
    video.playsInline=true;
    video.preload='auto';
    try{
      await new Promise((resolve,reject)=>{
        const failed=()=>reject(new Error('Не удалось прочитать первый кадр. Проверьте, что MP4 воспроизводится в браузере.'));
        const timeout=setTimeout(failed,12000);
        video.onloadeddata=()=>{clearTimeout(timeout);resolve()};
        video.onerror=()=>{clearTimeout(timeout);failed()};
        video.src=url;
      });
      const canvas=create('canvas');
      const scale=Math.min(1,1920/Math.max(video.videoWidth,video.videoHeight));
      canvas.width=Math.round(video.videoWidth*scale);
      canvas.height=Math.round(video.videoHeight*scale);
      canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));
      if(!blob)throw new Error('Не удалось создать превью.');
      return new File([blob],file.name.replace(/\.mp4$/i,'')+'-poster.jpg',{type:'image/jpeg'});
    }finally{
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    }
  }
  function slideUpload(target,item){
    const group=create('div','slide-media');
    const preview=create('img','media-preview');
    const source=create('a','slide-source');
    source.target='_blank';source.rel='noopener';
    function showMedia(){
      const {poster}=window.heroSlideMedia(item);
      preview.src=mediaUrl(poster||'');
      preview.alt=item.title;
      preview.hidden=!poster;
      source.hidden=!item.image;
      if(item.image){
        source.href=mediaUrl(item.image);
        source.textContent=item.image.split('/').at(-1);
      }
    }
    const controls=create('div','slide-upload-controls');
    const button=create('button','secondary','Загрузить слайд');
    const picker=create('input');
    button.type='button';
    picker.type='file';
    picker.accept='image/jpeg,image/png,image/gif,image/webp,image/avif,image/svg+xml,video/mp4';
    picker.hidden=true;
    button.onclick=()=>picker.click();
    picker.onchange=async()=>{
      const file=picker.files[0];
      picker.value='';
      if(!file||busy)return;
      busy=true;state();
      button.disabled=true;
      button.textContent='Загружаю…';
      const uploaded=[];
      try{
        if(file.size>25*1024*1024)throw new Error('Максимальный размер файла — 25 МБ.');
        const isVideo=file.type==='video/mp4';
        const poster=isVideo?await capturePoster(file):null;
        const media=await upload(file);
        uploaded.push(media);
        if(poster)uploaded.push(await upload(poster));
        if(!config.hero.slides.includes(item))throw new Error('Слайд был удалён во время загрузки.');
        const previewUrl=uploaded.at(-1).url;
        Object.assign(item,{image:media.url,thumbnail:previewUrl,cardImage:previewUrl,thumbnailAlt:'',thumbnailCrop:false,cardCrop:false});
        if(tab==='slides'&&!target.isConnected)await render();
        else showMedia();
        changed();
        notice('Слайд загружен. Сохраните черновик и опубликуйте изменения.');
      }catch(error){
        await Promise.allSettled(uploaded.map(media=>api('media/'+media.id,{method:'DELETE'})));
        notice(error.message,true);
      }
      finally{busy=false;state();button.disabled=false;button.textContent='Загрузить слайд'}
    };
    controls.append(button,picker,source);
    group.append(preview,controls);
    showMedia();
    target.append(group);
  }
  function slides(){
    intro('Загрузите изображение или MP4. Превью видео создаётся из первого кадра.');
    config.hero.slides.forEach((item,i)=>{
      const target=listItem(item.title||'Слайд '+(i+1),i,config.hero.slides,{slide:true});
      target.classList.add('slide-fields');
      const details=create('div','slide-details');
      const label=create('label','slide-initial');
      const radio=create('input');
      radio.type='radio';
      radio.name='initial-slide';
      radio.checked=config.hero.initialSlide===i;
      radio.onchange=()=>{config.hero.initialSlide=i;changed()};
      label.append(radio,create('span','','Показывать первым'));
      field(details,`hero.slides.${i}.title`,'Название слайда');
      field(details,`hero.slides.${i}.caseUrl`,'Ссылка на проект','text','Открывается в новой вкладке.');
      details.append(label);
      target.append(details);
      slideUpload(target,item);
    });
    addButton('+ Добавить слайд',()=>{
      if(config.hero.slides.length>=20){notice('Максимум 20 слайдов.',true);return}
      config.hero.slides.push({id:crypto.randomUUID(),title:'Новый слайд',image:'',thumbnail:'',thumbnailAlt:'',thumbnailCrop:false,cardImage:'',cardCrop:false,caseUrl:''});
      changed();render();
    });
  }
  function principles(){intro('Тексты второго экрана. Три части основного текста позволяют сохранить выделение оранжевым.');let s=section('Основной блок');fields(s.fields,[['visibility.principles','Показывать раздел на сайте','checkbox'],['principles.label','Подпись раздела'],['principles.before','Текст до акцента','textarea'],['principles.highlight','Оранжевый фрагмент','textarea'],['principles.after','Текст после акцента','textarea'],['principles.description','Нижний абзац','textarea']]);s=section('Основатель');fields(s.fields,[['principles.name','Имя'],['principles.role','Должность'],['principles.portrait','Портрет','media'],['principles.quote','Цитата','textarea']]);config.principles.directions.forEach((item,i)=>{const p=section('Направление: '+item.label);fields(p.fields,[[`principles.directions.${i}.label`,'Подпись кнопки'],[`principles.directions.${i}.title`,'Заголовок окна'],[`principles.directions.${i}.body`,'Текст окна','textarea']])})}
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
  function about(){
    intro('Портретный блок между Процессом и FAQ. Все тексты и фото можно менять; перенос строки в имени сохранится на сайте.');
    let s=section('Отображение и фото');
    fields(s.fields,[['about.image','Фотография','media'],['about.imageAlt','Описание фотографии'],['visibility.about','Показывать блок','checkbox'],['about.accent','Цвет акцентного заголовка','color']]);
    s=section('Основатель');fields(s.fields,[['about.name','Имя и фамилия','textarea'],['about.role','Должность']]);
    s=section('Тезисы');fields(s.fields,[['about.priority','Слева сверху','textarea'],['about.ambition','Справа сверху','textarea'],['about.tools','Справа в центре','textarea'],['about.audience','Слева в центре','textarea']]);
    s=section('Итог');fields(s.fields,[['about.headline','Акцентный заголовок','textarea'],['about.description','Описание','textarea']]);
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
  function works(){intro('Добавляйте работы, меняйте порядок, превью и видео. Выключенная работа остаётся в админке, но скрыта на сайте.');let s=section('Настройки раздела');fields(s.fields,[['visibility.works','Показывать раздел','checkbox'],['works.allLabel','Подпись «Все кейсы»'],['works.caseLabel','Подпись кнопки кейса']]);config.works.items.forEach((item,i)=>{const target=listItem(item.title||'Работа '+(i+1),i,config.works.items);fields(target,[[`works.items.${i}.visible`,'Показывать работу','checkbox'],[`works.items.${i}.title`,'Название'],[`works.items.${i}.client`,'Подпись клиента'],[`works.items.${i}.category`,'Категория'],[`works.items.${i}.number`,'Номер'],[`works.items.${i}.duration`,'Срок проекта'],[`works.items.${i}.description`,'Описание','textarea'],[`works.items.${i}.caseUrl`,'Ссылка на полный кейс','text','Оставьте пустой, чтобы открывалось встроенное окно с видео.'],[`works.items.${i}.preview`,'Превью','media'],[`works.items.${i}.video`,'Видео','video'],[`works.items.${i}.previewAlt`,'Описание изображения']])});addButton('+ Добавить работу',()=>{if(config.works.items.length>=30){notice('Максимум 30 работ.',true);return}const example=config.works.items[0]||window.SITE_DEFAULTS?.works.items[0];config.works.items.push(example?{...structuredClone(example),id:crypto.randomUUID(),title:'Новая работа',visible:false}:{id:crypto.randomUUID(),title:'Новая работа',client:'',category:'web',number:'',description:'',duration:'',preview:'assets/works/render-courses.jpg',previewAlt:'',video:'assets/works/demo.mp4',caseUrl:'',visible:false});changed();render()})}
  function navigation(){
    const s=section('Навигация');
    field(s.fields,'hero.worksLabel','Пункт меню «Работы»');
    config.hero.navigation.forEach((item,i)=>{
      const target=section(item.label||'Пункт меню');
      fields(target.fields,[[`hero.navigation.${i}.label`,'Подпись пункта'],[`hero.navigation.${i}.title`,'Раздел страницы','section']]);
    });
  }
  function contacts(){
    const s=section('Контакты');
    fields(s.fields,[['contacts.telegram','Telegram — полная ссылка'],['contacts.email','Email'],['contacts.buttonLabel','Подпись кнопки связи']]);
    intro('Социальные ссылки отображаются в первом экране, закреплённом меню и подвале.');
    config.hero.socials.forEach((item,i)=>{
      const target=listItem(item.label||'Социальная ссылка',i,config.hero.socials);
      fields(target,[[`hero.socials.${i}.label`,'Подпись'],[`hero.socials.${i}.url`,'Ссылка','text','Поддерживаются https://, mailto: и tel:.']]);
    });
    addButton('+ Добавить ссылку',()=>{
      if(config.hero.socials.length>=12){notice('Максимум 12 ссылок.',true);return}
      config.hero.socials.push({label:'Новая ссылка',url:''});
      changed();render();
    });
  }
  function effects(){intro('Длительности указаны в миллисекундах. Настройки применяются вместе с публикацией контента.');let s=section('Оформление и метаданные');fields(s.fields,[['meta.accent','Акцентный цвет','color'],['effects.grainOpacity','Интенсивность шума, от 0 до 0,3','number'],['meta.title','Название вкладки'],['meta.description','Описание для поисковиков','textarea'],['effects.cursor','Курсор SVG','media']]);s=section('Главный экран');fields(s.fields,[['effects.heroSlideMs','Сборка первого слайда, мс','number'],['effects.heroTextMs','Появление текстового блока, мс','number'],['effects.heroPreviewMs','Сборка миниатюр, мс','number'],['effects.slideMs','Переход между слайдами, мс','number']]);s=section('Второй экран');fields(s.fields,[['effects.principlesMainMs','Построчное появление основного текста, мс','number'],['effects.principlesDescriptionMs','Нижний абзац, мс','number'],['effects.principlesOtherMs','Остальные элементы, мс','number']]);s=section('Работы и видео');fields(s.fields,[['effects.workTextMs','Расшифровка текста, мс','number'],['effects.videoTransitionMs','Пиксельный переход видео, мс','number'],['effects.videoScale','Размер видео, от 30 до 100%','number'],['effects.videoDim','Затемнение превью, от 0 до 100%','number']])}
  async function upload(file){return api('media',{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream','X-File-Name':encodeURIComponent(file.name)},body:file})}
  async function media(){intro('Загруженные файлы хранятся на сервере. Для использования вставьте ссылку в нужный слайд, работу или текстовый блок. Максимальный размер — 25 МБ.');const button=create('button','secondary','+ Загрузить файлы'),picker=create('input');picker.type='file';picker.multiple=true;picker.accept='image/*,video/mp4,audio/mpeg';picker.hidden=true;button.onclick=()=>picker.click();picker.onchange=async()=>{button.disabled=true;try{for(const file of picker.files)await upload(file);notice('Файлы загружены.');await render()}catch(error){notice(error.message,true)}finally{button.disabled=false}};$('#content').append(button,picker);const data=await api('media');if(tab!=='media')return;if(!data.items.length){$('#content').append(create('p','empty','Здесь появятся загруженные вами файлы. Исходные изображения сайта уже доступны в полях контента.'));return}const grid=create('div','media-grid');grid.style.marginTop='24px';for(const item of data.items){const card=create('article','media-card');if(item.type.startsWith('image/')){const img=create('img');img.src=item.url;img.alt=item.name;img.loading='lazy';card.append(img)}else card.append(create('div','media-placeholder',item.type.startsWith('video/')?'Видео':'Аудио'));const body=create('div','media-card-content');body.append(create('strong','',item.name),create('small','',(item.size/1024/1024).toFixed(2)+' МБ'));const actions=create('div'),copy=create('button','small-button','Ссылка'),remove=create('button','small-button danger','Удалить');copy.onclick=async()=>{try{await navigator.clipboard.writeText(new URL(item.url,location.origin).href);notice('Ссылка скопирована.')}catch{prompt('Ссылка на файл',new URL(item.url,location.origin).href)}};remove.onclick=async()=>{if(!confirm('Удалить файл «'+item.name+'»?'))return;try{await api('media/'+item.id,{method:'DELETE'});await render()}catch(error){notice(error.message,true)}};actions.append(copy,remove);body.append(actions);card.append(body);grid.append(card)}$('#content').append(grid)}
  async function history(){intro('Восстановление переносит выбранную версию в черновик. Чтобы показать её посетителям, нажмите «Опубликовать».');const data=await api('history');if(tab!=='history')return;const s=section('Опубликованные версии');if(!data.items.length){s.panel.append(create('p','muted','Публикаций через админку пока нет.'));return}for(const item of data.items){const row=create('div','history-row'),description=create('div');description.append(create('strong','',date(item.createdAt)),create('small','',item.revision===published?.revision?'Текущая публикация':'Сохранённая версия'));const button=create('button','secondary','Восстановить в черновик');button.onclick=async()=>{if(!confirm('Восстановить эту версию в черновик? Несохранённые изменения будут заменены.'))return;try{apply(await api('restore',{method:'POST',body:JSON.stringify({revision:item.revision,baseRevision:revision})}));notice('Версия восстановлена в черновик. Проверьте её в предпросмотре.');await render()}catch(error){notice(error.message,true)}};row.append(description,button);s.panel.append(row)}}
  async function render(){if(!config)return;$('#page-title').textContent=titles[tab];document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.tab===tab));$('#content').replaceChildren();try{await({home,slides,principles,process,about,faq,works,contacts,navigation,effects,media,history}[tab])()}catch(error){notice(error.message,true)}}
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
