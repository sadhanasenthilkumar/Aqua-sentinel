
const API_BASE = "https://aqua-sentinel-6dkm.onrender.com";
const damData = [
  {id:"mettur",name:"Mettur Dam",district:"Salem",river:"Cauvery"},
  {id:"bhavanisagar",name:"Bhavanisagar Dam",district:"Erode",river:"Bhavani"},
  {id:"vaigai",name:"Vaigai Dam",district:"Theni",river:"Vaigai"},
  {id:"papanasam",name:"Papanasam Dam",district:"Tirunelveli",river:"Thamirabarani"},
  {id:"sathanur",name:"Sathanur Dam",district:"Tiruvannamalai",river:"Thenpennai"}
];
const byId = id => document.getElementById(id);
const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function apiGet(path) {
  const response = await fetch(API_BASE + path, {headers:{"Accept":"application/json"}});
  if (!response.ok) {
    let detail = "Request failed (" + response.status + ")";
    try { const body = await response.json(); detail = body.detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  return response.json();
}
function fillDamSelect(id) {
  const el = byId(id);
  if (!el) return;
  el.innerHTML = damData.map(d => '<option value="' + d.id + '">' + esc(d.name) + '</option>').join("");
}
function showMessage(target, message, bad) {
  if (!target) return;
  target.className = "result-box" + (bad ? " result-warn" : "");
  target.textContent = message;
}
function valueText(v, unit) {
  return v === null || v === undefined || v === "" ? "Not available in the dataset" : esc(v) + (unit || "");
}
function renderDamCards() {
  const html = damData.map(d => '<article class="dam-card"><h3>' + esc(d.name) + '</h3><p>' +
    esc(d.district) + ' District · ' + esc(d.river) + ' River</p><a class="button" href="dam-details.html?dam=' +
    encodeURIComponent(d.id) + '">View details</a></article>').join("");
  if (byId("damCards")) byId("damCards").innerHTML = html;
  if (byId("damList")) byId("damList").innerHTML = html;
}
async function showDamInfo(id) {
  const d = damData.find(x => x.id === id) || damData[0];
  const target = byId("damInformation");
  if (!target) return;
  target.innerHTML = "<p>Loading verified records and weather estimates…</p>";
  const results = await Promise.allSettled([
    apiGet("/api/reservoirs/" + d.id + "/latest"),
    apiGet("/api/rainfall/" + d.id)
  ]);
  const reading = results[0].status === "fulfilled" ? results[0].value : null;
  const weather = results[1].status === "fulfilled" ? results[1].value : null;
  const current = weather && weather.current ? weather.current : {};
  const facts = [
    ["District",d.district],["River",d.river],
    ["Latest dataset date",reading ? reading.date : "No reservoir history loaded"],
    ["Water level",reading ? valueText(reading.level_ft," ft") : "No verified record available"],
    ["Storage",reading ? valueText(reading.storage_mcft," MCft") : "No verified record available"],
    ["Inflow",reading ? valueText(reading.inflow_cusecs," cusecs") : "No verified record available"],
    ["Outflow",reading ? valueText(reading.outflow_cusecs," cusecs") : "No verified record available"],
    ["Rainfall estimate",current.precipitation == null ? "Weather estimate unavailable" : valueText(current.precipitation," mm")],
    ["Rainfall source",weather ? "Open-Meteo weather model" : "Temporarily unavailable"]
  ];
  target.innerHTML = "<h3>" + esc(d.name) + "</h3><div class=\"detail-list\">" +
    facts.map(x => '<div class="detail-item"><strong>' + esc(x[0]) + '</strong>' + x[1] + '</div>').join("") +
    "</div><p class=\"note\">Reservoir figures are historical dataset records, not live telemetry. Rainfall values are weather-model estimates, not rain-gauge observations. Water-quality measurements are not assigned to this dam unless a verified dam-specific sample is available.</p>" +
    '<a class="button" href="dam-details.html?dam=' + encodeURIComponent(d.id) + '">Open full dam profile</a>';
}
let comparisonChart = null;
async function loadComparison() {
  const box = byId("comparisonChart");
  try {
    const result = await apiGet("/api/reservoirs/compare");
    const rows = result.reservoirs || [];
    const a = byId("compareDam1").value;
    const b = byId("compareDam2").value;
    const selected = [a,b].map(id => rows.find(r => r.reservoir_slug === id)).filter(Boolean);
    if (selected.length !== 2) {
      const note = box && box.parentElement;
      if (note) {
        let msg = note.querySelector(".api-chart-note");
        if (!msg) { msg = document.createElement("p"); msg.className = "note api-chart-note"; note.appendChild(msg); }
        msg.textContent = "Comparison is connected to the API, but verified reservoir-history records are not yet loaded. No sample values are shown.";
      }
      if (comparisonChart) { comparisonChart.destroy(); comparisonChart = null; }
      return;
    }
    if (!window.Chart || !box) return;
    if (comparisonChart) comparisonChart.destroy();
    comparisonChart = new Chart(box, {
      type:"bar",
      data:{labels:selected.map(r => r.reservoir),datasets:[{label:"Storage (MCft)",data:selected.map(r => r.storage_mcft),backgroundColor:["#18a9c8","#087eaa"],borderRadius:7}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:"Historical storage comparison · " + selected.map(r=>r.date).join(" / ")}},scales:{y:{beginAtZero:true}}}
    });
  } catch (error) {
    const note = box && box.parentElement;
    if (note) {
      let msg = note.querySelector(".api-chart-note");
      if (!msg) { msg = document.createElement("p"); msg.className = "note api-chart-note"; note.appendChild(msg); }
      msg.textContent = "Could not load comparison data: " + error.message;
    }
  }
}
async function loadOverview() {
  try {
    const [dams, latest, rainfall] = await Promise.all([
      apiGet("/api/dams"), apiGet("/api/reservoirs/latest"), apiGet("/api/rainfall/all")
    ]);
    const records = latest.reservoirs || [];
    const stats = document.querySelectorAll("#overview .stats .stat-card");
    if (stats[0]) { stats[0].querySelector("strong").textContent = dams.length; stats[0].querySelector("small").textContent = "Dam profiles returned by backend"; }
    if (stats[1]) { stats[1].querySelector("strong").textContent = "2"; stats[1].querySelector("small").textContent = "pH and turbidity supported by CSV API"; }
    if (stats[3]) { stats[3].querySelector("strong").textContent = "Connected"; stats[3].querySelector("small").textContent = "Render API reachable"; }
    const chartCanvas = byId("overviewChart");
    if (chartCanvas && window.Chart && records.length) {
      const existing = Chart.getChart(chartCanvas);
      if (existing) existing.destroy();
      new Chart(chartCanvas,{type:"bar",data:{labels:records.map(r=>r.reservoir),datasets:[{label:"Historical storage (MCft)",data:records.map(r=>r.storage_mcft),backgroundColor:"#18a9c8",borderRadius:7}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}});
    } else if (chartCanvas && chartCanvas.parentElement) {
      const msg=document.createElement("p"); msg.className="note"; msg.textContent="Backend connected. No reservoir-history records are currently loaded, so the chart is intentionally blank rather than showing invented values."; chartCanvas.parentElement.appendChild(msg);
    }
    const weatherCount = (rainfall.data || []).filter(x => !x.error).length;
    if (stats[0]) stats[0].querySelector("small").textContent = dams.length + " dam profiles · rainfall estimates available: " + weatherCount + "/" + (rainfall.data || []).length;
    const badge = document.querySelector(".topbar .demo-label");
    if (badge) badge.textContent = "BACKEND CONNECTED · HISTORICAL DATA";
  } catch (error) {
    const badge = document.querySelector(".topbar .demo-label");
    if (badge) badge.textContent = "API CONNECTION ISSUE";
    const panel = byId("overviewChart");
    if (panel && panel.parentElement) {
      const msg=document.createElement("p"); msg.className="note"; msg.textContent="Backend could not be reached: " + error.message; panel.parentElement.appendChild(msg);
    }
  }
}
async function loadPublicIntelligence() {
  const section = byId("public");
  if (!section) return;
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = "<h3>Public Water Intelligence · Backend data</h3><p>Loading reservoir summary…</p>";
  section.insertBefore(panel, section.children[1] || null);
  try {
    const data = await apiGet("/api/public/water-intelligence");
    const rows = data.reservoirs || [];
    panel.innerHTML = "<h3>Public Water Intelligence · Backend data</h3><p class=\"note\">" + esc(data.data_type || "Dataset information") + "</p>" +
      (rows.length ? '<div class="detail-list">' + rows.map(r=>'<div class="detail-item"><strong>'+esc(r.reservoir)+'</strong>Date: '+esc(r.date)+'<br>Storage: '+valueText(r.storage_mcft," MCft")+'<br>Level: '+valueText(r.level_ft," ft")+'</div>').join("") + '</div>' : '<p>No verified reservoir-history records are currently available. Historical storage totals are withheld until a trusted dataset is loaded.</p>') +
      '<ul class="steps">' + (data.public_guidance || []).map(x=>"<li>"+esc(x)+"</li>").join("") + "</ul><p class=\"note\">" + esc(data.notice || "") + "</p>";
  } catch (error) {
    panel.innerHTML = "<h3>Public Water Intelligence</h3><p>Unable to load backend information: " + esc(error.message) + "</p>";
  }
}
async function loadAlerts() {
  const target = byId("localAlertList");
  if (!target) return;
  try {
    const data = await apiGet("/api/alerts");
    const alerts = data.alerts || [];
    target.innerHTML = alerts.length ? alerts.map(a=>'<div class="alert-row"><span class="alert-dot"></span><div><strong>'+esc(a.reservoir)+': '+esc(a.alert_level)+'</strong><p>'+esc(a.message)+'</p><small>'+esc(a.date)+' · '+esc(a.storage_percentage)+'%</small></div></div>').join("") :
      '<p class="note">No low-storage alerts were returned for the available historical records. This is not a live dam-safety warning service.</p>';
  } catch (error) { target.textContent = "Alert service unavailable: " + error.message; }
}
function initPredictions() {
  const section = byId("predictions");
  if (!section) return;
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = '<h3>Reservoir storage estimate</h3><label for="predictionDam">Choose reservoir</label><select id="predictionDam"></select><button id="runPrediction" type="button">Get historical trend estimate</button><div id="predictionResult" class="result-box" aria-live="polite">Select a reservoir to request the API estimate.</div>';
  section.appendChild(panel);
  fillDamSelect("predictionDam");
  byId("runPrediction").addEventListener("click", async () => {
    const slug = byId("predictionDam").value;
    const result = byId("predictionResult");
    showMessage(result,"Loading estimate…",false);
    try {
      const data = await apiGet("/api/ai/predictions/" + slug);
      result.innerHTML = "<strong>Method: "+esc(data.method)+"</strong><p>Latest historical date: "+esc(data.latest_historical_date)+"</p><ul>"+(data.predictions||[]).map(p=>"<li>Day "+esc(p.day)+": "+esc(p.estimated_storage_mcft)+" MCft</li>").join("")+"</ul><p class=\"note\">"+esc(data.notice)+"</p>";
    } catch(error) { showMessage(result,"Estimate unavailable: "+error.message,true); }
  });
}
function initQuality() {
  const manual = byId("analyzeButton");
  if (manual) manual.addEventListener("click", () => {
    const fields=[["pH","phInput"],["DO","doInput"],["BOD","bodInput"],["COD","codInput"],["Turbidity","turbidityInput"],["TDS","tdsInput"]];
    const missing=fields.filter(x=>byId(x[1]) && byId(x[1]).value==="").map(x=>x[0]);
    const box=byId("analysisResult");
    if(missing.length){showMessage(box,"Please enter all values: "+missing.join(", "),true);return;}
    const vals={}; fields.forEach(x=>vals[x[0]]=Number(byId(x[1]).value));
    if(Object.values(vals).some(v=>!Number.isFinite(v)||v<0)){showMessage(box,"Enter valid non-negative numeric values.",true);return;}
    const notes=[];
    if(vals.pH<6.5||vals.pH>8.5)notes.push("pH outside the illustrative 6.5–8.5 screening band");
    if(vals.DO<5)notes.push("Dissolved oxygen below illustrative 5 mg/L value");
    if(vals.BOD>3)notes.push("BOD above illustrative 3 mg/L value");
    if(vals.COD>10)notes.push("COD above illustrative 10 mg/L value");
    if(vals.Turbidity>5)notes.push("Turbidity above illustrative 5 NTU value");
    if(vals.TDS>500)notes.push("TDS above illustrative 500 mg/L value");
    showMessage(box,(notes.length?notes.join("; "):"No entered value crossed the demonstration thresholds.")+" This manual check is educational only, not a certified water-quality assessment.",!!notes.length);
  });
  const qualityFile=byId("qualityFile");
  if(qualityFile)qualityFile.addEventListener("change",e=>{byId("fileMessage").textContent=e.target.files.length?"Selected: "+e.target.files[0].name+" (not uploaded).":"No file selected.";});
  const csvInput=byId("csvUpload"), csvButton=byId("analyzeCSV"), csvResults=byId("csvResults");
  if(csvInput&&csvButton&&csvResults){
    csvButton.addEventListener("click",async()=>{
      const file=csvInput.files[0];
      if(!file){showMessage(csvResults,"Please select a CSV file first.",true);return;}
      const form=new FormData();form.append("file",file);
      showMessage(csvResults,"Uploading CSV to Aqua Sentinel backend for analysis…",false);
      try{
        const response=await fetch(API_BASE+"/api/water-quality/analyze-csv",{method:"POST",body:form});
        const data=await response.json();
        if(!response.ok)throw new Error(data.detail||"CSV analysis failed");
        csvResults.innerHTML="<strong>Backend CSV analysis completed</strong><p>Total samples: "+esc(data.total_samples)+"</p><p>Needs attention: "+esc(data.needs_attention)+"</p><p>Invalid samples: "+esc(data.invalid_samples)+"</p><div class=\"detail-list\">"+(data.results||[]).map(r=>'<div class="detail-item"><strong>'+esc(r.station||"Sample")+'</strong>Date: '+esc(r.date||"Not supplied")+'<br>pH: '+esc(r.pH==null?"Invalid":r.pH)+'<br>Turbidity: '+esc(r.turbidity==null?"Invalid":r.turbidity)+'<br>'+esc(r.status)+'</div>').join("")+"</div><p class=\"note\">"+esc(data.notice||"Preliminary screening only.")+"</p>";
      }catch(error){showMessage(csvResults,"CSV analysis failed: "+error.message,true);}
    });
  }
  const imageInput=byId("imageUpload"), preview=byId("imagePreview"), imageResults=byId("imageResults");
  if(imageInput&&preview&&imageResults)imageInput.addEventListener("change",e=>{
    preview.innerHTML="";const file=e.target.files[0];if(!file){imageResults.textContent="Upload an image to view its preview.";return;}
    if(!file.type.startsWith("image/")){showMessage(imageResults,"Please choose an image file.",true);return;}
    const url=URL.createObjectURL(file);const img=document.createElement("img");img.src=url;img.alt="Water sample preview";preview.appendChild(img);
    imageResults.textContent="Image preview loaded. Automated image-based chemical analysis is not available; laboratory testing is required.";
  });
}
const STORE_KEY="aquaSentinelPublicReports";
function getReports(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||"[]");}catch(_){return[];}}
function renderReports(){
  const reports=getReports();if(byId("reportCount"))byId("reportCount").textContent=reports.length;
  const target=byId("reportsList");if(!target)return;
  target.innerHTML=reports.length?reports.slice().reverse().map(r=>'<article class="report-item"><strong>'+esc(r.type)+'</strong><p><b>Location:</b> '+esc(r.location)+' · <b>Date:</b> '+esc(r.date||"Not provided")+'</p><p>'+esc(r.description)+'</p><p>Saved locally in this browser'+(r.name?" by "+esc(r.name):"")+'</p></article>').join(""):"No reports submitted yet.";
}
function initReports(){
  if(byId("submitReport"))byId("submitReport").addEventListener("click",()=>{
    const location=byId("reportLocation").value.trim(),type=byId("reportType").value,description=byId("reportDescription").value.trim(),msg=byId("reportMessage");
    if(!location||!type||!description){msg.textContent="Please enter the location, concern type and description.";return;}
    const reports=getReports();reports.push({name:byId("reportName").value.trim(),location,type,description,date:byId("reportDate").value,created:new Date().toISOString()});
    localStorage.setItem(STORE_KEY,JSON.stringify(reports));
    ["reportName","reportLocation","reportType","reportDate","reportDescription"].forEach(id=>byId(id).value="");
    msg.textContent="Report saved in this browser only. It has not been sent to an authority.";renderReports();
  });
  if(byId("clearReports"))byId("clearReports").addEventListener("click",()=>{if(confirm("Clear reports saved in this browser?")){localStorage.removeItem(STORE_KEY);renderReports();}});
  renderReports();
}
document.addEventListener("DOMContentLoaded",()=>{
  ["damSelect","compareDam1","compareDam2","sampleDam"].forEach(fillDamSelect);
  if(byId("compareDam2"))byId("compareDam2").value="bhavanisagar";
  renderDamCards();
  if(byId("damSelect")){byId("damSelect").addEventListener("change",e=>showDamInfo(e.target.value));showDamInfo("mettur");}
  if(byId("compareButton"))byId("compareButton").addEventListener("click",loadComparison);
  initQuality();initReports();initPredictions();
  loadOverview();loadPublicIntelligence();loadAlerts();
});
