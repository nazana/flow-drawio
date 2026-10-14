import {nativeStyleKeys,defaultStyles,validateStyles,validateElements,styleValues,patchStyle,followsStyle,legendLabel} from './flow-styles.js';
/* Flow integration for pinned draw.io 31.4.6. No changes to the editor engine. */
App.initPluginCallback();
App.embedModePluginsCount++;
Draw.loadPlugin(function(ui) {
  const graph = ui.editor.graph;
  document.documentElement.style.setProperty('--dark-color','#252a31');
  const model = graph.getModel();
  const isWrapping=graph.isWrapping;
  graph.isWrapping=function(cell){
    const g=cell?.geometry,s=g?.sourcePoint,t=g?.targetPoint;
    const self=cell?.edge&&((cell.source&&cell.source===cell.target)||(!cell.source&&!cell.target&&s&&t&&s.x===t.x&&(g.points||[]).some(p=>p.x!==s.x)));
    return self?false:isWrapping.apply(this,arguments);
  };
  graph.builtInProperties=[...(graph.builtInProperties||[]),'flowDiagramType','flowPaletteLibraries','flowStyleStamp','flowStyles','flowLegend','flowShowSystems','flowCatalog','flowElements','flowElementId','flowElementStamp','flowLegendIncluded','flowLegendName'];
  const origin = window.location.origin;
  window.addEventListener('securitypolicyviolation', event => send({event:'flow:blocked',uri:event.blockedURI}));
  const send = data => window.parent.postMessage(JSON.stringify(data), origin);
  const root = () => ui.pages && ui.pages.length && ui.pages[0].root ? ui.pages[0].root : model.getRoot();
  const attribute = (cell, key) => cell && cell.value && cell.value.nodeType === 1 ? cell.value.getAttribute(key) || '' : '';
  const sidebar=ui.sidebar,sequencePalette='flowSequence';
  let paletteRoot=null,sequenceMode=false,applyingPalettes=false;
  const base='html=1;whiteSpace=wrap;';
  sidebar.addPalette(sequencePalette,'시퀀스',true,function(container){
    const vertex=(name,style,w,h,label=name)=>container.appendChild(sidebar.createVertexTemplateEntry(base+style,w,h,label,name,null,null,'sequence '+name)(container));
    const edge=(name,style,label='')=>container.appendChild(sidebar.createEdgeTemplateEntry(base+'edgeStyle=none;rounded=0;'+style,160,0,label,name,null,'sequence '+name)(container));
    vertex('참여자 / 생명선','shape=umlLifeline;size=50;perimeter=lifelinePerimeter;container=1;dropTarget=0;collapsible=0;recursiveResize=0;outlineConnect=0;portConstraint=eastwest;',120,300,'참여자');
    vertex('액터 생명선','shape=umlLifeline;participant=umlActor;perimeter=lifelinePerimeter;container=1;dropTarget=0;collapsible=0;recursiveResize=0;outlineConnect=0;portConstraint=eastwest;',40,300,'사용자');
    vertex('실행 상자','fillColor=#dbeafe;strokeColor=#2563eb;outlineConnect=0;targetShapes=umlLifeline;portConstraint=eastwest;',14,90,'');
    edge('동기 메시지','endArrow=block;endFill=1;');
    edge('비동기 메시지','endArrow=open;endFill=0;');
    edge('반환 메시지','dashed=1;endArrow=open;endFill=0;');
    edge('생성 메시지','dashed=1;endArrow=open;endFill=0;','«create»');
    edge('종료 메시지','endArrow=block;endFill=1;','«destroy»');
    const self=new mxCell('자기 호출',new mxGeometry(0,0,0,0),'html=1;whiteSpace=nowrap;align=left;spacingLeft=8;edgeStyle=none;endArrow=block;endFill=1;');
    self.edge=true;self.geometry.relative=true;self.geometry.setTerminalPoint(new mxPoint(0,0),true);self.geometry.setTerminalPoint(new mxPoint(0,60),false);self.geometry.points=[new mxPoint(80,0),new mxPoint(80,60)];
    container.appendChild(sidebar.createEdgeTemplateFromCells([self],80,60,'자기 호출'));
    for(const op of ['alt','opt','loop','par','critical','break','ref'])vertex(op+' 프레임','shape=umlFrame;pointerEvents=0;fillColor=none;align=left;verticalAlign=top;',320,160,op);
    vertex('종료 표시','shape=umlDestroy;strokeWidth=3;targetShapes=umlLifeline;',30,30,'');
    vertex('상태 조건','rounded=1;',140,35,'{조건}');
    vertex('노트','shape=note;align=left;spacing=8;',160,90,'메모');
  });
  // Register with native library visibility so “More Shapes” keeps working.
  sidebar.configuration=sidebar.configuration.concat({id:sequencePalette});
  const showEntries=sidebar.showEntries;
  sidebar.showEntries=function(libraries,persist,force){
    if(sequenceMode&&typeof libraries==='string')libraries=[sequencePalette,...libraries.split(';').filter(id=>id!==sequencePalette)].join(';');
    const result=showEntries.call(this,libraries,persist,force);
    if(sequenceMode)this.movePalette(sequencePalette,'general');
    if(!applyingPalettes&&typeof libraries==='string'&&paletteRoot){
      const value=valueFor(root());value.setAttribute('flowPaletteLibraries',libraries);value.setAttribute('flowDiagramType',sequenceMode?'sequence':'general');model.setValue(root(),value);
    }
    return result;
  };
  function synchronizePalettes(){
    const current=root();if(!current||current===paletteRoot)return;
    paletteRoot=current;
    const type=attribute(current,'flowDiagramType');
    const hasLifeline=cell=>!!cell&&((cell.style||'').includes('shape=umlLifeline')||(cell.children||[]).some(hasLifeline));
    sequenceMode=type==='sequence'||(!type&&(ui.pages||[{root:current}]).some(page=>hasLifeline(page.root)));
    const allowed=new Set(sidebar.configuration.map(c=>c.id));
    const saved=attribute(current,'flowPaletteLibraries').split(';').filter(id=>allowed.has(id)).join(';');
    applyingPalettes=true;
    try{sidebar.showEntries(saved||(sequenceMode?sequencePalette:'general;basic;arrows2;flowchart'),false,true);}finally{applyingPalettes=false;}
    if(sequenceMode)ui.toggleShapesPanel(true);
  }
  const catalog = () => {
    const data = attribute(root(), 'flowCatalog');
    return data ? JSON.parse(data) : {systems: [], interfaces: []};
  };
  const styles = () => {const data=attribute(root(),'flowStyles');return data?JSON.parse(data):defaultStyles;};
  const elements=()=>{const data=attribute(root(),'flowElements');const items=data?JSON.parse(data):[];validateElements(items);return items;};
  function template(def){
    const value=mxUtils.createXmlDocument().createElement('object');
    value.setAttribute('label','');
    const cell=new mxCell(value,new mxGeometry(0,0,def.width,def.height),def.style);
    if(def.edge){cell.edge=true;cell.geometry.relative=true;cell.geometry.setTerminalPoint(new mxPoint(0,0),true);cell.geometry.setTerminalPoint(new mxPoint(def.width,0),false);}
    else cell.vertex=true;
    return cell;
  }
  const elementSamples=new Map();
  function elementSample(def){
    const key=JSON.stringify(def);if(elementSamples.has(key))return elementSamples.get(key);
    const holder=document.createElement('div');ui.sidebar.createThumb([template(def)],48,18,holder,'',false,false);
    const svg=holder.querySelector('svg');
    if(!svg)return '';
    svg.setAttribute('width','48');svg.setAttribute('height','18');svg.removeAttribute('style');
    const text=mxUtils.getXml(svg);if(elementSamples.size>200)elementSamples.clear();elementSamples.set(key,text);return text;
  }
  const follows = cell => followsStyle(cell.style,attribute(cell,'flowStyleStamp'));
  function applyStyle(cell,definition,settings) {
    const values=styleValues(settings[definition.kind]);
    let prior={};try{prior=JSON.parse(attribute(cell,'flowStyleStamp')||'{}');}catch{}
    const cleanStyle=(cell.style||'').split(';').filter(part=>{const key=part.split('=')[0];return !nativeStyleKeys.includes(key)||!Object.hasOwn(prior,key)||Object.hasOwn(values,key);}).join(';');
    const value=valueFor(cell);value.setAttribute('flowStyleStamp',JSON.stringify(values));
    model.setValue(cell,value);model.setStyle(cell,patchStyle(cleanStyle,values));
  }
  const legend = cell => attribute(cell,'flowLegend')==='1';
  function legendInfo(cell){
    const legacyId=attribute(cell,'flowElementId');
    const legacy=legacyId?elements().find(d=>d.id===legacyId):null;
    const flag=attribute(cell,'flowLegendIncluded');
    return {included:flag?flag==='1':!!legacy,name:attribute(cell,'flowLegendName')||legacy?.name||''};
  }
  function setLegendEntry(cell,included,name){
    const value=valueFor(cell);value.setAttribute('flowLegendIncluded',included?'1':'0');value.setAttribute('flowLegendName',name.trim());
    value.removeAttribute('flowElementId');value.removeAttribute('flowElementStamp');model.setValue(cell,value);
  }
  const legendStyle='whiteSpace=wrap;html=1;align=left;verticalAlign=middle;spacing=4;fillColor=#ffffff;strokeColor=#cbd5e1;strokeWidth=1;connectable=0;';
  const oldLegendStyle='whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacing=4;fillColor=none;strokeColor=none;connectable=0;';
  const editable=graph.isCellEditable;
  graph.isCellEditable=function(cell){return !legend(cell)&&editable.apply(this,arguments);};
  const connectable=graph.isCellConnectable;
  graph.isCellConnectable=function(cell){return !legend(cell)&&connectable.apply(this,arguments);};
  // ponytail: One scan per edit, including off-screen pages. Index pages only if large documents require it.
  function synchronize() {
    const settings=styles(),defs=new Map(catalog().interfaces.map(i=>[i.ifId,i]));
    for(const page of ui.pages||[{root:model.getRoot()}]) {
      const cells=[];const visit=c=>{if(!c)return;cells.push(c);(c.children||[]).forEach(visit);};visit(page.root);
      const usedKinds=new Set();
      for(const cell of cells)if(cell.edge){
        const def=defs.get(attribute(cell,'ifId'));
        if(def)usedKinds.add(def.kind);
        if(def&&follows(cell)&&attribute(cell,'flowStyleStamp')!==JSON.stringify(styleValues(settings[def.kind])))applyStyle(cell,def,settings);
      }
      const entries=[],seen=new Set();
      for(const cell of cells)if((cell.vertex||cell.edge)&&!legend(cell)){
        const info=legendInfo(cell);if(!info.included)continue;
        const def={name:info.name,edge:!!cell.edge,style:cell.style||'',width:cell.edge?120:Math.max(1,cell.geometry?.width||120),height:cell.edge?24:Math.max(1,cell.geometry?.height||60)};
        const key=JSON.stringify(def);if(seen.has(key))continue;seen.add(key);
        entries.push({name:info.name,svg:elementSample(def)});
      }
      const automatic=Object.keys(defaultStyles).filter(kind=>usedKinds.has(kind)).map(kind=>({name:settings[kind].name,svg:elementSample({edge:true,width:120,height:24,style:patchStyle('',styleValues(settings[kind]))})}));
      const label=legendLabel([],settings,0,[...automatic,...entries]);
      for(const cell of cells)if(legend(cell)){
        if(cell.style===oldLegendStyle)model.setStyle(cell,legendStyle);
        if(attribute(cell,'label')!==label){const value=valueFor(cell);value.setAttribute('label',label);model.setValue(cell,value);}
      }
    }
  }
  // BEFORE_UNDO appends derived updates to the originating edit, preserving one-step undo/redo.
  model.addListener(mxEvent.BEFORE_UNDO,synchronize);
  function connectionConflict(edge){
    const def=catalog().interfaces.find(i=>i.ifId===attribute(edge,'ifId'));
    if(!edge?.edge||!def)return null;
    const from=attribute(edge.source,'systemCode'),to=attribute(edge.target,'systemCode');
    if(edge.source&&edge.target&&from===def.fromSystemCode&&to===def.toSystemCode)return null;
    let shared=0,related=0;
    const visit=cell=>{if(!cell)return;if(cell.edge&&cell!==edge){if(attribute(cell,'ifId')===def.ifId)shared++;if(attribute(cell,'ifId')&&(edge.source&&(cell.source===edge.source||cell.target===edge.source)||edge.target&&(cell.source===edge.target||cell.target===edge.target)))related++;}(cell.children||[]).forEach(visit);};
    (ui.pages||[{root:model.getRoot()}]).forEach(page=>visit(page.root));
    return {id:edge.id,ifId:def.ifId,source:edge.source?.id||'',target:edge.target?.id||'',from,to,ifFrom:def.fromSystemCode,ifTo:def.toSystemCode,shared,related};
  }
  const showSystems = () => attribute(root(), 'flowShowSystems') === '1';
  const systemCaption = cell => {
    if (!cell || !cell.vertex || !showSystems()) return '';
    const code = attribute(cell, 'systemCode');
    if (!code) return '';
    let name = '';
    try { name = catalog().systems.find(s => s.code === code)?.name || ''; } catch { return ''; }
    return code + (name ? ' · ' + name : '');
  };
  const originalHtmlLabel = graph.isHtmlLabel;
  graph.isHtmlLabel = function(cell) {
    return !!systemCaption(cell) || originalHtmlLabel.apply(this, arguments);
  };
  const originalLabelValue = graph.cellRenderer.getLabelValue;
  graph.cellRenderer.getLabelValue = function(state) {
    // Native rendering escapes plain labels and sanitizes HTML before adding our caption.
    const label = originalLabelValue.apply(this, arguments);
    const caption = systemCaption(state.cell);
    if (!caption) return label;
    let secondary = '<span style="font-size:80%;">' + mxUtils.htmlEntities(caption) + '</span>';
    if (String(state.style.html) === '1') {
      const body = document.createElement('div');
      body.innerHTML = label;
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      let text = walker.nextNode();
      while (text && !text.textContent.trim()) text = walker.nextNode();
      // Rich text can override the cell font. Follow the first visible text's size hierarchy.
      for (let element = text?.parentElement; element && element !== body; element = element.parentElement) {
        const sized = document.createElement(element.tagName === 'FONT' ? 'font' : 'span');
        if (element.tagName === 'FONT' && element.hasAttribute('size')) sized.setAttribute('size', element.getAttribute('size'));
        sized.style.fontSize = element.style.fontSize;
        sized.innerHTML = secondary;
        secondary = sized.outerHTML;
      }
    }
    return label + '<div style="font-weight:normal;font-style:normal;color:#64748b;line-height:1.3;margin-top:4px;">' + secondary + '</div>';
  };
  const documentLinkPrefix='data:flow-document/id,';
  const originalCustomLink=graph.customLinkClicked,originalLinkTitle=graph.getLinkTitle;
  graph.getLinkTitle=function(link){return link?.startsWith(documentLinkPrefix)?'저장 문서 열기':originalLinkTitle.apply(this,arguments);};
  graph.customLinkClicked=function(link,cell){
    if(link?.startsWith(documentLinkPrefix)){
      const id=link.slice(documentLinkPrefix.length);
      if(/^[a-zA-Z0-9-]{1,80}$/.test(id))send({event:'flow:openDocument',id});
      else send({event:'flow:error',error:'문서 링크가 올바르지 않습니다.'});
      return true;
    }
    if(link?.startsWith('data:page/id,')&&!ui.getPageById(link.slice(13))){send({event:'flow:error',error:'대상 페이지가 없습니다. 링크를 다시 지정하세요.'});return true;}
    return originalCustomLink.apply(this,arguments);
  };
  function describe(cell) {
    const info=legendInfo(cell),appearance=graph.getCellStyle(cell);
    return {link:attribute(cell,'link'),fillColor:appearance.fillColor,strokeColor:appearance.strokeColor,legendIncluded:info.included,legendName:info.name,legend:legend(cell),styleMode:follows(cell)?'auto':'custom',id: cell.id, label: graph.convertValueToString(cell), edge: !!cell.edge,
      source: cell.source && cell.source.id, target: cell.target && cell.target.id,
      systemCode: attribute(cell, 'systemCode'), ifId: attribute(cell, 'ifId'), detail: attribute(cell, 'detail')};
  }
  function snapshot(requestId) {
    try {
      synchronizePalettes();
      send({event: 'flow:snapshot', requestId, xml: ui.getFileData(true), catalog: catalog(), styles:styles(), showSystems: showSystems(),
        conflicts:Object.values(model.cells||{}).filter(c=>c.edge).map(connectionConflict).filter(Boolean),
        pages:(ui.pages||[]).filter(page=>page.getId).map(page=>({id:page.getId(),name:page.getName?.()||'페이지'})),
        pageId: ui.currentPage ? ui.currentPage.getId() : '',
        cells: Object.values(model.cells || {}).filter(c => c.vertex || c.edge).map(describe),
        selection: graph.getSelectionCells().map(c => c.id)});
    } catch (e) { send({event: 'flow:error', requestId, error: e.message}); }
  }
  let relationshipEnabled=false,highlights=[],haloCounter=0,locatedCells=null,locateTimer;
  function highlightRelationships(){
    highlights.forEach(h=>h.destroy());highlights=[];
    if(!relationshipEnabled&&!locatedCells)return;
    const selected=locatedCells||graph.getSelectionCells();if(!selected.length||(!locatedCells&&selected.length!==1))return;
    const dark=Editor.isDarkMode();
    const current=new Set(selected),related=new Set(selected);
    for(const c of Object.values(model.cells||{}))if(c.edge&&(current.has(c)||current.has(c.source)||current.has(c.target))){related.add(c);if(c.source)related.add(c.source);if(c.target)related.add(c.target);}
    for(const c of related){const state=graph.view.getState(c);if(state){
      const active=current.has(c);
      const h=new mxCellHighlight(graph,active?(dark?'#ff9b64':'#dc6c43'):(dark?'#8bbad0':'#57788d'),c.vertex?12:3);
      h.spacing=0;h.opacity=c.edge?(dark?75:45):(dark?(active?90:65):20);h.keepOnTop=false;
      if(c.edge){
        // A quiet band behind the original path; no duplicate arrowheads or labels.
        h.getStrokeWidth=function(){return (Number(this.state?.style.strokeWidth)||1)+6/(this.state?.view.scale||1);};
        h.createShape=function(){
          const shape=new mxPolyline(this.state.absolutePoints,this.highlightColor);shape.apply(this.state);
          shape.stroke=this.highlightColor;shape.opacity=this.opacity;shape.isDashed=false;shape.isShadow=false;
          shape.dialect=mxConstants.DIALECT_SVG;shape.svgStrokeTolerance=0;shape.svgPointerEvents='none';
          shape.init(graph.view.getDrawPane());return shape;
        };
      }
      if(c.vertex){
        // Match flow2's outside-only halo: mask the silhouette and its original border.
        const repaint=h.repaint.bind(h),maskId='flow-halo-'+(++haloCounter);
        h.repaint=function(){
          repaint();if(!this.shape?.node||!this.state)return;
          const node=this.shape.node,ns='http://www.w3.org/2000/svg',silhouette=node.cloneNode(true);
          silhouette.removeAttribute('mask');silhouette.querySelectorAll('defs').forEach(d=>d.remove());
          for(const part of [silhouette,...silhouette.querySelectorAll('*')]){
            part.removeAttribute('style');part.setAttribute('opacity','1');
            if(['path','rect','ellipse','circle','polygon','polyline'].includes(part.nodeName)){
              part.setAttribute('fill','black');part.setAttribute('stroke','black');
              part.setAttribute('stroke-width',String((Number(this.state.style.strokeWidth)||1)*this.state.view.scale));
              part.removeAttribute('stroke-dasharray');
            }
          }
          const defs=document.createElementNS(ns,'defs'),mask=document.createElementNS(ns,'mask'),white=document.createElementNS(ns,'rect');
          const pad=Math.max(this.state.width,this.state.height)+32;
          mask.setAttribute('id',maskId);mask.setAttribute('maskUnits','userSpaceOnUse');
          for(const [key,value] of Object.entries({x:this.state.x-pad,y:this.state.y-pad,width:this.state.width+pad*2,height:this.state.height+pad*2})){mask.setAttribute(key,String(value));white.setAttribute(key,String(value));}
          white.setAttribute('fill','white');mask.append(white,silhouette);defs.append(mask);node.append(defs);node.setAttribute('mask','url(#'+maskId+')');
        };
      }
      h.highlight(state);if(c.edge&&h.shape?.node){const pane=graph.view.getDrawPane();pane.insertBefore(h.shape.node,pane.firstChild);}highlights.push(h);
    }}
  }
  let timer;
  function schedule() { clearTimeout(timer); timer = setTimeout(() => snapshot(), 100); }
  graph.getSelectionModel().addListener(mxEvent.CHANGE, () => {
    locatedCells=null;clearTimeout(locateTimer);
    highlightRelationships();
    send({event: 'flow:selection', cells: graph.getSelectionCells().map(describe)});
  });
  model.addListener(mxEvent.CHANGE, (_sender, event) => {
    if ((event.getProperty('changes') || []).some(change => change.cell === root())) graph.refresh();
    schedule();
  });
  ui.addListener('pageSelected', ()=>{locatedCells=null;clearTimeout(locateTimer);highlightRelationships();schedule();});
  ui.addListener('darkModeChanged',highlightRelationships);
  const sendTheme=(initial=false)=>send({event:'flow:theme',dark:Editor.isDarkMode(),initial});
  ui.addListener('darkModeChanged',()=>sendTheme());
  model.addListener(mxEvent.CHANGE,()=>{if(relationshipEnabled)setTimeout(highlightRelationships,0);});
  function valueFor(cell) {
    if (cell.value && cell.value.nodeType === 1) return cell.value.cloneNode(true);
    const value = mxUtils.createXmlDocument().createElement('object');
    value.setAttribute('label', cell.value == null ? '' : String(cell.value));
    return value;
  }
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== origin) return;
    let message;
    try { message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
    if (!message || !String(message.action || '').startsWith('flow:')) return;
    try {
      if (message.action === 'flow:snapshot') {
        graph.stopEditing(false);
        snapshot(message.requestId);
        return;
      }
      if (message.action === 'flow:select') {
        const cell = model.getCell(message.id);
        if (cell) { graph.setSelectionCell(cell); graph.scrollCellToVisible(cell);if(message.openStyle){ui.format.currentIndex=0;ui.toggleFormatPanel(true);ui.format.refresh();} }
        return;
      }
      if(message.action==='flow:locate'){
        let cells;
        if(message.systemCode!==undefined){
          if(typeof message.systemCode!=='string'||!catalog().systems.some(s=>s.code===message.systemCode))throw new Error('시스템을 확인하세요.');
          cells=Object.values(model.cells||{}).filter(c=>c.vertex&&!legend(c)&&attribute(c,'systemCode')===message.systemCode);
        }else{const cell=model.getCell(message.id);cells=cell&&(cell.vertex||cell.edge)?[cell]:[];}
        if(!cells.length)throw new Error('현재 페이지에서 해당 요소를 찾을 수 없습니다.');
        graph.scrollCellToVisible(cells[0]);
        locatedCells=cells;clearTimeout(locateTimer);highlightRelationships();
        if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
          for(const h of highlights)h.shape?.node?.animate?.(
            [{opacity:1},{opacity:0.15},{opacity:1},{opacity:0.15},{opacity:1}],
            {duration:1600,easing:'ease-in-out'});
        }
        locateTimer=setTimeout(()=>{locatedCells=null;highlightRelationships();},3000);
        return;
      }
      if(message.action==='flow:theme'){
        if(typeof message.dark!=='boolean')throw new Error('테마 설정이 올바르지 않습니다.');
        ui.setDarkMode(message.dark);
        return;
      }
      if(message.action==='flow:relationships'){
        relationshipEnabled=!!message.enabled;highlightRelationships();
      }else if(message.action==='flow:import'){
        if(message.pageId!==(ui.currentPage?ui.currentPage.getId():''))throw new Error('페이지가 변경되었습니다. 다시 가져오세요.');
        if(typeof message.xml!=='string'||message.xml.length>16000000||/<!DOCTYPE|<!ENTITY/i.test(message.xml))throw new Error('가져오기 파일을 확인하세요.');
        if(!message.catalog||!Array.isArray(message.catalog.systems)||!Array.isArray(message.catalog.interfaces))throw new Error('정의를 확인하세요.');
        const imported=mxUtils.parseXml(message.xml);
        if(imported.documentElement.nodeName!=='mxGraphModel'||imported.getElementsByTagName('parsererror').length)throw new Error('그림 형식을 확인하세요.');
        model.beginUpdate();try{
          const inserted=graph.importGraphModel(imported.documentElement,40,40,false);
          const value=valueFor(root());value.setAttribute('flowCatalog',JSON.stringify(message.catalog));model.setValue(root(),value);
          graph.setSelectionCells(inserted);if(inserted.length)graph.scrollCellToVisible(inserted[0]);
        }finally{model.endUpdate();}
      }else if(message.action==='flow:link' ||message.action==='flow:followLink'){
        if(message.pageId!==(ui.currentPage?ui.currentPage.getId():''))throw new Error('페이지가 변경되었습니다. 다시 선택하세요.');
        const cell=model.getCell(message.id);
        if(!cell||legend(cell)||!(cell.vertex||cell.edge))throw new Error('도형 또는 선을 선택하세요.');
        if(message.action==='flow:followLink'){
          const link=attribute(cell,'link');
          if(!link.startsWith(documentLinkPrefix)&&!link.startsWith('data:page/id,'))throw new Error('문서 또는 페이지 링크를 지정하세요.');
          graph.customLinkClicked(link,cell);
        }else{
          if(!['document','page','none'].includes(message.kind))throw new Error('링크 종류를 확인하세요.');
          if(message.kind!=='none'&&(typeof message.target!=='string'||!message.target||message.target.length>160))throw new Error('링크 대상을 확인하세요.');
          if(message.kind==='document'&&!/^[a-zA-Z0-9-]{1,80}$/.test(message.target))throw new Error('문서 링크가 올바르지 않습니다.');
          if(message.kind==='page'&&!ui.getPageById(message.target))throw new Error('대상 페이지가 없습니다.');
          const value=valueFor(cell);
          if(message.kind==='none')value.removeAttribute('link');
          else value.setAttribute('link',(message.kind==='document'?documentLinkPrefix:'data:page/id,')+message.target);
          model.setValue(cell,value);
        }
      }else if(message.action==='flow:resolveConnection'){
        if(message.pageId!==(ui.currentPage?ui.currentPage.getId():''))throw new Error('페이지가 변경되었습니다. 다시 확인하세요.');
        const edge=model.getCell(message.id),current=connectionConflict(edge);
        if(!current||JSON.stringify(current)!==JSON.stringify(message.expected))throw new Error('연결 정보가 변경되었습니다. 다시 확인하세요.');
        if(!['interface','nodes','detach'].includes(message.mode))throw new Error('처리 방법을 선택하세요.');
        const next=catalog(),def=next.interfaces.find(i=>i.ifId===current.ifId);
        if(message.mode==='interface'&&(!current.source||!current.target||!next.systems.some(s=>s.code===current.from)||!next.systems.some(s=>s.code===current.to)))throw new Error('양 끝 노드에 시스템을 먼저 지정하세요.');
        if(message.mode==='nodes'&&(!edge.source?.vertex||!edge.target?.vertex||edge.source===edge.target&&current.ifFrom!==current.ifTo))throw new Error('양 끝에 서로 다른 송수신 시스템을 적용할 수 있는 도형을 연결하세요.');
        model.beginUpdate();try{
          if(message.mode==='interface'){
            def.fromSystemCode=current.from;def.toSystemCode=current.to;
            const value=valueFor(root());value.setAttribute('flowCatalog',JSON.stringify(next));model.setValue(root(),value);
          }else if(message.mode==='nodes'){
            for(const [cell,code] of [[edge.source,current.ifFrom],[edge.target,current.ifTo]]){const value=valueFor(cell);value.setAttribute('systemCode',code);model.setValue(cell,value);}
          }else{
            const value=valueFor(edge);value.removeAttribute('ifId');value.removeAttribute('flowStyleStamp');model.setValue(edge,value);
          }
        }finally{model.endUpdate();}
        graph.refresh();
      }else if(message.action==='flow:legendEntry'){
        if(message.pageId!==(ui.currentPage?ui.currentPage.getId():''))throw new Error('페이지가 변경되었습니다.');
        const cell=model.getCell(message.id);
        if(!cell||legend(cell)||!(cell.vertex||cell.edge))throw new Error('도형 또는 선을 선택하세요.');
        if(typeof message.included!=='boolean'||typeof message.name!=='string'||message.name.length>80||(message.included&&!message.name.trim()))throw new Error('범례 이름을 입력하세요 (최대 80자).');
        setLegendEntry(cell,message.included,message.name);
      }else if(message.action==='flow:publishStyle'){
        if(message.pageId!==(ui.currentPage?ui.currentPage.getId():''))throw new Error('페이지가 변경되었습니다.');
        const cell=model.getCell(message.id),def=catalog().interfaces.find(i=>i.ifId===attribute(cell,'ifId'));
        if(!cell?.edge||!def)throw new Error('I/F가 지정된 선을 선택하세요.');
        const settings={...styles()},actual=graph.getCellStyle(cell),nativeStyle={};
        for(const key of nativeStyleKeys)if(actual[key]!=null)nativeStyle[key]=String(actual[key]);
        const prior=settings[def.kind];
        settings[def.kind]={...prior,color:/^#[0-9a-f]{6}$/i.test(actual.strokeColor)?actual.strokeColor:prior.color,width:Math.min(6,Math.max(1,Math.round(Number(actual.strokeWidth)||1))),line:actual.shape==='link'?'double':actual.dashed==1?(String(actual.dashPattern).startsWith('1 ')?'dotted':'dashed'):'solid',nativeStyle};
        if(settings[def.kind].line==='double'){settings[def.kind].start='none';settings[def.kind].end='none';}
        validateStyles(settings);
        model.beginUpdate();try{const value=valueFor(root());value.setAttribute('flowStyles',JSON.stringify(settings));model.setValue(root(),value);applyStyle(cell,def,settings);}finally{model.endUpdate();}
      }else if (message.action === 'flow:styles') {
        validateStyles(message.styles);
        const entries=message.entries||[];
        if(!Array.isArray(entries)||entries.length>10000)throw new Error('범례 목록을 확인하세요.');
        if(entries.length&&message.pageId!==(ui.currentPage?ui.currentPage.getId():''))throw new Error('페이지가 변경되었습니다.');
        for(const entry of entries){const cell=model.getCell(entry.id);if(!cell||legend(cell)||!(cell.vertex||cell.edge)||typeof entry.included!=='boolean'||typeof entry.name!=='string'||entry.name.length>80||(entry.included&&!entry.name.trim()))throw new Error('범례 항목과 이름을 확인하세요.');for(const key of ['fillColor','strokeColor'])if(entry[key]!==undefined&&(typeof entry[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(entry[key])))throw new Error('범례 색을 확인하세요.');}
        model.beginUpdate();try{
          const value=valueFor(root());value.setAttribute('flowStyles',JSON.stringify(message.styles));model.setValue(root(),value);
          for(const entry of entries){const cell=model.getCell(entry.id),colors={};for(const key of ['fillColor','strokeColor'])if(entry[key]!==undefined)colors[key]=entry[key];if(Object.keys(colors).length)model.setStyle(cell,patchStyle(cell.style,colors));setLegendEntry(cell,entry.included,entry.name);}
        }finally{model.endUpdate();}
      } else if (message.action === 'flow:styleMode') {
        if(message.pageId!==(ui.currentPage?ui.currentPage.getId():''))throw new Error('페이지가 변경되었습니다.');
        const cell=model.getCell(message.id),def=catalog().interfaces.find(i=>i.ifId===attribute(cell,'ifId'));
        if(!cell?.edge||!def)throw new Error('I/F가 지정된 연결선을 선택하세요.');
        if(!['auto','custom'].includes(message.mode))throw new Error('선 표현 방식을 확인하세요.');
        model.beginUpdate();try {
          if(message.mode==='auto')applyStyle(cell,def,styles());
          else {const value=valueFor(cell);value.removeAttribute('flowStyleStamp');model.setValue(cell,value);}
        }finally{model.endUpdate();}
      } else if (message.action === 'flow:legend') {
        let cell=Object.values(model.cells||{}).find(legend);
        if(!cell){
          const value=mxUtils.createXmlDocument().createElement('object');value.setAttribute('flowLegend','1');
          const area=graph.getGraphBounds(),scale=graph.view.scale,translate=graph.view.translate;
          model.beginUpdate();try {
            cell=graph.insertVertex(graph.getDefaultParent(),null,value,area.x/scale-translate.x,Math.max(40,(area.y+area.height)/scale-translate.y+40),480,32,legendStyle);
          }finally{model.endUpdate();}
        }else{
          model.beginUpdate();try{synchronize();}finally{model.endUpdate();}
        }
        graph.setSelectionCell(cell);graph.scrollCellToVisible(cell);
      } else if (message.action === 'flow:view') {
        if (typeof message.showSystems !== 'boolean') throw new Error('표시 설정이 올바르지 않습니다.');
        const value = valueFor(root());
        value.setAttribute('flowShowSystems', message.showSystems ? '1' : '0');
        model.setValue(root(), value);
      } else if (message.action === 'flow:interface') {
        if (message.pageId !== (ui.currentPage ? ui.currentPage.getId() : '')) throw new Error('페이지가 변경되었습니다. 다시 선택하세요.');
        const edge = model.getCell(message.id);
        if (!edge || !edge.edge) throw new Error('선택한 연결선이 없습니다.');
        const next = catalog();
        if (message.definition) {
          const d = message.definition;
          const validCode = s => typeof s === 'string' && s.trim() && s.length <= 160;
          if (!validCode(d.ifId) || !validCode(d.name) || !Object.hasOwn({TC:1,EVENT:1,API:1}, d.kind) || d.channel !== {TC:'EAI',EVENT:'KAFKA',API:'API_SYNC'}[d.kind] || !(d.formatId === null || typeof d.formatId === 'string' && d.formatId.length <= 160)) throw new Error('I/F 정의를 확인하세요.');
          if (next.interfaces.some(i => i.ifId === d.ifId)) throw new Error('이미 존재하는 I/F 코드입니다.');
          if (next.interfaces.length >= 5000) throw new Error('I/F 정의는 최대 5,000개입니다.');
          next.interfaces.push(d);
        }
        const def = next.interfaces.find(i => i.ifId === message.ifId);
        if (!def || !next.systems.some(s => s.code === def.fromSystemCode) || !next.systems.some(s => s.code === def.toSystemCode)) throw new Error('I/F와 송수신 시스템을 확인하세요.');
        if (!edge.source || !edge.target || !edge.source.vertex || !edge.target.vertex) throw new Error('선을 시작 도형과 끝 도형에 연결하세요.');
        if (message.applySystems && edge.source === edge.target && def.fromSystemCode !== def.toSystemCode) throw new Error('같은 도형에 서로 다른 송수신 시스템을 적용할 수 없습니다.');
        const pairs = [[edge.source,def.fromSystemCode],[edge.target,def.toSystemCode]];
        if (!message.applySystems && pairs.some(([cell,code]) => attribute(cell,'systemCode') && attribute(cell,'systemCode') !== code)) throw new Error('도형 소속과 송수신이 다릅니다. I/F를 바꾸거나 도형 소속 적용을 선택하세요.');
        const value = valueFor(edge);
        value.setAttribute('ifId', def.ifId);
        for (const key of ['label','detail']) if (message.patch && Object.hasOwn(message.patch,key)) {
          if (typeof message.patch[key] !== 'string' || message.patch[key].length > 2000) throw new Error('속성 값을 확인하세요.');
          value.setAttribute(key,message.patch[key]);
        }
        // All validation precedes the transaction: one undo restores the definition, edge and nodes.
        model.beginUpdate();
        try {
          if (message.definition) {
            const rootValue = valueFor(root());
            rootValue.setAttribute('flowCatalog',JSON.stringify(next));
            model.setValue(root(),rootValue);
          }
          if (message.applySystems) for (const [cell,code] of pairs) {
            const nodeValue = valueFor(cell);nodeValue.setAttribute('systemCode',code);model.setValue(cell,nodeValue);
          }
          const useStyle=!attribute(edge,'ifId')||follows(edge);
          model.setValue(edge,value);
          if(useStyle)applyStyle(edge,def,styles());
        } finally { model.endUpdate(); }
      } else if (message.action === 'flow:cell') {
        if (message.pageId !== (ui.currentPage ? ui.currentPage.getId() : '')) throw new Error('페이지가 변경되었습니다. 다시 선택하세요.');
        const cell = model.getCell(message.id);
        if (!cell || !(cell.vertex || cell.edge)) throw new Error('선택한 도형이 삭제되었습니다.');
        const value = valueFor(cell);
        for (const key of ['label', 'detail', 'systemCode', 'ifId']) {
          if (Object.hasOwn(message.patch, key)) {
            if (typeof message.patch[key] !== 'string' || message.patch[key].length > 2000) throw new Error('속성 값을 확인하세요.');
            value.setAttribute(key, message.patch[key]);
          }
        }
        model.setValue(cell, value);
      } else if (message.action === 'flow:catalog') {
        const next = message.catalog;
        if (!next || !Array.isArray(next.systems) || !Array.isArray(next.interfaces)) throw new Error('정의 형식이 올바르지 않습니다.');
        const old = catalog();
        const removedSystems = old.systems.filter(s => !next.systems.some(n => n.code === s.code)).map(s => s.code);
        const removedInterfaces = old.interfaces.filter(i => !next.interfaces.some(n => n.ifId === i.ifId)).map(i => i.ifId);
        const visit = c => {
          if (removedSystems.includes(attribute(c,'systemCode')) || removedInterfaces.includes(attribute(c,'ifId'))) throw new Error('그림에서 사용 중입니다. 도형·연결선의 지정을 먼저 해제하세요.');
          (c.children || []).forEach(visit);
        };
        (ui.pages || [{root:model.getRoot()}]).forEach(p => visit(p.root));
        const cell = root();
        const value = valueFor(cell);
        value.setAttribute('flowCatalog', JSON.stringify(message.catalog));
        model.setValue(cell, value);
      }
      snapshot(message.requestId);
    } catch (e) { send({event: 'flow:error', requestId: message.requestId, error: e.message}); }
  });
  send({event: 'flow:ready'});
  sendTheme(true);
});
