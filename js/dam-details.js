const API_BASE = "https://aqua-sentinel-6dkm.onrender.com";
const dams = {
  mettur:{name:"Mettur Dam",district:"Salem",river:"Cauvery"},
  bhavanisagar:{name:"Bhavanisagar Dam",district:"Erode",river:"Bhavani"},
  vaigai:{name:"Vaigai Dam",district:"Theni",river:"Vaigai"},
  papanasam:{name:"Papanasam Dam",district:"Tirunelveli",river:"Thamirabarani"},
  sathanur:{name:"Sathanur Dam",district:"Tiruvannamalai",river:"Thenpennai"}
};
const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function getJSON(path){
  const response=await fetch(API_BASE+path,{headers:{"Accept":"application/json"}});
  const body=await response.json();
  if(!response.ok)throw new Error(body.detail||"API request failed ("+response.status+")");
  return body;
}
function detail(label,value){return '<div class="detail-item"><strong>'+esc(label)+'</strong>'+esc(value==null||value===""?"Not available in the current dataset":value)+'</div>';}
document.addEventListener("DOMContentLoaded",async()=>{
  const slug=(new URLSearchParams(location.search).get("dam")||"mettur").toLowerCase();
  const dam=dams[slug]||dams.mettur;
  document.title=dam.name+" | Aqua Sentinel";
  document.getElementById("damName").textContent=dam.name;
  document.getElementById("damLocation").textContent=dam.district+" District, Tamil Nadu · "+dam.river+" River";
  const facts=document.getElementById("damFacts"), quality=document.getElementById("qualityFacts");
  facts.innerHTML="<p>Loading backend records…</p>";
  quality.innerHTML="<p>Loading water-quality history…</p>";
  const results=await Promise.allSettled([
    getJSON("/api/reservoirs/"+slug+"/latest"),
    getJSON("/api/rainfall/"+slug),
    getJSON("/api/water-quality/history")
  ]);
  const reading=results[0].status==="fulfilled"?results[0].value:null;
  const rainfall=results[1].status==="fulfilled"?results[1].value:null;
  const qualityRows=results[2].status==="fulfilled"?results[2].value:[];
  const current=rainfall&&rainfall.current?rainfall.current:{};
  const label=document.querySelector(".demo-label");
  if(label)label.textContent="BACKEND DATA · HISTORICAL / WEATHER ESTIMATES";
  facts.innerHTML=[
    detail("District",dam.district),detail("River",dam.river),
    detail("Record date",reading?reading.date:"No reservoir history loaded"),
    detail("Water level (ft)",reading?reading.level_ft:null),
    detail("Storage (MCft)",reading?reading.storage_mcft:null),
    detail("Capacity (MCft)",reading?reading.capacity_mcft:null),
    detail("Inflow (cusecs)",reading?reading.inflow_cusecs:null),
    detail("Outflow (cusecs)",reading?reading.outflow_cusecs:null),
    detail("Reservoir data type",reading?(reading.data_type||"Historical record"):"Unavailable"),
    detail("Reservoir data source",reading?(reading.source||"Source not specified"):"Unavailable"),
    detail("Rainfall estimate (mm)",current.precipitation),
    detail("Rainfall / weather source",rainfall?(rainfall.cache_status==="stale"?"Open-Meteo · cached estimate":"Open-Meteo weather-model estimate"):"Temporarily unavailable")
  ].join("");
  // Keep one copy of each identical station/date/measurement row.
  const matching=qualityRows.filter(row=>{
    const station=String(row.station||"").toLowerCase();
    return station.includes(slug)||station.includes(dam.name.toLowerCase().replace(" dam",""));
  });
  const uniqueRows=[...new Map(matching.map(row=>[
    [row.station,row.date,row.pH,row.turbidity,row.status].join("|"),row
  ])).values()];
  quality.innerHTML=uniqueRows.length?uniqueRows.map(row=>[
    detail("Sample station",row.station),detail("Sample date",row.date),
    detail("pH",row.pH),detail("Turbidity",row.turbidity),
    detail("Screening status",row.status)
  ].join("")).join(""):"<p>No water-quality sample is currently linked specifically to "+esc(dam.name)+". A general CSV record is not automatically assigned to a dam.</p>";
  const qualityNote=quality.parentElement.querySelector(".note");
  if(qualityNote)qualityNote.textContent="Preliminary CSV screening only; these values are not laboratory-certified and do not establish drinking-water safety.";
  const risk=document.querySelectorAll(".panel")[2];
  if(risk)risk.innerHTML="<h3>Storage trend estimate</h3><p>Request a simple historical trend estimate. It is not a trained AI/ML model or a dam-safety prediction.</p><button id='getEstimate' type='button'>Get 7-day estimate</button><div id='estimateResult' class='result-box' aria-live='polite'>No prediction requested.</div>";
  const btn=document.getElementById("getEstimate");
  if(btn)btn.addEventListener("click",async()=>{
    const box=document.getElementById("estimateResult");box.textContent="Loading estimate…";
    try{
      const prediction=await getJSON("/api/ai/predictions/"+slug);
      box.innerHTML="<strong>"+esc(prediction.method)+"</strong><p>Latest historical date: "+esc(prediction.latest_historical_date)+"</p><ul>"+(prediction.predictions||[]).map(x=>"<li>Day "+esc(x.day)+": "+esc(x.estimated_storage_mcft)+" MCft</li>").join("")+"</ul><p class='note'>"+esc(prediction.notice)+"</p>";
    }catch(error){box.textContent="Estimate unavailable: "+error.message;}
  });
  if(results[0].status!=="fulfilled"){
    facts.insertAdjacentHTML("beforeend",'<p class="note">Reservoir records could not be loaded. Please try again later.</p>');
  }
  if(results[1].status!=="fulfilled"){
    facts.insertAdjacentHTML("beforeend",'<p class="note">Rainfall estimates are temporarily unavailable from the weather provider. Reservoir records are unaffected.</p>');
  } else if(rainfall.cache_notice){
    facts.insertAdjacentHTML("beforeend",'<p class="note">'+esc(rainfall.cache_notice)+'</p>');
  }
  if(results[2].status!=="fulfilled"){
    quality.innerHTML="<p>Water-quality history is temporarily unavailable.</p>";
  }
});