import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {LiveViewer} from './LiveShare.tsx';
import './style.css';

const token=/^#view=([a-f0-9]{64})$/.exec(location.hash)?.[1];
const owner=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
createRoot(document.getElementById('root')!).render(<React.StrictMode>{token?<LiveViewer token={token}/>:owner?<App/>:<main><header><strong>Flow Studio · 보기 전용 공유</strong></header><p style={{padding:24}}>발표자가 전달한 공유 링크로 접속하세요.</p></main>}</React.StrictMode>);
