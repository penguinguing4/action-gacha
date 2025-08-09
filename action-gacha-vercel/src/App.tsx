import React, { useEffect, useMemo, useRef, useState } from "react";

/********************** パレット *************************/
const PASTEL = {
  bg: "#F7F8F9",
  card: "#F2F3F4",
  pink: "#FADADD",
  blue: "#D6EAF8",
  green: "#D5F5E3",
  text: "#222",
  border: "#D0D3D4",
} as const;

/********************** 本データ *************************/
// ここでデフォルト表紙を設定（任意）。public/covers に画像を置けば表示されます。
const BOOKS: { id: keyof typeof BOOK_ACTIONS; title: string; cover: string }[] = [
  { id: "atomic",        title: "ジェームズ・クリアー式 複利で伸びる1つの習慣", cover: "/covers/atomic.jpg" },
  { id: "dream_elephant",title: "夢をかなえるゾウ",                           cover: "/covers/dream_elephant.jpg" },
  { id: "seven_habits",  title: "7つの習慣",                                   cover: "/covers/seven_habits.jpg" },
  { id: "carnegie",      title: "人を動かす",                                   cover: "/covers/carnegie.jpg" },
];

const BOOK_ACTIONS: Record<string, string[]> = {
  atomic: [
    "本を3ページ読む",
    "行動のトリガーを1つ書く",
    "机に本を置く（見える化）",
    "小さな改善を1つ記録",
    "寝る前5分の読書セット",
  ],
  dream_elephant: [
    "靴を磨く",
    "誰かに感謝を1つ送る",
    "財布を整理する",
    "行きたい場所を調べる",
    "やらないことを1つ決める",
  ],
  seven_habits: [
    "今日の最優先を1つ書く",
    "重要タスクに5分だけ着手",
    "影響の輪の行動を1つ実行",
    "週のゴールを1行書く",
    "家族/同僚を尊重する言葉を送る",
  ],
  carnegie: [
    "名前で挨拶する",
    "長所を1つ褒める",
    "3分だけ聞き役になる",
    "笑顔でありがとうを言う",
    "相手視点を1行メモ",
  ],
};

/********************** MetaMask系エラー無害化 *************************/
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError:boolean; msg:string}> {
  constructor(props:any){ super(props); this.state={hasError:false,msg:""}; }
  static getDerivedStateFromError(err:any){
    const m=String(err?.message||err||"");
    if(/metamask|ethereum/i.test(m)) return {hasError:false,msg:""};
    return {hasError:true,msg:m};
  }
  render(){
    if(this.state.hasError){
      return <div className="p-4 text-sm"><div className="mb-2 font-semibold">エラーが発生しました</div><div className="mb-3 whitespace-pre-wrap break-all">{this.state.msg}</div><div className="text-xs opacity-70">画面下の「データをリセット」をお試しください。</div></div>;
    }
    return this.props.children;
  }
}
function useSilenceExternalMetaMaskErrors(){
  useEffect(()=>{
    const onError=(e:any)=>{ try{ const msg=String(e?.message||e?.error?.message||""); if(/metamask|ethereum/i.test(msg)){ e.preventDefault?.(); return false; } }catch{} };
    const onRej=(e:any)=>{ try{ const r=e?.reason; const msg=typeof r==="string"?r:String(r?.message||""); if(/metamask|ethereum/i.test(msg)){ e.preventDefault?.(); return false; } }catch{} };
    window.addEventListener("error",onError as any);
    window.addEventListener("unhandledrejection",onRej as any);
    return ()=>{ window.removeEventListener("error",onError as any); window.removeEventListener("unhandledrejection",onRej as any); };
  },[]);
}

/********************** 小物ユーティリティ *************************/
function todayKey(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function safeGetItem(k:string,f:any=null){ try{ return window.localStorage.getItem(k);}catch{ return f; } }
function safeSetItem(k:string,v:string){ try{ window.localStorage.setItem(k,v);}catch{} }
function safeRemoveItem(k:string){ try{ window.localStorage.removeItem(k);}catch{} }
function useDailyCounter(key:string, def:number){
  const [state,setState]=useState<{date:string;value:number}>(()=>{
    try{ const raw=safeGetItem(key); if(!raw) return {date:todayKey(),value:def};
      const p=JSON.parse(raw); if(p?.date!==todayKey()) return {date:todayKey(),value:def}; return p;
    }catch{ return {date:todayKey(),value:def}; }
  });
  useEffect(()=>{ safeSetItem(key,JSON.stringify(state)); },[key,state]);
  return [state.value,(v:number)=>setState({date:todayKey(),value:v})] as const;
}

/********************** 画像（表紙） *************************/
function fileToDataURL(file:File){ return new Promise<string>((res,rej)=>{ const r=new FileReader(); r.onerror=()=>rej(new Error("read error")); r.onload=()=>res(String(r.result)); r.readAsDataURL(file); }); }
async function compressImageFile(file:File,maxDim=900,quality=0.85){
  try{ const dataUrl=await fileToDataURL(file); const img=new Image(); const p=new Promise<void>((r,j)=>{ img.onload=()=>r(); img.onerror=()=>j(new Error("img load error"));}); img.src=dataUrl; await p;
    const s=Math.min(1,maxDim/Math.max(img.width,img.height)); const w=Math.max(1,Math.round(img.width*s)); const h=Math.max(1,Math.round(img.height*s));
    const c=document.createElement("canvas"); c.width=w; c.height=h; const ctx=c.getContext("2d")!; ctx.drawImage(img,0,0,w,h); return c.toDataURL("image/jpeg",quality);
  }catch{ return await fileToDataURL(file); }
}
function useCoverStore(){
  const [covers,setCovers]=useState<Record<string,string>>(()=>{ const o:Record<string,string>={}; for(const b of BOOKS){ o[b.id]=safeGetItem(`cover_${b.id}`)||b.cover||""; } return o; });
  const setCover=(bookId:string,dataUrl:string)=>{ safeSetItem(`cover_${bookId}`,dataUrl); setCovers(prev=>({...prev,[bookId]:dataUrl})); };
  const resetAll=()=>{ for(const b of BOOKS) safeRemoveItem(`cover_${b.id}`); setCovers(Object.fromEntries(BOOKS.map(b=>[b.id,b.cover||""])) as Record<string,string>); };
  return {covers,setCover,resetAll};
}

/********************** UIパーツ *************************/
const PhoneFrame:React.FC<React.PropsWithChildren>=({children})=>(
  <div className="mx-auto max-w-[420px] rounded-2xl border shadow-md" style={{background:PASTEL.bg,borderColor:PASTEL.border}}>{children}</div>
);
const HeaderBar:React.FC<{title:string;right?:React.ReactNode}>=({title,right})=>(
  <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b" style={{background:PASTEL.card,borderColor:PASTEL.border}}>
    <div className="text-sm font-semibold tracking-wide">{title}</div><div className="text-xs opacity-80">{right}</div>
  </div>
);
const AdGate:React.FC<{open:boolean;onClose:()=>void;onComplete:()=>void}>=({open,onClose,onComplete})=>{
  const [count,setCount]=useState(5);
  useEffect(()=>{ if(open) setCount(5);},[open]);
  useEffect(()=>{ if(!open||count<=0) return; const t=setTimeout(()=>setCount(c=>c-1),1000); return ()=>clearTimeout(t);},[open,count]);
  useEffect(()=>{ if(open&&count===0) onComplete?.(); },[open,count,onComplete]);
  if(!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
    <div className="w-[90%] max-w-sm rounded-2xl p-5 border" style={{background:PASTEL.card,borderColor:PASTEL.border}}>
      <div className="text-base font-semibold mb-2">広告視聴</div>
      <div className="rounded-xl h-40 mb-3 grid place-items-center" style={{background:PASTEL.blue,border:`1px solid ${PASTEL.border}`}}>
        <div className="text-sm">動画再生中… {count}s</div>
      </div>
      <div className="flex gap-2 justify-end">
        <button className="px-3 py-2 text-xs rounded-lg border" onClick={onClose} style={{background:PASTEL.pink,borderColor:PASTEL.border}}>閉じる</button>
      </div>
    </div>
  </div>;
};
const PhotoProof:React.FC<{onSubmit:(f:File)=>void}>=({onSubmit})=>{
  const [file,setFile]=useState<File|null>(null);
  return <div className="p-4 space-y-3">
    <label className="block text-sm">証拠写真（任意）</label>
    <input className="w-full text-sm" type="file" accept="image/*" capture="environment" onChange={(e)=>setFile(e.target.files?.[0]||null)} />
    <button disabled={!file} onClick={()=>file&&onSubmit(file)} className="w-full px-4 py-3 rounded-xl border disabled:opacity-50" style={{background:PASTEL.green,borderColor:PASTEL.border}}>画像を送信して完了</button>
  </div>;
};
function BookCard({book,cover,onPick,onChangeCover}:{book:{id:string;title:string};cover:string;onPick:()=>void;onChangeCover:(id:string,dataUrl:string)=>void}){
  const inputRef=useRef<HTMLInputElement|null>(null);
  const openPicker=()=>inputRef.current?.click();
  const onFile=async(e:React.ChangeEvent<HTMLInputElement>)=>{ const f=e.target.files?.[0]; if(!f) return; const dataUrl=await compressImageFile(f,900,0.85); onChangeCover(book.id,dataUrl); e.target.value=""; };
  return <div className="shrink-0 w-36 select-none">
    <button onClick={onPick} className="block w-36 h-52 rounded-xl overflow-hidden border shadow-sm hover:opacity-90" style={{borderColor:PASTEL.border,background:PASTEL.card}}>
      {cover? <img src={cover} alt={book.title} className="w-full h-full object-cover"/>:
        <div className="w-full h-full grid place-items-center text-[11px] px-2" style={{background:PASTEL.blue}}>表紙画像を設定</div>}
    </button>
    <div className="mt-2 text-[11px] line-clamp-2 h-8">{book.title}</div>
    <div className="mt-1 space-y-1">
      <button onClick={openPicker} className="w-full text-[10px] px-2 py-1 rounded-lg border" style={{background:PASTEL.pink,borderColor:PASTEL.border}}>表紙を変更（ダイアログ）</button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile}/>
      <input type="file" accept="image/*" onChange={onFile} className="block w-full text-[10px]"/>
    </div>
  </div>;
}
function BookShelf({books,covers,onPick,onChangeCover}:{books:{id:string;title:string}[];covers:Record<string,string>;onPick:(id:string)=>void;onChangeCover:(id:string,dataUrl:string)=>void}){
  return <section className="mb-5">
    <h3 className="px-4 py-2 font-semibold border-b" style={{borderColor:PASTEL.border}}>おすすめの本</h3>
    <div className="px-3 py-3 overflow-x-auto">
      <div className="flex gap-3">
        {books.map(b=><BookCard key={b.id} book={b} cover={covers[b.id]} onPick={()=>onPick(b.id)} onChangeCover={onChangeCover}/>)}
      </div>
    </div>
  </section>;
}

/********************** App *************************/
export default function App(){
  useSilenceExternalMetaMaskErrors();
  const {covers,setCover,resetAll}=useCoverStore();

  const [freeDraws,setFreeDraws]=useDailyCounter("free_draws",3);
  const [selectedBookId,setSelectedBookId]=useState<string|null>(null);
  const selectedBook=useMemo(()=>BOOKS.find(b=>b.id===selectedBookId)||BOOKS[0],[selectedBookId]);

  // phases: home | play | proof | cleared
  const [phase,setPhase]=useState<"home"|"play"|"proof"|"cleared">("home");
  const [currentAction,setCurrentAction]=useState("");
  const [logs,setLogs]=useState<{date:string;book:string;action:string;proofName?:string}[]>(()=>{ try{ return JSON.parse(safeGetItem("mvp_logs")||"[]"); }catch{ return []; } });

  const [showAdGate,setShowAdGate]=useState(false);
  const [showAdAsk,setShowAdAsk]=useState(false);

  const DEFAULT_SECONDS=60;
  const [remain,setRemain]=useState(DEFAULT_SECONDS);
  const [running,setRunning]=useState(false);

  useEffect(()=>{ safeSetItem("mvp_logs",JSON.stringify(logs)); },[logs]);

  const rollAction=(bookId:string)=>{
    const pool=BOOK_ACTIONS[bookId]||[];
    const pick=pool[Math.floor(Math.random()*pool.length)]||"";
    setCurrentAction(pick);
    setRemain(DEFAULT_SECONDS);
    setRunning(true); // 強制スタート
  };

  const consumeOrAskAdThenRoll=(bookId:string)=>{
    if(freeDraws<=0){ setShowAdAsk(true); return; }
    setFreeDraws(freeDraws-1);
    rollAction(bookId);
  };

  const startBookPlay=(bookId:string)=>{
    setSelectedBookId(bookId);
    setPhase("play");
    consumeOrAskAdThenRoll(bookId);
  };

  const pushLog=(extra:any={})=>{
    const entry={date:new Date().toISOString(),book:selectedBook.title,action:currentAction,...extra};
    setLogs(prev=>[entry,...prev]);
  };

  useEffect(()=>{ if(!running||remain<=0) return; const t=setTimeout(()=>setRemain(v=>v-1),1000); return ()=>clearTimeout(t); },[running,remain]);

  const AdAskDialog:React.FC<{open:boolean;onClose:()=>void;onYes:()=>void;onVip:()=>void}>=({open,onClose,onYes,onVip})=>{
    if(!open) return null;
    return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="w-[90%] max-w-sm rounded-2xl p-5 border relative" style={{background:PASTEL.card,borderColor:PASTEL.border}}>
        <button onClick={onClose} className="absolute right-3 top-3 text-xs px-2 py-1 rounded border" style={{background:"#fff",borderColor:PASTEL.border}}>戻る</button>
        <div className="text-base font-semibold mb-2">広告を見ますか？</div>
        <div className="text-xs opacity-80 mb-4">本日の無料ガチャ回数がありません。広告を視聴すると本日の残り回数が <b>+3</b> されます。</div>
        <div className="flex flex-col gap-2">
          <button onClick={onYes} className="w-full px-4 py-2 rounded-xl border" style={{background:PASTEL.green,borderColor:PASTEL.border}}>はい（+3してガチャ）</button>
          <button onClick={onVip} className="w-full px-4 py-2 rounded-xl border" style={{background:PASTEL.pink,borderColor:PASTEL.border}}>VIP（広告なし・課金案内）</button>
        </div>
      </div>
    </div>;
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen w-full py-6" style={{background:PASTEL.bg}}>
        <PhoneFrame>
          <HeaderBar title="行動ガチャ MVP" right={<span className="text-xs">本日無料ガチャ: {freeDraws}</span>} />

          {phase==="home" && (
            <div className="p-0">
              <BookShelf books={BOOKS} covers={covers} onPick={startBookPlay} onChangeCover={setCover}/>
              <div className="px-4 pb-3 flex items-center gap-2">
                <button className="px-3 py-2 text-xs rounded-lg border" onClick={()=>{ safeRemoveItem("mvp_logs"); safeRemoveItem("free_draws"); (resetAll)(); try{ window.location.reload(); }catch{}; }} style={{background:PASTEL.card,borderColor:PASTEL.border}}>
                  データをリセット（履歴・表紙・ガチャ回数）
                </button>
              </div>
            </div>
          )}

          {phase==="play" && (
            <div className="relative">
              <div className="absolute right-3 top-3 flex items-center gap-2 z-10">
                <button onClick={()=>setPhase("home")} className="text-[10px] px-2 py-1 rounded border" style={{background:"#fff",borderColor:PASTEL.border}}>戻る</button>
                <button onClick={()=>setRunning(false)} title="停止" className="text-[10px] w-6 h-6 rounded border grid place-items-center" style={{background:"#fff",borderColor:PASTEL.border}}>■</button>
              </div>

              <div className="px-4 pt-10 text-sm opacity-80">選択中の本：{selectedBook.title}</div>

              <div className="p-4 pt-2 space-y-4">
                <div className="rounded-2xl grid place-items-center h-36 border text-center px-4" style={{background:PASTEL.blue,borderColor:PASTEL.border}}>
                  <div className="text-base font-medium">{currentAction || "ガチャ準備中…"}</div>
                </div>
                <div className="rounded-2xl grid place-items-center h-24 border" style={{background:PASTEL.card,borderColor:PASTEL.border}}>
                  <div className="text-lg font-semibold">残り時間 {String(Math.floor(remain/60)).padStart(2,"0")}:{String(remain%60).padStart(2,"0")}</div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={()=>setRunning(r=>!r)} className="text-xs px-3 py-1 rounded border" style={{background:"#fff",borderColor:PASTEL.border}}>{running?"一時停止":"再開"}</button>
                  </div>
                </div>
              </div>

              {/* 縦配置：上=完了 / 下=ガチャ */}
              <div className="p-4 pt-0 flex flex-col gap-2">
                <button onClick={()=>setPhase("proof")} className="w-full px-4 py-3 rounded-xl border" style={{background:PASTEL.green,borderColor:PASTEL.border}}>完了</button>
                <button onClick={()=>consumeOrAskAdThenRoll(selectedBook.id)} className="w-full px-4 py-3 rounded-xl border" style={{background:PASTEL.card,borderColor:PASTEL.border}}>ガチャを回す</button>
              </div>
            </div>
          )}

          {phase==="proof" && (
            <div>
              <div className="px-4 pt-3 text-sm opacity-80">完了したら写真を送って記録します</div>
              <PhotoProof onSubmit={(file)=>{ pushLog({proofName:file.name}); setPhase("cleared"); }} />
            </div>
          )}

          <div className="p-4">
            <div className="text-sm font-semibold mb-2">最近の達成</div>
            <ul className="space-y-2 max-h-48 overflow-auto pr-1">
              {logs.map((l,i)=>(
                <li key={i} className="p-2 rounded-lg border text-xs" style={{background:PASTEL.card,borderColor:PASTEL.border}}>
                  <div className="font-semibold">{l.book} / {l.action}</div>
                  <div className="opacity-70">{new Date(l.date).toLocaleString()} / {l.proofName?`画像: ${l.proofName}`:"画像なし"}</div>
                </li>
              ))}
              {logs.length===0 && (<li className="text-xs opacity-60">まだ達成ログがありません</li>)}
            </ul>
          </div>

          {/* 広告視聴擬似 */}
          <AdGate
            open={showAdGate}
            onClose={()=>setShowAdGate(false)}
            onComplete={()=>{
              setShowAdGate(false);
              setFreeDraws(prev=>{
                const v=typeof prev==="number"?prev:0;
                const added=v+3;
                const afterConsume=Math.max(0,added-1);
                setTimeout(()=>rollAction(selectedBook.id),0);
                return afterConsume;
              });
            }}
          />

          {/* 広告視聴ダイアログ */}
          <AdAskDialog
            open={showAdAsk}
            onClose={()=>setShowAdAsk(false)}
            onVip={()=>{ setShowAdAsk(false); /* VIP誘導は後日 */ }}
            onYes={()=>{ setShowAdAsk(false); setShowAdGate(true); }}
          />
        </PhoneFrame>
      </div>
    </ErrorBoundary>
  );
}
