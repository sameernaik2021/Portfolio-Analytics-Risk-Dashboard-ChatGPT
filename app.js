(() => {
"use strict";

/* Portfolio Analytics & Risk Dashboard
   Self-contained browser implementation. No network dependencies.
   All demo time series are synthetic and clearly labeled. */

const $ = id => document.getElementById(id);
const COLORS = ["#4dd4ff","#7c8cff","#36d399","#f5b83d","#ff6b7a","#c18cff","#66d9a6","#ff9f68","#73a5ff","#e5e7eb"];
const DEMO = [
 {symbol:"RELIANCE",name:"Reliance Industries",assetType:"Equity",sector:"Energy",quantity:50,avgCost:2400,currentPrice:2700,beta:1.05,volatility:25,targetPct:18},
 {symbol:"HDFCBANK",name:"HDFC Bank",assetType:"Equity",sector:"Financials",quantity:30,avgCost:1600,currentPrice:1750,beta:.92,volatility:22,targetPct:12},
 {symbol:"INFY",name:"Infosys",assetType:"Equity",sector:"IT",quantity:40,avgCost:1400,currentPrice:1550,beta:.88,volatility:24,targetPct:12},
 {symbol:"NIFTYETF",name:"Nifty 50 ETF",assetType:"Equity",sector:"Broad Market",quantity:100,avgCost:210,currentPrice:235,beta:1,volatility:18,targetPct:18},
 {symbol:"GOLDETF",name:"Gold ETF",assetType:"Gold",sector:"Gold",quantity:120,avgCost:52,currentPrice:59,beta:.05,volatility:15,targetPct:10},
 {symbol:"BOND",name:"Government Bond Fund",assetType:"Bonds",sector:"Fixed Income",quantity:600,avgCost:100,currentPrice:104,beta:-.05,volatility:5,targetPct:25},
 {symbol:"CASH",name:"Cash",assetType:"Cash",sector:"Cash",quantity:1,avgCost:52000,currentPrice:52000,beta:0,volatility:0,targetPct:5}
];
let holdings = clone(DEMO);
let series = buildDemoSeries();
let benchmark = buildDemoBenchmark(series);
let state = {riskFree:.065, tolerance:"moderate", band:5};

function clone(x){return JSON.parse(JSON.stringify(x));}
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
function sum(a){return a.reduce((x,y)=>x+y,0);}
function mean(a){return a.length?sum(a)/a.length:0;}
function stdev(a, sample=true){if(a.length<2)return 0; const m=mean(a),v=sum(a.map(x=>(x-m)**2))/(a.length-(sample?1:0));return Math.sqrt(Math.max(v,0));}
function fmtINR(x,compact=false){if(!Number.isFinite(x))return "—"; if(compact){const ax=Math.abs(x); if(ax>=1e7)return "₹"+(x/1e7).toFixed(2)+" Cr"; if(ax>=1e5)return "₹"+(x/1e5).toFixed(2)+" L"; if(ax>=1e3)return "₹"+(x/1e3).toFixed(1)+"K";} return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(x);}
function fmtPct(x,d=2){return Number.isFinite(x)?(x*100).toFixed(d)+"%":"—";}
function fmtNum(x,d=2){return Number.isFinite(x)?x.toFixed(d):"—";}
function parseNum(v, fallback=0){const n=Number(String(v).replace(/,/g,""));return Number.isFinite(n)?n:fallback;}

function buildDemoSeries(){
  // Deterministic synthetic portfolio index for reproducible demonstrations.
  const n=252, out=[100]; let seed=73921;
  const rnd=()=>{seed=(1664525*seed+1013904223)>>>0; return seed/4294967296;};
  for(let i=1;i<n;i++){
    const z=Math.sqrt(-2*Math.log(Math.max(rnd(),1e-12)))*Math.cos(2*Math.PI*rnd());
    const cyc=.00018*Math.sin(i/17);
    const r=.00045 + cyc + .0087*z;
    out.push(out[out.length-1]*(1+r));
  }
  return out;
}
function buildDemoBenchmark(portfolioPrices){
  // A noisy benchmark with non-zero variance; deliberately synthetic.
  const n=portfolioPrices.length, pr=returnsFromPrices(portfolioPrices), out=[100]; let seed=18421;
  const rnd=()=>{seed=(1103515245*seed+12345)>>>0; return seed/4294967296;};
  for(let i=0;i<pr.length;i++){
    const z=Math.sqrt(-2*Math.log(Math.max(rnd(),1e-12)))*Math.cos(2*Math.PI*rnd());
    const rb=.72*pr[i] + .0016*z + .00008;
    out.push(out[out.length-1]*(1+rb));
  }
  return out;
}
function returnsFromPrices(prices){const r=[];for(let i=1;i<prices.length;i++) if(prices[i-1]>0)r.push(prices[i]/prices[i-1]-1);return r;}
function percentile(a,p){if(!a.length)return NaN;const s=[...a].sort((x,y)=>x-y),k=(s.length-1)*p,f=Math.floor(k),c=Math.ceil(k);return f===c?s[f]:s[f]+(s[c]-s[f])*(k-f);}
function quantile(a,p){return percentile(a,p);}
function covariance(a,b){const n=Math.min(a.length,b.length);if(n<2)return 0;const ma=mean(a.slice(0,n)),mb=mean(b.slice(0,n));let v=0;for(let i=0;i<n;i++)v+=(a[i]-ma)*(b[i]-mb);return v/(n-1);}
function correlation(a,b){const den=stdev(a)*stdev(b);return den?covariance(a,b)/den:0;}
function xirr(cashflows){
  if(cashflows.length<2)return NaN;
  const dates=cashflows.map(x=>new Date(x.date).getTime()), d0=dates[0];
  const f=r=>sum(cashflows.map((cf,i)=>cf.amount/Math.pow(1+r,(dates[i]-d0)/31557600000)));
  let lo=-0.9999,hi=10, flo=f(lo),fhi=f(hi);
  for(let k=0;k<80 && flo*fhi>0;k++){hi*=2;fhi=f(hi);}
  if(flo*fhi>0)return NaN;
  for(let i=0;i<150;i++){const mid=(lo+hi)/2,fm=f(mid);if(Math.abs(fm)<1e-7)return mid;if(flo*fm<=0){hi=mid;fhi=fm}else{lo=mid;flo=fm;}}
  return (lo+hi)/2;
}
function maxDrawdown(values){
  let peak=-Infinity,maxDD=0,peakIdx=0,troughIdx=0,tmpPeak=0;
  values.forEach((v,i)=>{if(v>peak){peak=v;tmpPeak=i;}const dd=v/peak-1;if(dd<maxDD){maxDD=dd;peakIdx=tmpPeak;troughIdx=i;}});
  return {dd:maxDD,peakIdx,troughIdx};
}
function assumedCorrelation(a,b){
  if(a===b)return 1;
  if(a==="Cash"||b==="Cash")return 0;
  if(a==="Equity"&&b==="Equity")return .55;
  if((a==="Equity"&&b==="Bonds")||(a==="Bonds"&&b==="Equity"))return -.10;
  if((a==="Equity"&&b==="Gold")||(a==="Gold"&&b==="Equity"))return .05;
  if((a==="Bonds"&&b==="Gold")||(a==="Gold"&&b==="Bonds"))return .12;
  if(a==="Bonds"&&b==="Bonds")return .30;
  if(a==="Gold"&&b==="Gold")return .35;
  return .20;
}
function covarianceMatrixFromHoldings(h){
  const n=h.length, vols=h.map(x=>Math.max(0,x.volatility||0)/100/Math.sqrt(252));
  return Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>assumedCorrelation(h[i].assetType,h[j].assetType)*vols[i]*vols[j]));
}
function portfolioRisk(h){
  const values=h.map(x=>x.quantity*x.currentPrice), total=sum(values)||1,w=values.map(v=>v/total), C=covarianceMatrixFromHoldings(h);
  const dailyVar=w.reduce((a,wi,i)=>a+wi*w.reduce((b,wj,j)=>b+wj*C[i][j],0),0);
  const annVol=Math.sqrt(Math.max(dailyVar,0))*Math.sqrt(252);
  const marginal=C.map((row,i)=>sum(row.map((c,j)=>c*w[j])));
  const rc=w.map((wi,i)=>annVol?wi*marginal[i]/Math.sqrt(Math.max(dailyVar,1e-20)):0);
  return {values,total,w,C,annVol,marginal,riskContrib:rc,riskPct:rc.map(x=>annVol?x/annVol:0)};
}
function weightedBeta(h,w){return sum(h.map((x,i)=>w[i]*(x.beta||0)));}
function weightedReturn(h){const vals=h.map(x=>x.quantity*x.currentPrice), total=sum(vals)||1;return sum(h.map((x,i)=>vals[i]/total*((x.currentPrice/(x.avgCost||x.currentPrice))-1)));}
function assetGroups(h,key){
  const vals=h.map(x=>x.quantity*x.currentPrice), total=sum(vals)||1, out={};
  h.forEach((x,i)=>{const k=x[key]||"Other";out[k]=(out[k]||0)+vals[i]/total;});return out;
}
function portfolioStats(){
  const r=portfolioRisk(holdings), daily=returnsFromPrices(series), benchR=returnsFromPrices(benchmark);
  const annReturn=Math.pow(series[series.length-1]/series[0],252/(series.length-1))-1;
  const downside=stdev(daily.filter(x=>x<state.riskFree/252),false)*Math.sqrt(252);
  const sharpe= r.annVol ? (annReturn-state.riskFree)/r.annVol : NaN;
  const sortino=downside ? (annReturn-state.riskFree)/downside : NaN;
  const dd=maxDrawdown(series);
  const var95=-quantile(daily,.05), tail=daily.filter(x=>x<=quantile(daily,.05)), cvar95=-mean(tail);
  const beta=correlation(daily,benchR)*stdev(daily)/Math.max(stdev(benchR),1e-12);
  const tracking=stdev(daily.map((x,i)=>x-(benchR[i]||0)))*Math.sqrt(252);
  const hhi=sum(r.w.map(x=>x*x)), effective=1/hhi;
  return {...r,daily,benchR,annReturn,downside,sharpe,sortino,dd,var95,cvar95,beta,tracking,hhi,effective,
    absoluteReturn:weightedReturn(holdings)};
}
function renderKpis(s){
  const gain=s.values.reduce((a,v,i)=>a+v-holdings[i].quantity*holdings[i].avgCost,0), invested=sum(holdings.map(x=>x.quantity*x.avgCost));
  const items=[
    ["Portfolio value",fmtINR(s.total,true),"Current market value"],
    ["Invested cost",fmtINR(invested,true),"Cost basis"],
    ["Unrealized P&L",fmtINR(gain,true),fmtPct(gain/Math.max(invested,1))],
    ["Annualized return",fmtPct(s.annReturn),"Based on demo/imported series"],
    ["Annualized volatility",fmtPct(s.annVol),"Estimated from supplied assumptions"],
    ["Max drawdown",fmtPct(s.dd.dd),"Historical series drawdown"]
  ];
  $("kpis").innerHTML=items.map((x,i)=>`<div class="card kpi"><div class="label">${x[0]}</div><div class="value ${i===2&&gain<0?"negative":i===2?"positive":""}">${x[1]}</div><div class="sub">${x[2]}</div></div>`).join("");
  $("periodPill").textContent=`${series.length-1} periods • synthetic/demo`;
}
function renderRisk(s){
  const rows=[
    ["Sharpe ratio",fmtNum(s.sharpe),"Return per unit of total volatility"],
    ["Sortino ratio",fmtNum(s.sortino),"Return per unit of downside deviation"],
    ["Portfolio beta",fmtNum(s.beta),"Historical sensitivity to benchmark"],
    ["VaR 95%",fmtPct(s.var95),"One-period historical loss threshold"],
    ["CVaR 95%",fmtPct(s.cvar95),"Average loss in worst 5%"],
    ["Tracking error",fmtPct(s.tracking),"Active return variability"],
    ["Effective holdings",fmtNum(s.effective,1),"1 / concentration HHI"],
    ["Risk-free rate",fmtPct(state.riskFree),"Configurable assumption"]
  ];
  $("riskMetrics").innerHTML=rows.map(r=>`<div class="metric"><b>${r[0]}</b><span>${r[1]}</span><small>${r[2]}</small></div>`).join("");
}
function renderConcentration(s){
  const sec=assetGroups(holdings,"sector"), assets=assetGroups(holdings,"assetType"), sorted=Object.entries(sec).sort((a,b)=>b[1]-a[1]);
  const largest=sorted[0]||["—",0], top2=sum(sorted.slice(0,2).map(x=>x[1]));
  $("concentration").innerHTML=`
    <div class="signal"><div class="icon">◉</div><div><b>Largest security</b><small>${holdings[s.w.indexOf(Math.max(...s.w))]?.name||"—"} • ${fmtPct(Math.max(...s.w))}</small></div></div>
    <div class="signal"><div class="icon">◫</div><div><b>Largest sector</b><small>${largest[0]} • ${fmtPct(largest[1])}</small></div></div>
    <div class="signal"><div class="icon">Σ</div><div><b>Top two sectors</b><small>${fmtPct(top2)} of portfolio</small></div></div>
    <div class="signal"><div class="icon">1/N</div><div><b>Effective number</b><small>${fmtNum(s.effective,1)} holdings-equivalent</small></div></div>
    <div style="margin-top:10px">${Object.entries(assets).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="statbar"><div class="row"><span>${k}</span><b>${fmtPct(v)}</b></div><div class="bar"><i style="width:${clamp(v*100,0,100)}%;background:${COLORS[Object.keys(assets).indexOf(k)%COLORS.length]}"></i></div></div>`).join("")}</div>`;
}
function renderSignals(s){
  const target=assetGroups(holdings,"assetType"), byTarget={}; holdings.forEach(x=>byTarget[x.assetType]=(byTarget[x.assetType]||0)+(x.targetPct||0)/100);
  const signals=[];
  Object.keys({...target,...byTarget}).forEach(k=>{const d=(target[k]||0)-(byTarget[k]||0);if(Math.abs(d)>state.band/100)signals.push([d>0?"↑":"↓",`${k} allocation drift`,`${fmtPct(Math.abs(d))} ${d>0?"above":"below"} target`,d>0?"warn":"bad"]);});
  const maxW=Math.max(...s.w); if(maxW>.25)signals.push(["!", "Single-security concentration",`Largest holding is ${fmtPct(maxW)} of portfolio`,"bad"]);
  if(s.cvar95>.03)signals.push(["⚠","Tail-loss sensitivity",`Historical CVaR at 95% is ${fmtPct(s.cvar95)} per period`,"warn"]);
  if(!signals.length)signals.push(["✓","No threshold breaches","Portfolio is within configured drift/concentration review bands","good"]);
  $("signals").innerHTML=signals.slice(0,6).map(x=>`<div class="signal"><div class="icon ${x[3]}">${x[0]}</div><div><b>${x[1]}</b><small>${x[2]}</small></div></div>`).join("");
}
function canvasSetup(c){
  const dpr=window.devicePixelRatio||1, r=c.getBoundingClientRect(), w=Math.max(10,r.width),h=Math.max(10,r.height);
  c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);const ctx=c.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w,h};
}
function lineChart(id,a,b){
  const {ctx,w,h}=canvasSetup($(id));ctx.clearRect(0,0,w,h);
  const pad={l:45,r:18,t:18,b:30}, W=w-pad.l-pad.r,H=h-pad.t-pad.b;
  const all=[...a,...b], lo=Math.min(...all),hi=Math.max(...all), span=hi-lo||1;
  ctx.font="11px system-ui";ctx.strokeStyle="#1d3550";ctx.fillStyle="#829ab2";ctx.lineWidth=1;
  for(let k=0;k<5;k++){const y=pad.t+H*k/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText((hi-span*k/4).toFixed(0),5,y+4);}
  const draw=(arr,color)=>{ctx.strokeStyle=color;ctx.lineWidth=2.2;ctx.beginPath();arr.forEach((v,i)=>{const x=pad.l+W*i/(arr.length-1),y=pad.t+H*(hi-v)/span;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()};
  draw(a,COLORS[0]);draw(b,COLORS[1]);ctx.fillStyle=COLORS[0];ctx.fillText("Portfolio",pad.l,12);ctx.fillStyle=COLORS[1];ctx.fillText("Benchmark",pad.l+78,12);
}
function donutChart(id,groups){
  const {ctx,w,h}=canvasSetup($(id));ctx.clearRect(0,0,w,h);const vals=Object.entries(groups).sort((a,b)=>b[1]-a[1]);const total=sum(vals.map(x=>x[1]));let ang=-Math.PI/2,cx=w/2,cy=h/2,r=Math.min(w,h)*.34;
  vals.forEach((x,i)=>{const da=2*Math.PI*x[1]/total;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,ang,ang+da);ctx.closePath();ctx.fillStyle=COLORS[i%COLORS.length];ctx.fill();ang+=da});
  ctx.globalCompositeOperation="destination-out";ctx.beginPath();ctx.arc(cx,cy,r*.58,0,2*Math.PI);ctx.fill();ctx.globalCompositeOperation="source-over";
  ctx.fillStyle="#eaf2fb";ctx.font="700 18px system-ui";ctx.textAlign="center";ctx.fillText(fmtPct(total),cx,cy+4);ctx.font="10px system-ui";ctx.fillStyle="#91a7bf";ctx.fillText("allocated",cx,cy+20);ctx.textAlign="left";
  $("allocationLegend").innerHTML=vals.map((x,i)=>`<div class="legend-row"><span><i class="dot" style="background:${COLORS[i%COLORS.length]}"></i>${x[0]}</span><b>${fmtPct(x[1])}</b></div>`).join("");
}
function barChart(id,labels,vals){
  const {ctx,w,h}=canvasSetup($(id));ctx.clearRect(0,0,w,h);const pad={l:44,r:16,t:20,b:48},W=w-pad.l-pad.r,H=h-pad.t-pad.b,max=Math.max(...vals,0.001);
  ctx.font="10px system-ui";ctx.fillStyle="#829ab2";ctx.strokeStyle="#1d3550";
  for(let k=0;k<4;k++){const y=pad.t+H*k/3;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText((max*(1-k/3)*100).toFixed(0)+"%",4,y+3);}
  const bw=Math.min(55,W/Math.max(vals.length,1)*.65);
  vals.forEach((v,i)=>{const x=pad.l+(i+.5)*W/vals.length,y=pad.t+H*(1-v/max);ctx.fillStyle=COLORS[i%COLORS.length];ctx.fillRect(x-bw/2,y,bw,pad.t+H-y);ctx.fillStyle="#a7bbce";ctx.textAlign="center";ctx.fillText(labels[i].slice(0,12),x,h-28);ctx.fillText((v*100).toFixed(1)+"%",x,y-6)});ctx.textAlign="left";
}
function drawDrawdown(id,values){
  const dd=[];let peak=-Infinity;values.forEach(v=>{peak=Math.max(peak,v);dd.push(v/peak-1)});
  const {ctx,w,h}=canvasSetup($(id));ctx.clearRect(0,0,w,h);const pad={l:45,r:16,t:20,b:28},W=w-pad.l-pad.r,H=h-pad.t-pad.b,min=Math.min(...dd,0);
  ctx.strokeStyle="#1d3550";ctx.beginPath();ctx.moveTo(pad.l,pad.t);ctx.lineTo(w-pad.r,pad.t);ctx.stroke();ctx.fillStyle="#829ab2";ctx.font="10px system-ui";ctx.fillText("0%",5,pad.t+4);ctx.fillText((min*100).toFixed(0)+"%",5,pad.t+H);
  ctx.beginPath();dd.forEach((v,i)=>{const x=pad.l+W*i/(dd.length-1),y=pad.t+H*(v/min||0);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.lineTo(w-pad.r,pad.t);ctx.closePath();ctx.fillStyle="rgba(255,107,122,.20)";ctx.fill();ctx.strokeStyle=COLORS[4];ctx.lineWidth=2;ctx.beginPath();dd.forEach((v,i)=>{const x=pad.l+W*i/(dd.length-1),y=pad.t+H*(v/min||0);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();
}
function renderCorrelation(s){
  const names=holdings.map(x=>x.symbol), n=names.length;
  $("corrHeatmap").style.setProperty("--n",n);
  let html=`<div class="heat-row"><div></div>${names.map(x=>`<div class="heat-cell heat-label">${x}</div>`).join("")}</div>`;
  for(let i=0;i<n;i++){
    html+=`<div class="heat-row"><div class="heat-cell heat-label">${names[i]}</div>`;
    for(let j=0;j<n;j++){
      const vi=(holdings[i].volatility||0)/100/Math.sqrt(252), vj=(holdings[j].volatility||0)/100/Math.sqrt(252);
      const c=(i===j||vi===0||vj===0)?(i===j?1:0):s.C[i][j]/(vi*vj);
      const bg=`rgba(${c<0?255:77},${c<0?107:212},${c<0?122:255},${.15+.65*Math.abs(c)})`;
      html+=`<div class="heat-cell" style="background:${bg}" title="${names[i]} vs ${names[j]}: ${c.toFixed(2)}">${c.toFixed(2)}</div>`;
    }
    html+="</div>";
  }
  $("corrHeatmap").innerHTML=html;
}
function renderStress(s){
  const scenarios=[["Equity −10%",{Equity:-.10,Bonds:0,Gold:.03,Cash:0}],["Equity −20%",{Equity:-.20,Bonds:-.02,Gold:.05,Cash:0}],["Rates +1%",{Equity:-.04,Bonds:-.06,Gold:0,Cash:0}],["Gold +10%",{Equity:0,Bonds:0,Gold:.10,Cash:0}]];
  const ag=assetGroups(holdings,"assetType");let rows=scenarios.map(([name,shock])=>{const impact=sum(Object.entries(shock).map(([k,v])=>(ag[k]||0)*v));return [name,impact,s.total*(1+impact)];});
  $("stressTable").innerHTML=`<div class="table-wrap"><table><thead><tr><th>Scenario</th><th>Estimated impact</th><th>Illustrative value</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td class="${r[1]<0?"negative":"positive"}">${fmtPct(r[1])}</td><td>${fmtINR(r[2],true)}</td></tr>`).join("")}</tbody></table></div><p class="empty">Scenario impacts are linear shock assumptions on current weights; they do not model path dependency, correlations, liquidity, options, taxes or nonlinear instruments.</p>`;
}
function renderRebalance(s){
  const by={};holdings.forEach(x=>{const v=x.quantity*x.currentPrice;by[x.assetType]=(by[x.assetType]||0)+v;});
  const total=s.total, targets={};holdings.forEach(x=>targets[x.assetType]=(targets[x.assetType]||0)+(x.targetPct||0)/100);
  const rows=Object.keys({...by,...targets}).map(k=>{const cur=(by[k]||0)/total,t=targets[k]||0,d=cur-t,chg=-d*total;return [k,cur,t,d,chg];});
  $("rebalanceTable tbody").innerHTML=rows.sort((a,b)=>Math.abs(b[3])-Math.abs(a[3])).map(r=>`<tr><td>${r[0]}</td><td>${fmtPct(r[1])}</td><td>${fmtPct(r[2])}</td><td class="${Math.abs(r[3])>state.band/100?"warning":""}">${fmtPct(r[3])}</td><td>${Math.abs(r[3])>state.band/100?(r[3]>0?"Reduce / direct new cash elsewhere":"Increase / direct new cash here"):"Monitor"}</td><td>${Math.abs(r[4])<1?"—":fmtINR(r[4],true)}</td></tr>`).join("");
  const tol=state.tolerance;
  let headline=tol==="conservative"?"Capital preservation and drawdown control":tol==="aggressive"?"Growth-oriented allocation with explicit concentration limits":"Balanced growth with diversification and disciplined rebalancing";
  let actions=[];
  const drift=rows.filter(r=>Math.abs(r[3])>state.band/100);
  if(drift.length)actions.push(`Review ${drift.length} allocation drift(s) outside the ±${state.band}% band; consider directing new contributions before selling when tax/transaction constraints make that preferable.`);
  else actions.push(`Allocation is inside the configured ±${state.band}% band; monitoring and contribution-based rebalancing may be sufficient.`);
  if(Math.max(...s.w)>.25)actions.push("Review single-security concentration above 25%; assess issuer-specific and sector overlap before adding more.");
  if(s.cvar95>.03)actions.push("Review tail-loss exposure; consider whether the observed downside is compatible with the stated risk tolerance.");
  actions.push("Use the benchmark, risk metrics and stress results together; no single ratio should determine an investment action.");
  $("strategy").innerHTML=`<div class="strategy-box"><h3>Framework: ${headline}</h3><p>Risk tolerance changes the review emphasis, not the market forecast. The dashboard translates measurable drift and risk observations into items to investigate.</p></div><div class="strategy-box"><h3>Suggested review sequence</h3><p>${actions.join(" ")}</p></div>`;
}
function renderHoldings(){
  $("holdingsTable tbody").innerHTML=holdings.map((x,i)=>{const v=x.quantity*x.currentPrice,p=x.quantity*(x.currentPrice-x.avgCost);return `<tr data-i="${i}">
    <td><b>${x.symbol}</b></td><td>${x.name}</td><td>${x.assetType}</td><td>${x.sector}</td>
    <td contenteditable="true" class="editable" data-k="quantity">${x.quantity}</td>
    <td contenteditable="true" class="editable" data-k="avgCost">${x.avgCost}</td>
    <td contenteditable="true" class="editable" data-k="currentPrice">${x.currentPrice}</td>
    <td contenteditable="true" class="editable" data-k="beta">${x.beta}</td>
    <td contenteditable="true" class="editable" data-k="volatility">${x.volatility}</td>
    <td contenteditable="true" class="editable" data-k="targetPct">${x.targetPct}</td>
    <td>${fmtINR(v,true)}</td><td class="${p<0?"negative":"positive"}">${fmtINR(p,true)}</td>
  </tr>`}).join("");
}
function recalcFromTable(){
  document.querySelectorAll("#holdingsTable tbody tr").forEach(tr=>{const i=+tr.dataset.i;tr.querySelectorAll("[data-k]").forEach(td=>holdings[i][td.dataset.k]=parseNum(td.textContent,holdings[i][td.dataset.k]));});
  render();
}
function render(){
  const s=portfolioStats();renderKpis(s);renderRisk(s);renderConcentration(s);renderSignals(s);renderRebalance(s);renderStress(s);renderCorrelation(s);renderHoldings();
  lineChart("performanceChart",series,benchmark);donutChart("allocationChart",assetGroups(holdings,"assetType"));barChart("riskContributionChart",holdings.map(x=>x.symbol),s.riskPct);drawDrawdown("drawdownChart",series);
}
function parseCSV(text){
  const rows=[];let row=[],field="",quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c=='"'&&quoted&&n=='"'){field+='"';i++;continue}if(c=='"'){quoted=!quoted;continue}if(c==","&&!quoted){row.push(field.trim());field="";continue}if((c=="\n"||c=="\r")&&!quoted){if(c=="\r"&&n=="\n")i++;row.push(field.trim());if(row.some(Boolean))rows.push(row);row=[];field="";continue}field+=c}
  row.push(field.trim());if(row.some(Boolean))rows.push(row);if(rows.length<2)throw new Error("CSV has no data rows");
  const header=rows[0].map(x=>x.toLowerCase().replace(/\s+/g,""));const idx=k=>header.indexOf(k);
  const required=["symbol","name","assettype","sector","quantity","avgcost","currentprice","beta","volatility","targetpct"];
  const missing=required.filter(k=>idx(k)<0);if(missing.length)throw new Error("Missing CSV columns: "+missing.join(", "));
  const out=rows.slice(1).map(r=>({symbol:r[idx("symbol")],name:r[idx("name")],assetType:r[idx("assettype")],sector:r[idx("sector")],quantity:parseNum(r[idx("quantity")]),avgCost:parseNum(r[idx("avgcost")]),currentPrice:parseNum(r[idx("currentprice")]),beta:parseNum(r[idx("beta")]),volatility:Math.max(0,parseNum(r[idx("volatility")])),targetPct:Math.max(0,parseNum(r[idx("targetpct")]))})).filter(x=>x.symbol&&x.quantity>=0&&x.currentPrice>=0&&x.avgCost>=0);
  if(!out.length)throw new Error("CSV contains no valid holdings");
  return out;
}
function calculateXirrFromInput(){
  const lines=$("xirrInput").value.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  try{
    const cf=lines.map((line,i)=>{const parts=line.split(",");if(parts.length!==2)throw Error(`Line ${i+1}: expected date,amount`);const d=parts[0].trim(),a=parseNum(parts[1],NaN);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(a))throw Error(`Line ${i+1}: invalid date or amount`);return {date:d,amount:a};});
    if(!cf.some(x=>x.amount<0)||!cf.some(x=>x.amount>0))throw Error("Need at least one negative and one positive cash flow");
    const rate=xirr(cf);if(!Number.isFinite(rate))throw Error("No bracketed XIRR root found for these cash flows");
    $("xirrResult").innerHTML=`<div class="icon">≈</div><div><b>XIRR: ${fmtPct(rate)}</b><small>Calculated with an actual/365.25 year fraction and bracketed root search; this is a money-weighted return, not a forecast.</small></div>`;
  }catch(err){$("xirrResult").innerHTML=`<div class="icon negative">!</div><div><b>XIRR not available</b><small>${err.message}</small></div>`;}
}
function exportReport(){
  const s=portfolioStats(), lines=[
    "PORTFOLIO ANALYTICS & RISK DASHBOARD REPORT","Generated: "+new Date().toISOString(),
    "NOTE: Decision-support only; demo time series are synthetic.",
    `Portfolio value,${s.total}`,`Annualized return,${s.annReturn}`,`Annualized volatility,${s.annVol}`,`Sharpe,${s.sharpe}`,`Sortino,${s.sortino}`,`Beta,${s.beta}`,`Max drawdown,${s.dd.dd}`,`VaR 95%,${s.var95}`,`CVaR 95%,${s.cvar95}`,`HHI,${s.hhi}`,`Effective holdings,${s.effective}`,"",
    "Symbol,Asset type,Value,Weight,Target"
  ];
  holdings.forEach((x,i)=>lines.push([x.symbol,x.assetType,s.values[i],s.w[i],(x.targetPct||0)/100].join(",")));
  const blob=new Blob([lines.join("\n")],{type:"text/csv"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="portfolio-risk-report.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
$("loadDemo").onclick=()=>{holdings=clone(DEMO);series=buildDemoSeries();benchmark=buildDemoBenchmark(series);render();};
$("recalc").onclick=recalcFromTable;
$("riskTolerance").onchange=e=>{state.tolerance=e.target.value;renderRebalance(portfolioStats());};
$("driftBand").oninput=e=>{state.band=clamp(parseNum(e.target.value,5),.5,20);render();};
$("exportReport").onclick=exportReport;
$("calcXirr").onclick=calculateXirrFromInput;
$("csvFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{holdings=parseCSV(await f.text());series=buildDemoSeries();benchmark=buildDemoBenchmark(series);render();alert(`Imported ${holdings.length} holdings. Historical returns remain demo/synthetic unless a price series is connected.`);}catch(err){alert("Import failed: "+err.message);}e.target.value="";};
window.PortfolioDashboard={metrics:()=>portfolioStats(),xirr,percentile,maxDrawdown,assetGroups,portfolioRisk,parseCSV,getHoldings:()=>clone(holdings)};
window.addEventListener("resize",()=>{const s=portfolioStats();lineChart("performanceChart",series,benchmark);donutChart("allocationChart",assetGroups(holdings,"assetType"));barChart("riskContributionChart",holdings.map(x=>x.symbol),s.riskPct);drawDrawdown("drawdownChart",series);});
render();
calculateXirrFromInput();
})();