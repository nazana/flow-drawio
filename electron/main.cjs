const {app,BrowserWindow,dialog}=require('electron');
const {mkdirSync,appendFileSync}=require('node:fs');
const {join,dirname}=require('node:path');

let window,server;
const portableDir=process.env.PORTABLE_EXECUTABLE_DIR||dirname(app.getPath('exe'));
const dataDir=app.isPackaged?join(portableDir,'.data'):join(__dirname,'..','.data');
let locked=false;
try{
  mkdirSync(join(dataDir,'electron'),{recursive:true});
  app.setPath('userData',join(dataDir,'electron'));
  locked=app.requestSingleInstanceLock();
}catch(error){dialog.showErrorBox('Flow Studio 실행 오류',`실행 폴더에 데이터를 저장할 수 없습니다.\n\n${error.message}`);}
if(!locked)app.quit();
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
app.on('window-all-closed',()=>app.quit());
app.on('will-quit',()=>{server?.closeAllConnections();server?.close();});

app.whenReady().then(async()=>{
  if(!locked)return;
  mkdirSync(dataDir,{recursive:true});
  process.env.FLOW_DB_PATH=join(dataDir,'flow.sqlite');
  process.env.FLOW_STATIC_PATH=app.isPackaged?join(process.resourcesPath,'dist'):join(__dirname,'..','dist');
  process.env.HOST='0.0.0.0';
  process.env.PORT='0';
  const backend=require('../server-dist/index.cjs');
  server=backend.server;
  const url=await backend.serverReady;
  window=new BrowserWindow({width:1440,height:960,title:'Flow Studio',show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  window.removeMenu();
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,target)=>{if(new URL(target).origin!==url)event.preventDefault();});
  window.webContents.on('will-prevent-unload',event=>{
    const choice=dialog.showMessageBoxSync(window,{type:'question',buttons:['계속 편집','저장 없이 종료'],defaultId:0,cancelId:0,title:'저장하지 않은 변경',message:'저장하지 않은 변경이 있습니다. 종료할까요?'});
    if(choice===1)event.preventDefault();
  });
  window.once('ready-to-show',()=>window.show());
  window.on('closed',()=>{window=null;});
  await window.loadURL(url);
}).catch(error=>{
  try{appendFileSync(join(dataDir,'startup-error.log'),`${new Date().toISOString()}\n${error.stack||error}\n`);}catch{}
  dialog.showErrorBox('Flow Studio 실행 오류',`앱을 시작하지 못했습니다. 실행 폴더의 쓰기 권한을 확인하세요.\n\n${error.message}`);
  app.quit();
});
