let cache={groups:null,products:null,stamp:null};
const CATEGORY=89, BASE="https://tcgcsv.com/tcgplayer", UA="RiftCollect/1.0";

async function json(url){
  const r=await fetch(url,{
    headers:{
      "User-Agent":UA,
      "Accept":"application/json,text/plain,*/*"
    }
  });
  const text=await r.text();
  if(!r.ok){
    const preview=text.slice(0,120).replace(/\\s+/g," ").trim();
    const err=new Error(`TCGCSV HTTP ${r.status}${preview?`: ${preview}`:""}`);
    err.code=r.status;
    throw err;
  }
  try{
    return JSON.parse(text);
  }catch(err){
    const preview=text.slice(0,120).replace(/\\s+/g," ").trim();
    const e=new Error(`TCGCSV returned non-JSON data${preview?`: ${preview}`:""}`);
    e.code="NON_JSON";
    throw e;
  }
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function field(p,n){const x=(p.extendedData||[]).find(v=>(v.name||"").toLowerCase()===n.toLowerCase());return x?.value||""}

async function loadProducts(){
 if(cache.products)return cache;
 const gd=await json(`${BASE}/${CATEGORY}/groups`);
 const g=Array.isArray(gd?.results)?gd.results:[];
 if(!g.length) throw Error("TCGCSV returned no Riftbound sets.");
 const products=[];
 for(const group of g){
   try{
     const d=await json(`${BASE}/${CATEGORY}/${group.groupId}/products`);
     for(const p of (Array.isArray(d?.results)?d.results:[])){
       const number=field(p,"Number"), rarity=field(p,"Rarity");
       if(!number&&!rarity)continue;
       products.push({...p,setName:group.name,setAbbreviation:group.abbreviation,groupId:group.groupId,cardNumber:number,rarity});
     }
   }catch(e){
     // TCGCSV can occasionally return an HTML 404/empty response for a group.
     // Skip that group instead of failing the entire search.
   }
   await wait(100);
 }
 cache.groups=g;cache.products=products;
 if(!products.length) throw Error("TCGCSV returned no Riftbound cards.");
 return cache;
}
async function pricesFor(groups){
 const out=new Map();
 for(const group of groups){
   try{
     const d=await json(`${BASE}/${CATEGORY}/${group}/prices`);
     for(const p of (Array.isArray(d?.results)?d.results:[])){
       const key=`${p.productId}::${p.subTypeName||"Normal"}`;
       out.set(key,p);
     }
   }catch(e){
     // Price data is optional; cards can still be returned without a price.
   }
   await wait(100);
 }
 return out;
}
function norm(p,px){
 const a=[...(px.values())].filter(x=>x.productId===p.productId);
 const price=a.find(x=>x.subTypeName==="Normal")||a.find(x=>/foil/i.test(x.subTypeName||""))||a[0];
 return {id:String(p.productId),productId:p.productId,name:p.name,cleanName:p.cleanName,imageUrl:p.imageUrl,setName:p.setName,setAbbreviation:p.setAbbreviation,cardNumber:p.cardNumber,rarity:p.rarity,tcgplayerUrl:p.url,subTypeName:price?.subTypeName||"Normal",marketPrice:price?.marketPrice??null,lowPrice:price?.lowPrice??null,midPrice:price?.midPrice??null,highPrice:price?.highPrice??null};
}
export default async function handler(req,res){
 res.setHeader("Access-Control-Allow-Origin","*");
 try{
   const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";
   if(q.length<2)return res.status(400).json({error:"Search must be at least 2 characters"});
   const data=await loadProducts(),tokens=q.split(/\s+/);
   let hits=data.products.filter(p=>{const s=(p.name+" "+p.cleanName+" "+p.cardNumber).toLowerCase();return tokens.every(t=>s.includes(t))}).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,30);
   const groups=[...new Set(hits.map(x=>x.groupId))];
   const prices=await pricesFor(groups);
   return res.status(200).json({results:hits.map(x=>norm(x,prices))});
 }catch(e){return res.status(502).json({error:e?.message||"Unable to load TCGCSV"})}
}