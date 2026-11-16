
const dams = [
 ["mettur","Mettur Dam","Salem","Cauvery"],
 ["bhavanisagar","Bhavanisagar Dam","Erode","Bhavani"],
 ["vaigai","Vaigai Dam","Theni","Vaigai"],
 ["papanasam","Papanasam Dam","Tirunelveli","Thamirabarani"],
 ["sathanur","Sathanur Dam","Tiruvannamalai","Thenpennai"]
];
const API_BASE="https://aqua-sentinel-6dkm.onrender.com";
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
document.addEventListener("DOMContentLoaded",async()=>{
 const list=document.getElementById("damList");
 list.innerHTML=dams.map(d=>'<article class="dam-card"><h3>'+esc(d[1])+'</h3><p>'+esc(d[2])+' District · '+esc(d[3])+' River</p><a class="button" href="dam-details.html?dam='+encodeURIComponent(d[0])+'">View details</a></article>').join("");
 try{
  const response=await fetch(API_BASE+"/api/dams");
  if(!response.ok)throw new Error("API returned "+response.status);
  const data=await response.json();
  const note=document.createElement("p");note.className="note";
  note.textContent="Connected to Aqua Sentinel backend · "+data.length+" dam profiles returned. Reservoir history may be unavailable until a verified dataset is loaded.";
  list.parentElement.insertBefore(note,list);
 }catch(error){
  const note=document.createElement("p");note.className="note";note.textContent="Backend connection unavailable: "+error.message;list.parentElement.insertBefore(note,list);
 }
});
