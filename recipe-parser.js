/*
 * recipe-parser.js — Wortmann Family Cookbook
 *
 * ONE parser used by (a) the Recipe Clipper bookmarklet, (b) "Fetch by link",
 * and (c) "Paste page source". Everything lives inside wfcParserLib() so the
 * bookmarklet can embed it with .toString() and run it on any recipe site.
 * RULES for editing inside the factory (the bookmarklet depends on them):
 *   - no double-slash line comments; only whole-line block comments (they are stripped)
 *   - always end statements with semicolons
 *   - no template literals spanning lines
 *
 * Extraction chain (recipe-scraper's "delegating scraper" idea, made generic):
 *   1. JSON-LD  schema.org/Recipe  (handles @graph, arrays, HowToSection/HowToStep)
 *   2. Microdata  itemtype=schema.org/Recipe
 *   3. Site/plugin adapters  — each has supports(host, doc) + extract(doc)
 *   4. Heading heuristics  ("Ingredients" / "Directions" followed by a list)
 * Results are merged FIELD BY FIELD, so a page with JSON-LD ingredients but no
 * steps still gets its steps from a later tier.
 *
 * Original code. Patterns only — nothing copied from GPL/AGPL projects.
 */
function wfcParserLib(){
var VERSION=1;

/* ---------- text helpers ---------- */
var ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',rsquo:'\u2019',lsquo:'\u2018',rdquo:'\u201d',ldquo:'\u201c',ndash:'\u2013',mdash:'\u2014',hellip:'\u2026',deg:'\u00b0',frac12:'\u00bd',frac14:'\u00bc',frac34:'\u00be'};
function decode(s){
return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi,function(m,e){
if(e.charAt(0)==='#'){var c=e.charAt(1).toLowerCase()==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);try{return String.fromCodePoint(c);}catch(x){return m;}}
var k=e.toLowerCase();
return ENT.hasOwnProperty(k)?ENT[k]:m;
});
}
function stripHtml(s){
return String(s).replace(/<\s*br\s*\/?>/gi,'\n').replace(/<\/(p|li|div|h[1-6])>/gi,'\n').replace(/<[^>]*>/g,'');
}
function clean(s){
if(s==null)return '';
if(typeof s!=='string')s=String(s);
return decode(stripHtml(s)).replace(/[\u00a0\u200b]/g,' ').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').trim();
}
function oneLine(s){return clean(s).replace(/\s+/g,' ');}
function toArr(x){return x==null?[]:(Array.isArray(x)?x:[x]);}

/* ---------- quantities: parse, format, scale, add ---------- */
var VULGAR={'\u00bd':0.5,'\u2153':1/3,'\u2154':2/3,'\u00bc':0.25,'\u00be':0.75,'\u2155':0.2,'\u2156':0.4,'\u2157':0.6,'\u2158':0.8,'\u2159':1/6,'\u215a':5/6,'\u215b':0.125,'\u215c':0.375,'\u215d':0.625,'\u215e':0.875};
var VCLASS='\u00bc-\u00be\u2150-\u215e';
var VRE=new RegExp('['+VCLASS+']','g');
function parseNumber(s){
s=String(s).replace(VRE,function(g){return VULGAR.hasOwnProperty(g)?' '+VULGAR[g]+' ':g;});
s=s.replace(/(\d)\s*-\s*(\d+\/\d+)/,'$1 $2').trim();
if(!s)return NaN;
var t=s.split(/\s+/),sum=0;
for(var i=0;i<t.length;i++){
var k=t[i],v;
if(/^\d+\/\d+$/.test(k)){var p=k.split('/');if(+p[1]===0)return NaN;v=p[0]/p[1];}
else if(/^\d*\.?\d+$/.test(k))v=parseFloat(k);
else return NaN;
if(i>0&&!(/\//.test(k)||/^0?\.\d+$/.test(k)))return NaN;
sum+=v;
}
return sum;
}
function parseQty(str){
if(str==null)return null;
var s=String(str).replace(VRE,function(g){return VULGAR.hasOwnProperty(g)?' '+VULGAR[g]+' ':g;});
s=s.replace(/(\d)\s*-\s*(\d+\/\d+)/g,'$1 $2').trim();
if(!s)return null;
var parts=s.split(/\s*(?:\u2013|\u2014|\bto\b|\bor\b|-)\s*/);
if(parts.length===1){var a=parseNumber(parts[0]);return isNaN(a)?null:{min:a,max:a};}
if(parts.length===2){var lo=parseNumber(parts[0]),hi=parseNumber(parts[1]);if(!isNaN(lo)&&!isNaN(hi)&&hi>=lo)return {min:lo,max:hi};}
return null;
}
var FR=[[0,'',''],[0.125,'1/8','\u215b'],[0.25,'1/4','\u00bc'],[1/3,'1/3','\u2153'],[0.375,'3/8','\u215c'],[0.5,'1/2','\u00bd'],[0.625,'5/8','\u215d'],[2/3,'2/3','\u2154'],[0.75,'3/4','\u00be'],[0.875,'7/8','\u215e'],[1,'','']];
function fmtNum(n,mode){
if(!(n>=0))return '';
if(mode==='decimal'){return String(n>=100?Math.round(n):(n>=10?Math.round(n*10)/10:Math.round(n*100)/100));}
var whole=Math.floor(n+1e-9),frac=n-whole,best=null;
for(var i=0;i<FR.length;i++){if(Math.abs(FR[i][0]-frac)<=0.02&&(!best||Math.abs(FR[i][0]-frac)<Math.abs(best[0]-frac)))best=FR[i];}
if(!best)return String(Math.round(n*100)/100);
if(best[0]===1)return String(whole+1);
if(best[0]===0)return String(whole);
if(mode==='pretty')return (whole?String(whole):'')+best[2];
return (whole?whole+' ':'')+best[1];
}
function formatQty(q,mode){
if(!q)return '';
var a=fmtNum(q.min,mode);
if(q.max>q.min+1e-9){return a+(mode==='pretty'?'\u2013':'-')+fmtNum(q.max,mode);}
return a;
}
function scaleQty(str,factor,mode){
var q=parseQty(str);
if(!q)return str==null?'':String(str);
return formatQty({min:q.min*factor,max:q.max*factor},mode||'ascii');
}
function normQty(str){
var q=parseQty(str);
return q?formatQty(q,'ascii'):(str==null?'':String(str).trim());
}

/* ---------- units ---------- */
var UNIT_MAP={cup:'cup',cups:'cup',c:'cup',tablespoon:'tbsp',tablespoons:'tbsp',tbsp:'tbsp',tbs:'tbsp',tbl:'tbsp',tb:'tbsp',teaspoon:'tsp',teaspoons:'tsp',tsp:'tsp',ounce:'oz',ounces:'oz',oz:'oz','fluid ounce':'fl oz','fluid ounces':'fl oz','fl oz':'fl oz','fl. oz':'fl oz',pound:'lb',pounds:'lb',lb:'lb',lbs:'lb',gram:'g',grams:'g',g:'g',gr:'g',kilogram:'kg',kilograms:'kg',kg:'kg',milliliter:'ml',milliliters:'ml',millilitre:'ml',millilitres:'ml',ml:'ml',liter:'l',liters:'l',litre:'l',litres:'l',l:'l',pint:'pint',pints:'pint',pt:'pint',quart:'quart',quarts:'quart',qt:'quart',gallon:'gallon',gallons:'gallon',gal:'gallon',stick:'stick',sticks:'stick',clove:'clove',cloves:'clove',slice:'slice',slices:'slice',can:'can',cans:'can',package:'package',packages:'package',pkg:'package',stalk:'stalk',stalks:'stalk',sprig:'sprig',sprigs:'sprig',bunch:'bunch',bunches:'bunch',pinch:'pinch',pinches:'pinch',dash:'dash',dashes:'dash',head:'head',heads:'head',handful:'handful',handfuls:'handful'};
var UNIT_KEYS=Object.keys(UNIT_MAP).sort(function(a,b){return b.length-a.length;}).map(function(k){return k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'\\s+');});
var UNIT_RE=new RegExp('^('+UNIT_KEYS.join('|')+')(?![a-zA-Z])\\.?\\s*','i');
var PLURAL={cup:'cups',clove:'cloves',slice:'slices',can:'cans',package:'packages',stalk:'stalks',sprig:'sprigs',bunch:'bunches',pinch:'pinches',dash:'dashes',pint:'pints',quart:'quarts',gallon:'gallons',stick:'sticks',head:'heads',handful:'handfuls'};
function canonUnit(u){
if(!u)return '';
var k=String(u).trim().toLowerCase().replace(/\.$/,'').replace(/\s+/g,' ');
return UNIT_MAP.hasOwnProperty(k)?UNIT_MAP[k]:String(u).trim();
}
function displayUnit(u,qtyStr){
var c=canonUnit(u);
if(!c)return '';
var q=parseQty(qtyStr);
if(q&&q.max>1.0001&&PLURAL.hasOwnProperty(c))return PLURAL[c];
return c;
}
var METRIC={cup:{f:240,u:'ml'},tbsp:{f:15,u:'ml'},tsp:{f:5,u:'ml'},oz:{f:28.35,u:'g'},lb:{f:454,u:'g'},'fl oz':{f:29.57,u:'ml'},pint:{f:473,u:'ml'},quart:{f:946,u:'ml'}};
function metric(u){var c=canonUnit(u);return METRIC.hasOwnProperty(c)?METRIC[c]:null;}
var FAM={tsp:['vol',1],tbsp:['vol',3],cup:['vol',48],'fl oz':['vol',6],pint:['vol',96],quart:['vol',192],gallon:['vol',768],ml:['mvol',1],l:['mvol',1000],oz:['wt',1],lb:['wt',16],g:['mwt',1],kg:['mwt',1000]};
function addQuantities(a,b){
var ua=canonUnit(a.unit),ub=canonUnit(b.unit),qa=parseQty(a.qty),qb=parseQty(b.qty);
if(!qa&&!qb)return {qty:'',unit:a.unit||b.unit||''};
if(!qa||!qb)return null;
var f=1;
if(ua!==ub){
var fa=FAM[ua],fb=FAM[ub];
if(!fa||!fb||fa[0]!==fb[0])return null;
f=fb[1]/fa[1];
}
return {qty:formatQty({min:qa.min+qb.min*f,max:qa.max+qb.max*f},'ascii'),unit:ua||''};
}

/* ---------- ingredient line -> {name, qty, unit} ---------- */
var NUMCH='[\\d.\\/'+VCLASS+']';
var NUMTOK=new RegExp('^'+NUMCH+'+$');
var RANGETOK=new RegExp('^'+NUMCH+'+[\\u2013\\u2014-]'+NUMCH+'+$');
function isNum(t){return (NUMTOK.test(t)&&/[\d\u00bc-\u00be\u2150-\u215e]/.test(t))||RANGETOK.test(t);}
function parseIngredient(line){
var orig=oneLine(line);
if(!orig)return {name:'',qty:'',unit:''};
var s=orig.replace(new RegExp('^(\\(?'+NUMCH+'+)(?=[a-zA-Z])'),'$1 ');
var toks=s.split(' '),i=0,got=[];
while(i<toks.length){
var t=toks[i];
if(isNum(t)){got.push(t);i++;}
else if(got.length&&/^(to|or|-|\u2013|\u2014)$/i.test(t)&&i+1<toks.length&&isNum(toks[i+1])){got.push(t);i++;}
else break;
}
while(got.length&&!parseQty(got.join(' ')))got.pop();
var qty='',rest=s;
if(got.length){qty=normQty(got.join(' '));rest=toks.slice(got.length).join(' ');}
var note='';
var pm=/^\(([^)]*)\)\s*/.exec(rest);
if(qty&&pm){note=pm[1];rest=rest.slice(pm[0].length);}
var unit='';
if(qty){
var um=UNIT_RE.exec(rest);
if(um){unit=canonUnit(um[1].replace(/\s+/g,' '));rest=rest.slice(um[0].length);}
var pm2=/^\(([^)]*)\)\s*/.exec(rest);
if(pm2){note=note?note+', '+pm2[1]:pm2[1];rest=rest.slice(pm2[0].length);}
rest=rest.replace(/^of\s+/i,'');
}
var name=rest.replace(/^[\s,;:-]+|[\s,;:]+$/g,'');
if(!name){return {name:orig,qty:'',unit:''};}
if(note)name+=' ('+note+')';
return {name:name,qty:qty,unit:unit};
}

/* ---------- shopping helpers ---------- */
function normalizeKey(name){
var s=String(name||'').toLowerCase().replace(/\([^)]*\)/g,' ').split(',')[0].replace(/\s+/g,' ').trim();
var w=s.split(' '),last=w.pop()||'';
if(/ies$/.test(last)&&last.length>4)last=last.slice(0,-3)+'y';
else if(/(o|x|ch|sh)es$/.test(last))last=last.slice(0,-2);
else if(/s$/.test(last)&&!/(ss|us)$/.test(last)&&last.length>3)last=last.slice(0,-1);
w.push(last);
return w.join(' ');
}
var AISLE_ORDER=['Produce','Meat & Seafood','Dairy & Eggs','Bakery','Pantry & Baking','Spices & Seasonings','Frozen','Other'];
var AISLE_RULES=[
['Pantry & Baking',/(tomato (sauce|paste)|canned|can of|broth|stock|peanut butter|coconut milk|almond milk|oat milk|cream of tartar|baking (powder|soda)|butter beans)/],
['Frozen',/\b(frozen|ice cream)\b/],
['Meat & Seafood',/\b(chicken|beef|pork|bacon|sausage|ham|turkey|lamb|steak|shrimp|salmon|fish|tuna|cod|brisket|ribs|prosciutto|pancetta)\b/],
['Dairy & Eggs',/\b(milk|butter|cheese|cheddar|mozzarella|parmesan|yogurt|yoghurt|cream|eggs?|buttermilk|ricotta|feta|half-and-half)\b/],
['Spices & Seasonings',/\b(salt|black pepper|white pepper|peppercorns?|pepper flakes|cayenne|paprika|cumin|cinnamon|nutmeg|oregano|turmeric|chili powder|curry|garlic powder|onion powder|dried|ground|seasoning|allspice|cloves?)\b/],
['Produce',/\b(apples?|bananas?|lemons?|limes?|oranges?|berry|berries|tomato(es)?|onions?|shallots?|scallions?|garlic|potato(es)?|carrots?|celery|lettuce|spinach|kale|cucumbers?|zucchini|squash|pumpkin|broccoli|cauliflower|cabbage|mushrooms?|avocados?|jalape\u00f1os?|jalapenos?|bell peppers?|peppers?|corn|peas|cilantro|parsley|basil|mint|dill|rosemary|thyme|sage|chives?|ginger|herbs?|leeks?|asparagus|eggplant|beets?|radish(es)?|peach(es)?|pears?|grapes?|melon|mango|pineapple|cherry|cherries|green beans?)\b/],
['Bakery',/\b(bread|buns?|rolls?|tortillas?|bagels?|pita|baguette|naan|croissants?)\b/],
['Pantry & Baking',/\b(flour|sugar|oil|vinegar|rice|pasta|noodles?|spaghetti|beans?|lentils?|sauce|ketchup|mustard|mayo|mayonnaise|honey|syrup|oats?|cereal|nuts?|almonds?|walnuts?|pecans?|chocolate|cocoa|yeast|cornstarch|cornmeal|breadcrumbs?|panko|jam|jelly|raisins?|extract|vanilla|water|molasses)\b/]
];
function aisleFor(name){
var n=String(name||'').toLowerCase();
for(var i=0;i<AISLE_RULES.length;i++){if(AISLE_RULES[i][1].test(n))return AISLE_RULES[i][0];}
return 'Other';
}

/* ---------- durations, yield, urls ---------- */
function toMinutes(d){
if(d==null||d==='')return '';
if(typeof d==='number')return d>0?String(Math.round(d)):'';
var s=String(d).trim(),m=/^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(s),t=0;
if(m){t=(+(m[1]||0))*1440+(+(m[2]||0))*60+(+(m[3]||0))+Math.ceil((+(m[4]||0))/60);}
else{
var h=/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\b/i.exec(s),mm=/(\d+)\s*(?:m|min|mins|minutes?)\b/i.exec(s);
if(h)t+=parseFloat(h[1])*60;
if(mm)t+=+mm[1];
else if(!h&&/^\d+$/.test(s))t=+s;
}
return t>0?String(Math.round(t)):'';
}
function parseYield(y){
var list=toArr(y),i,m;
for(i=0;i<list.length;i++){m=/(\d+(?:\.\d+)?)/.exec(clean(list[i]));if(m)return String(Math.round(parseFloat(m[1])));}
return '';
}
function cleanUrl(u){
try{
var x=new URL(u);
x.hash='';
Array.from(x.searchParams.keys()).forEach(function(k){if(/^(utm_|fbclid|gclid|mc_|ref$|source$|igshid)/i.test(k))x.searchParams.delete(k);});
return x.toString();
}catch(e){return u||'';}
}
function urlKey(u){
try{var x=new URL(u);return x.hostname.replace(/^www\./,'').toLowerCase()+x.pathname.replace(/\/+$/,'').toLowerCase();}catch(e){return '';}
}
function nameKey(n){return String(n||'').toLowerCase().replace(/[^a-z0-9]+/g,'');}
function absUrl(u,base){
if(!u)return '';
try{var x=new URL(u,base||undefined).toString();return x.replace(/^http:\/\//,'https://');}catch(e){return String(u);}
}

/* ---------- category / cuisine / diet mapping ---------- */
var CATS=['Breakfast','Lunch','Dinner','Dessert','Snack','Soup','Salad','Baking','Drink','Side Dish','Appetizer'];
var CAT_SYN=[['Breakfast',/breakfast|brunch/],['Dessert',/dessert|cake|cookie|brownie|pie\b/],['Soup',/soup|stew|chowder/],['Salad',/salad/],['Baking',/bread|baking|baked goods/],['Drink',/drink|beverage|cocktail|smoothie/],['Side Dish',/side/],['Appetizer',/appetizer|starter|hors|dip/],['Snack',/snack/],['Lunch',/lunch|sandwich/],['Dinner',/dinner|main|entree|entr\u00e9e|supper/]];
function mapCategory(x){
var items=toArr(x).reduce(function(a,v){return a.concat(String(v).split(','));},[]).map(function(v){return v.trim().toLowerCase();}).filter(Boolean);
for(var k=0;k<items.length;k++){
var s=items[k],i,j;
for(i=0;i<CATS.length;i++){if(s.indexOf(CATS[i].toLowerCase())>=0)return CATS[i];}
for(j=0;j<CAT_SYN.length;j++){if(CAT_SYN[j][1].test(s))return CAT_SYN[j][0];}
}
return '';
}
var CUIS=['American','Southern','Italian','Mexican','Asian','French','Mediterranean','Indian','German','Greek','Japanese','Chinese','Thai','Middle Eastern'];
var CUIS_SYN=[['Asian',/korean|vietnamese|asian|filipino|indonesian/],['Mediterranean',/spanish|mediterranean|portuguese/],['Middle Eastern',/lebanese|turkish|persian|israeli|moroccan|middle eastern/],['American',/tex-mex|cajun|creole|bbq|barbecue/]];
function mapCuisine(x){
var items=toArr(x).reduce(function(a,v){return a.concat(String(v).split(','));},[]).map(function(v){return v.trim().toLowerCase();}).filter(Boolean);
for(var k=0;k<items.length;k++){
var s=items[k],i,j;
for(i=0;i<CUIS.length;i++){if(s.indexOf(CUIS[i].toLowerCase())>=0)return CUIS[i];}
for(j=0;j<CUIS_SYN.length;j++){if(CUIS_SYN[j][1].test(s))return CUIS_SYN[j][0];}
}
return '';
}
function mapDiets(x){
var s=toArr(x).join(' ').toLowerCase(),o=[];
if(/vegandiet|\bvegan\b/.test(s))o.push('vegan');
if(/vegetariandiet|vegetarian/.test(s)&&o.indexOf('vegan')<0)o.push('vegetarian');
if(/glutenfreediet|gluten[- ]?free/.test(s))o.push('glutenfree');
return o;
}

/* ---------- tier 1: JSON-LD ---------- */
function typesOf(x){return toArr(x&&x['@type']).map(function(t){return String(t).split(/[\/#:]/).pop();});}
function flattenSteps(ri){
var out=[];
function walk(x,d){
if(x==null||d>6)return;
if(typeof x==='string'){var c=clean(x);if(c){c.split('\n').forEach(function(l){l=l.replace(/^\s*(?:step\s*)?\d+[.):]\s+/i,'').trim();if(l)out.push(l);});}return;}
if(Array.isArray(x)){x.forEach(function(y){walk(y,d+1);});return;}
if(typeof x==='object'){
if(x.itemListElement){walk(x.itemListElement,d+1);return;}
var t=x.text||x.description||x.name;
if(t)walk(String(t),d+1);
}
}
walk(ri,0);
var seen={};
return out.filter(function(l){var k=l.toLowerCase();if(seen[k])return false;seen[k]=1;return true;});
}
function personName(a){
var f=toArr(a)[0];
if(!f)return '';
return oneLine(typeof f==='string'?f:(f.name||''));
}
function imageOf(i){
var f=toArr(i)[0];
if(!f)return '';
if(Array.isArray(f))f=f[0];
return typeof f==='string'?f:(f&&(f.url||f.contentUrl)||'');
}
function rawFromLd(r){
var n=r.nutrition||{};
var ing=toArr(r.recipeIngredient||r.ingredients);
var ings=[];
ing.forEach(function(x){clean(typeof x==='string'?x:(x&&x.text)||'').split('\n').forEach(function(l){l=l.trim();if(l)ings.push(l);});});
return {
name:oneLine(r.name||r.headline||''),
description:clean(r.description||''),
author:personName(r.author),
image:imageOf(r.image),
yield:r.recipeYield,
prep:r.prepTime,cook:r.cookTime,total:r.totalTime,
category:r.recipeCategory,cuisine:r.recipeCuisine,
diets:r.suitableForDiet,
ingredients:ings,
steps:flattenSteps(r.recipeInstructions),
nutrition:{calories:n.calories,protein:n.proteinContent,carbs:n.carbohydrateContent,fat:n.fatContent}
};
}
function ldCandidates(doc){
var found=[],nodes=Array.prototype.slice.call(doc.querySelectorAll('script[type="application/ld+json"]'));
function walk(v,d){
if(!v||typeof v!=='object'||d>8)return;
if(Array.isArray(v)){v.forEach(function(x){walk(x,d+1);});return;}
if(typesOf(v).indexOf('Recipe')>=0){found.push(v);return;}
Object.keys(v).forEach(function(k){if(k!=='@context')walk(v[k],d+1);});
}
nodes.forEach(function(n){
var txt=(n.textContent||'').replace(/^\s*<!--|-->\s*$/g,'').replace(/^\s*\/\/\s*<!\[CDATA\[|\/\/\s*\]\]>\s*$/g,'').trim(),j=null;
try{j=JSON.parse(txt);}catch(e){try{j=JSON.parse(txt.replace(/[\u0000-\u001f]+/g,' '));}catch(e2){j=null;}}
walk(j,0);
});
return found;
}
function tierJsonLd(doc){
var best=null,bestScore=-1;
ldCandidates(doc).forEach(function(c){
var raw=rawFromLd(c),sc=raw.ingredients.length*2+raw.steps.length+(raw.name?1:0);
if(sc>bestScore){best=raw;bestScore=sc;}
});
return best;
}

/* ---------- tier 2: microdata ---------- */
function mdValue(el){
if(el.hasAttribute('content'))return el.getAttribute('content');
var tag=el.tagName.toLowerCase();
if(tag==='meta')return el.getAttribute('content')||'';
if(tag==='time'&&el.hasAttribute('datetime'))return el.getAttribute('datetime');
if(tag==='img'||tag==='source')return el.getAttribute('src')||'';
if(tag==='a'||tag==='link')return el.getAttribute('href')||el.textContent;
return el.textContent;
}
function tierMicrodata(doc){
var root=doc.querySelector('[itemtype*="schema.org/Recipe"]');
if(!root)return null;
function props(name){
return Array.prototype.slice.call(root.querySelectorAll('[itemprop~="'+name+'"]'));
}
function first(name){var e=props(name)[0];return e?mdValue(e):'';}
var ings=[];
props('recipeIngredient').concat(props('ingredients')).forEach(function(e){var t=oneLine(mdValue(e));if(t)ings.push(t);});
var steps=[];
props('recipeInstructions').forEach(function(e){
var kids=Array.prototype.slice.call(e.querySelectorAll('li,[itemprop~="text"],p'));
if(kids.length){kids.forEach(function(k){var t=oneLine(k.textContent);if(t)steps.push(t);});}
else{flattenSteps(mdValue(e)).forEach(function(t){steps.push(t);});}
});
var nutr=root.querySelector('[itemtype*="NutritionInformation"]');
function nv(n){if(!nutr)return '';var e=nutr.querySelector('[itemprop~="'+n+'"]');return e?mdValue(e):'';}
return {
name:oneLine(first('name')),
description:clean(first('description')),
author:oneLine(first('author')),
image:first('image'),
yield:first('recipeYield'),
prep:first('prepTime'),cook:first('cookTime'),total:first('totalTime'),
category:first('recipeCategory'),cuisine:first('recipeCuisine'),
diets:first('suitableForDiet'),
ingredients:ings,
steps:steps,
nutrition:{calories:nv('calories'),protein:nv('proteinContent'),carbs:nv('carbohydrateContent'),fat:nv('fatContent')}
};
}

/* ---------- tier 3: adapters (supports + extract) ---------- */
function listText(doc,sel){
return Array.prototype.slice.call(doc.querySelectorAll(sel)).map(function(e){return oneLine(e.textContent);}).filter(Boolean);
}
function selectorAdapter(name,detect,sel){
return {
name:name,
supports:function(host,doc){return !!doc.querySelector(detect);},
extract:function(doc){
var t=sel.name?listText(doc,sel.name)[0]:'';
var img=sel.image?doc.querySelector(sel.image):null;
return {
name:t||'',
ingredients:listText(doc,sel.ing),
steps:listText(doc,sel.steps),
image:img?(img.getAttribute('data-src')||img.getAttribute('src')||''):''
};
}
};
}
var adapters=[
selectorAdapter('wprm','.wprm-recipe-container,.wprm-recipe',{name:'.wprm-recipe-name',ing:'.wprm-recipe-ingredient',steps:'.wprm-recipe-instruction-text',image:'.wprm-recipe-image img'}),
selectorAdapter('tasty','.tasty-recipes',{name:'.tasty-recipes-title,.tasty-recipes h2',ing:'.tasty-recipes-ingredients li',steps:'.tasty-recipes-instructions li',image:'.tasty-recipes-image img'}),
selectorAdapter('mediavine-create','.mv-create-wrapper',{name:'.mv-create-title',ing:'.mv-create-ingredients li',steps:'.mv-create-instructions li',image:'.mv-create-image img'})
];

/* ---------- tier 4: heading heuristics ---------- */
function sectionItems(doc,re){
var heads=Array.prototype.slice.call(doc.querySelectorAll('h1,h2,h3,h4,h5,strong,b,summary'));
for(var i=0;i<heads.length;i++){
var t=oneLine(heads[i].textContent).toLowerCase();
if(t.length>40||!re.test(t))continue;
var el=heads[i],hops=0,list=null;
while(el&&hops<6&&!list){
var sib=el.nextElementSibling;
while(sib&&!list){
if(/^(UL|OL)$/.test(sib.tagName))list=sib;
else{var inner=sib.querySelector&&sib.querySelector('ul,ol');if(inner)list=inner;}
if(!list)sib=sib.nextElementSibling;
if(!list)break;
}
el=el.parentElement;hops++;
if(list)break;
}
if(list){
var items=Array.prototype.slice.call(list.querySelectorAll('li')).map(function(li){return oneLine(li.textContent);}).filter(Boolean);
if(items.length>=2)return items;
}
}
return [];
}
function tierHeuristic(doc){
var og=doc.querySelector('meta[property="og:image"]'),h1=doc.querySelector('h1'),od=doc.querySelector('meta[property="og:description"],meta[name="description"]');
var ings=sectionItems(doc,/^(ingredients?|what you.ll need|you will need)\b/),steps=sectionItems(doc,/^(instructions?|directions?|method|preparation|steps)\b/);
return {
name:oneLine((h1&&h1.textContent)||(doc.title||'')),
description:od?clean(od.getAttribute('content')):'',
image:og?og.getAttribute('content'):'',
ingredients:ings,
steps:steps
};
}

/* ---------- merge + normalize ---------- */
var FIELDS=['name','description','author','image','yield','prep','cook','total','category','cuisine','diets','ingredients','steps','nutrition'];
function empty(v){
if(v==null||v==='')return true;
if(Array.isArray(v))return v.length===0;
if(typeof v==='object'){return !Object.keys(v).some(function(k){return !empty(v[k]);});}
return false;
}
function num(v){var m=/(\d+(?:\.\d+)?)/.exec(String(v==null?'':v).replace(/,/g,''));return m?m[1]:'';}
function finalize(raw,url,doc){
var host='';
try{host=new URL(url).hostname.replace(/^www\./,'');}catch(e){}
var n=raw.nutrition||{};
var bits=[];
if(raw.description)bits.push(raw.description.replace(/\s+/g,' '));
if(raw.author)bits.push('Originally by '+raw.author+'.');
if(host)bits.push('Imported from '+host+'.');
var prep=toMinutes(raw.prep),cook=toMinutes(raw.cook),total=toMinutes(raw.total);
var active=prep||total,passive=cook;
if(prep&&total&&!cook&&+total>+prep)passive=String(+total-+prep);
return {
name:raw.name||'',
cat:mapCategory(raw.category),
cuisine:mapCuisine(raw.cuisine),
servings:parseYield(raw.yield),
active:active||'',
passive:passive||'',
photo:absUrl(raw.image,url),
desc:bits.join(' ').slice(0,600),
cal:num(n.calories)?String(Math.round(+num(n.calories))):'',
protein:num(n.protein)?String(Math.round(+num(n.protein)*10)/10):'',
carbs:num(n.carbs)?String(Math.round(+num(n.carbs)*10)/10):'',
fat:num(n.fat)?String(Math.round(+num(n.fat)*10)/10):'',
sourceUrl:cleanUrl(url||''),
diets:mapDiets(raw.diets),
ingredients:(raw.ingredients||[]).map(parseIngredient).filter(function(i){return i.name;}),
steps:(raw.steps||[]).filter(Boolean)
};
}
function extract(doc,url){
var host='';
try{host=new URL(url).hostname.replace(/^www\./,'');}catch(e){}
var tiers=[['json-ld',function(){return tierJsonLd(doc);}],['microdata',function(){return tierMicrodata(doc);}]];
adapters.forEach(function(a){tiers.push(['adapter:'+a.name,function(){return a.supports(host,doc)?a.extract(doc):null;}]);});
tiers.push(['heuristic',function(){return tierHeuristic(doc);}]);
var merged={},used={},source='none';
tiers.forEach(function(t){
var r=null;
try{r=t[1]();}catch(e){r=null;}
if(!r)return;
FIELDS.forEach(function(f){
if(empty(merged[f])&&!empty(r[f])){merged[f]=r[f];used[t[0]]=1;}
});
if(source==='none'&&((r.ingredients&&r.ingredients.length)||(r.steps&&r.steps.length)))source=t[0];
});
var recipe=finalize(merged,url,doc);
if(!recipe.name&&doc.title)recipe.name=oneLine(doc.title);
var warnings=[];
if(!recipe.ingredients.length)warnings.push('No ingredients found');
if(!recipe.steps.length)warnings.push('No instructions found');
return {recipe:recipe,source:source,tiersUsed:Object.keys(used),warnings:warnings};
}

return {
version:VERSION,
extract:extract,
parseIngredient:parseIngredient,
parseQty:parseQty,formatQty:formatQty,scaleQty:scaleQty,normQty:normQty,
canonUnit:canonUnit,displayUnit:displayUnit,metric:metric,addQuantities:addQuantities,
normalizeKey:normalizeKey,aisleFor:aisleFor,aisleOrder:AISLE_ORDER,
toMinutes:toMinutes,parseYield:parseYield,
cleanUrl:cleanUrl,urlKey:urlKey,nameKey:nameKey,
adapters:adapters
};
}
if(typeof module!=='undefined'&&module.exports)module.exports=wfcParserLib;
