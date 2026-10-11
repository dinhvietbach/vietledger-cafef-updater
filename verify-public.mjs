import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {companyResponse} from './public-data.mjs';
import {INDUSTRY_NAMES,INDUSTRY_SOURCE} from './cafef-industries.mjs';
import {qualifiesGrowth,safeSourceUrl} from './growth.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const {out,audit}=JSON.parse(fs.readFileSync(path.join(root,'release/latest-public-build.json')));
const expected=JSON.parse(fs.readFileSync(audit));
const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));
if(manifest.industries){
  assert.equal(manifest.industries.source,INDUSTRY_SOURCE);
  assert.ok(Number.isFinite(Date.parse(manifest.industries.checkedAt)));
  assert.ok(manifest.companies.some(c=>c.industryId!=null));
}
for(const c of manifest.companies)assert.equal(c.industryName,c.industryId==null?null:INDUSTRY_NAMES[c.industryId]);
let companies=0,reports=0,cells=0;
const seen=new Set();
for(const asset of expected.assets){
  const buffer=fs.readFileSync(path.join(out,asset.path));
  assert.equal(createHash('sha256').update(buffer).digest('hex'),asset.sha256);
  const chunk=JSON.parse(gunzipSync(buffer));
  for(const [symbol,data] of Object.entries(chunk)){
    assert.ok(!seen.has(symbol),'Duplicate company');seen.add(symbol);companies++;
    assert.equal(manifest.companies.find(c=>c.symbol===symbol)?.asset,'/'+asset.path);
    for(const kinds of Object.values(data.reports))for(const periods of Object.values(kinds))for(const r of periods)if(!r.missing){
      reports++;cells+=r.rows.length;
      for(const row of r.rows)assert.ok(row.value===null||typeof row.value==='string','Source precision must be retained');
    }
    if(['HPG','VCB','SSI','BVH','FPT'].includes(symbol))for(const frequency of ['year','quarter']){
      const ratios=companyResponse(data,'/api/ratios',frequency);
      assert.ok(Array.isArray(ratios));
      if(symbol==='HPG')assert.ok(ratios.length>0);
    }
  }
}
assert.equal(companies,expected.companies);assert.equal(reports,expected.reports);assert.equal(cells,expected.cells);
assert.equal(Object.keys(manifest.earnings).length,expected.earningsAssets.length);
for(const asset of expected.earningsAssets){
  const buffer=fs.readFileSync(path.join(out,asset.path));
  assert.equal(createHash('sha256').update(buffer).digest('hex'),asset.sha256);
  const season=JSON.parse(gunzipSync(buffer));
  assert.equal(season.period,asset.period);assert.equal(manifest.earnings[asset.period],'/'+asset.path);
  assert.equal(season.companies.length,companies);
  assert.equal(new Set(season.companies.map(c=>c.symbol)).size,companies);
  assert.deepEqual(Object.keys(season.analysis).sort(),season.companies.filter(c=>qualifiesGrowth(c)).map(c=>c.symbol).sort());
  for(const [symbol,a] of Object.entries(season.analysis)){assert.ok(Array.isArray(a.evidence)&&Array.isArray(a.cautions));if(a.researchStatus==='verified')assert.ok(a.businessNote&&a.businessSources.length);}
  for(const [symbol,r] of Object.entries(season.research)){assert.equal(r.symbol,symbol);assert.equal(r.period,season.period);for(const url of [r.articleUrl,...(r.attachments||[]).map(a=>a.url)].filter(Boolean))assert.ok(safeSourceUrl(url));}
  for(const c of season.companies)for(const m of Object.values(c.metrics)){
    assert.ok(m.current.value===null||typeof m.current.value==='string');
    if(!c.available)assert.equal(m.current.value,null);
  }
}
const fileList=fs.readdirSync(out,{recursive:true}).filter(p=>fs.statSync(path.join(out,p)).isFile());
assert.equal(fileList.length,expected.files);assert.ok(fileList.length<=1000);
assert.ok(!fileList.some(p=>/sqlite|login|\.env|auth|server|\.ps1/.test(p)));
assert.equal(manifest.status.scheduler.enabled,process.env.PUBLIC_CLOUD_SCHEDULE==='true');
console.log(JSON.stringify({verified:true,companies,reports,cells,files:fileList.length,compressedMiB:Math.round(expected.compressedDataBytes/1048576),largestAssetMiB:(expected.maxAssetBytes/1048576).toFixed(2)},null,2));
