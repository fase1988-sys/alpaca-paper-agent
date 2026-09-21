import http from "node:http";

const PORT=Number(process.env.PORT||3000);
const PAPER_BASE="https://paper-api.alpaca.markets";
const DATA_BASE="https://data.alpaca.markets";
const KEY=process.env.ALPACA_API_KEY;
const SECRET=process.env.ALPACA_SECRET_KEY;
const ENABLE=process.env.ENABLE_PAPER_ORDERS==="true";
const MAX_POSITION_PCT=Number(process.env.MAX_POSITION_PCT||"0.12");
const MAX_DAILY_DRAWDOWN_PCT=Number(process.env.MAX_DAILY_DRAWDOWN_PCT||"0.03");
const SYMBOLS=(process.env.SYMBOLS||"SPY,QQQ,AMD,NVDA,META,COIN").split(",").map(s=>s.trim()).filter(Boolean);
let state={status:"starting",lastScan:null,signals:[],errors:[],paperOnly:true};

function headers(){return {"APCA-API-KEY-ID":KEY,"APCA-API-SECRET-KEY":SECRET,"Content-Type":"application/json"}}
async function api(base,path,opts={}){const r=await fetch(base+path,{...opts,headers:{...headers(),...(opts.headers||{})}});if(!r.ok)throw new Error(path+" "+r.status+" "+await r.text());return r.json()}
async function account(){return api(PAPER_BASE,"/v2/account")}
async function positions(){return api(PAPER_BASE,"/v2/positions")}
async function bars(symbol){const end=new Date(),start=new Date(end-1000*60*60*8);const q=new URLSearchParams({timeframe:"5Min",start:start.toISOString(),end:end.toISOString(),limit:"100",feed:"iex"});const x=await api(DATA_BASE,`/v2/stocks/${symbol}/bars?${q}`);return x.bars||[]}
function signal(symbol,b){if(b.length<25)return null;const c=b.map(x=>x.c),v=b.map(x=>x.v);const last=c.at(-1),sma20=c.slice(-20).reduce((a,x)=>a+x,0)/20,prev=c.at(-7);const mom=(last/prev-1),avgV=v.slice(-20).reduce((a,x)=>a+x,0)/20,vr=v.at(-1)/(avgV||1);if(last>sma20&&mom>0.008&&vr>1.15)return {symbol,side:"buy",price:last,momentum:mom,volumeRatio:vr};return null}
async function submit(sig,acct,pos){if(!ENABLE)return {dryRun:true};const equity=Number(acct.equity),existing=pos.find(p=>p.symbol===sig.symbol);if(existing)return {skipped:"already-positioned"};const notional=Math.max(100,Math.floor(equity*MAX_POSITION_PCT));return api(PAPER_BASE,"/v2/orders",{method:"POST",body:JSON.stringify({symbol:sig.symbol,notional,side:"buy",type:"market",time_in_force:"day",client_order_id:`agent-${sig.symbol}-${Date.now()}`})})}
async function scan(){if(!KEY||!SECRET){state.status="waiting-for-credentials";return}try{const acct=await account();const eq=Number(acct.equity),last=Number(acct.last_equity||eq);if(last&&eq/last-1<=-MAX_DAILY_DRAWDOWN_PCT){state={...state,status:"risk-halt",lastScan:new Date().toISOString(),equity:eq};return}const pos=await positions(),signals=[];for(const s of SYMBOLS){try{const b=await bars(s),sig=signal(s,b);if(sig){sig.action=await submit(sig,acct,pos);signals.push(sig)}}catch(e){state.errors=[String(e)].concat(state.errors).slice(0,10)}}state={...state,status:"running",lastScan:new Date().toISOString(),equity:eq,positions:pos.map(p=>({symbol:p.symbol,qty:p.qty,market_value:p.market_value,unrealized_pl:p.unrealized_pl})),signals};}catch(e){state.status="error";state.errors=[String(e)].concat(state.errors).slice(0,10)}}
setInterval(scan,15000);scan();
http.createServer((req,res)=>{res.setHeader("content-type","application/json");if(req.url==="/health")res.end(JSON.stringify({ok:true,status:state.status,paperOnly:true}));else res.end(JSON.stringify(state,null,2))}).listen(PORT,()=>console.log(`alpaca-paper-agent :${PORT} PAPER ONLY orders=${ENABLE}`));
