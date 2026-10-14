import {useLayoutEffect,useRef,type ReactNode} from 'react';

// Native dialog supplies focus trapping and makes the editor iframe inert.
export default function Modal({label,busy=false,confirmChanges=true,onClose,children}:{label:string;busy?:boolean;confirmChanges?:boolean;onClose:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null),initial=useRef('');
  function values(){return JSON.stringify(Array.from(ref.current?.querySelectorAll('input,select,textarea')||[]).map(el=>{const field=el as HTMLInputElement;return [field.name,field.value,field.type==='checkbox'?field.checked:null];}));}
  useLayoutEffect(()=>{
    const opener=document.activeElement as HTMLElement|null,dialog=ref.current!;
    initial.current=values();dialog.showModal();
    return()=>{dialog.close();if(opener?.isConnected)opener.focus();};
  },[]);
  function cancel(){if(!busy&&(!confirmChanges||values()===initial.current||window.confirm('수정한 내용을 버리고 닫을까요?')))onClose();}
  return <dialog ref={ref} className="modal-shell" aria-label={label} onCancel={e=>{e.preventDefault();cancel();}} onKeyDown={e=>e.stopPropagation()} onKeyUp={e=>e.stopPropagation()} onClickCapture={e=>{if((e.target as HTMLElement).closest('[data-modal-close]')){e.preventDefault();e.stopPropagation();cancel();}}}>{children}</dialog>;
}
