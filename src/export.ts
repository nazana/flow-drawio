export function imageDataBlob(uri:string){
 const match=/^data:(image\/(?:png|svg\+xml))(;base64)?,([\s\S]*)$/.exec(uri);if(!match)throw new Error('이미지 출력 형식을 확인하세요.');
 if(!match[2])return new Blob([decodeURIComponent(match[3])],{type:match[1]});
 const binary=atob(match[3]),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return new Blob([bytes],{type:match[1]});
}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name.replace(/[\\/:*?"<>|]/g,'_');a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
let zipReady:Promise<any>|undefined;
async function zipLibrary(){
 if((window as any).JSZip)return (window as any).JSZip;
 if(!zipReady)zipReady=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/drawio/js/jszip/jszip.min.js';script.onload=()=>resolve((window as any).JSZip);script.onerror=()=>{zipReady=undefined;script.remove();reject(new Error('로컬 출력 라이브러리를 불러오지 못했습니다.'));};document.head.append(script);});
 return zipReady;
}
const xml=(s:string)=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+s;
const p='http://schemas.openxmlformats.org/presentationml/2006/main',a='http://schemas.openxmlformats.org/drawingml/2006/main',r='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const rels=(items:[string,string,string][])=>xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id,type,target])=>`<Relationship Id="${id}" Type="${r}/${type}" Target="${target}"/>`).join('')}</Relationships>`);
const group='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
// ponytail: A slide contains one rendered image. Use a presentation library if editable shapes or multiple layouts become requirements.
export function pptxParts(width:number,height:number):Record<string,string>{
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('출력 이미지 크기를 확인하세요.');
 const sw=12192000,sh=6858000,pad=274320,scale=Math.min((sw-pad*2)/width,(sh-pad*2)/height),w=Math.round(width*scale),h=Math.round(height*scale),x=Math.round((sw-w)/2),y=Math.round((sh-h)/2);
 const overrides=[['/ppt/presentation.xml','presentation.main'],['/ppt/slides/slide1.xml','slide'],['/ppt/slideMasters/slideMaster1.xml','slideMaster'],['/ppt/slideLayouts/slideLayout1.xml','slideLayout']];
 return {
 '[Content_Types].xml':xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>${overrides.map(([part,type])=>`<Override PartName="${part}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.${type}+xml"/>`).join('')}<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>`),
 '_rels/.rels':rels([['rId1','officeDocument','ppt/presentation.xml']]),
 'ppt/presentation.xml':xml(`<p:presentation xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId2"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="${sw}" cy="${sh}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`),
 'ppt/_rels/presentation.xml.rels':rels([['rId1','slide','slides/slide1.xml'],['rId2','slideMaster','slideMasters/slideMaster1.xml']]),
 'ppt/slides/slide1.xml':xml(`<p:sld xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld><p:spTree>${group}<p:pic><p:nvPicPr><p:cNvPr id="2" name="Flow diagram"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`),
 'ppt/slides/_rels/slide1.xml.rels':rels([['rId1','image','../media/image1.png'],['rId2','slideLayout','../slideLayouts/slideLayout1.xml']]),
 'ppt/slideLayouts/slideLayout1.xml':xml(`<p:sldLayout xmlns:p="${p}" xmlns:a="${a}" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${group}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`),
 'ppt/slideLayouts/_rels/slideLayout1.xml.rels':rels([['rId1','slideMaster','../slideMasters/slideMaster1.xml']]),
 'ppt/slideMasters/slideMaster1.xml':xml(`<p:sldMaster xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${group}</p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`),
 'ppt/slideMasters/_rels/slideMaster1.xml.rels':rels([['rId1','slideLayout','../slideLayouts/slideLayout1.xml'],['rId2','theme','../theme/theme1.xml']]),
 'ppt/theme/theme1.xml':xml(`<a:theme xmlns:a="${a}" name="Flow"><a:themeElements><a:clrScheme name="Flow">${Object.entries({dk1:'000000',lt1:'FFFFFF',dk2:'334155',lt2:'F1F5F9',accent1:'2563EB',accent2:'16A34A',accent3:'D97706',accent4:'9333EA',accent5:'0891B2',accent6:'DC2626',hlink:'2563EB',folHlink:'9333EA'}).map(([k,v])=>`<a:${k}><a:srgbClr val="${v}"/></a:${k}>`).join('')}</a:clrScheme><a:fontScheme name="Flow"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Flow"><a:fillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${'<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>'.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`)
 };
}
export async function createPptx(uri:string){
 if(!uri.startsWith('data:image/png;base64,'))throw new Error('PNG 출력에 실패했습니다.');
 const img=new Image();img.src=uri;await img.decode();if(img.width<2||img.height<2)throw new Error('출력할 그림이 없습니다.');
 const Zip=await zipLibrary(),zip=new Zip();for(const [path,content] of Object.entries(pptxParts(img.width,img.height)))zip.file(path,content);zip.file('ppt/media/image1.png',uri.split(',')[1],{base64:true});return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
}
