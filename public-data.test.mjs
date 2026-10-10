import test from 'node:test';
import assert from 'node:assert/strict';
import {companyResponse,publishedRatios} from './public-data.mjs';
import {calculateRatios} from './ratios.mjs';

const reports={IncSta:{year:[],quarter:[]},BSheet:{year:[],quarter:[]},CashFlow:{year:[],quarter:[]},CafeFRatios:{year:[]}};
const c={reports,coverage:[{kind:'BSheet',status:'empty'}]};
test('public routes preserve empty source periods and reject administrative endpoints',()=>{
  assert.deepEqual(companyResponse(c,'/api/coverage'),c.coverage);
  assert.deepEqual(companyResponse(c,'/api/reports'),[]);
  assert.deepEqual(companyResponse(c,'/api/ratios','quarter'),calculateRatios([],'quarter'));
  assert.throws(()=>companyResponse(c,'/api/sync-all'));
  assert.throws(()=>companyResponse(c,'/api/reports','month'));
  assert.throws(()=>companyResponse(c,'/api/reports','year','unknown'));
});
test('public data keeps exact raw numbers, zero and null distinct, and published ratio units',()=>{
  const source=[{period:'2025',rows:[{code:'eps',value:'12345678901234567890.125',display:'12.3',unit:'thousand-VND/share'},{code:'zero',value:'0',display:null,unit:'times'},{code:'missing',value:null,display:null,unit:'percent'}]}];
  const result=publishedRatios(source);
  assert.equal(result[0].rows[0].value,'12345678901234567890.125');
  assert.equal(result[0].rows[0].unit,'nghìn đồng/CP');
  assert.equal(result[0].rows[1].value,'0');
  assert.equal(result[0].rows[2].value,null);
  assert.equal(source[0].rows[0].unit,'thousand-VND/share');
  assert.deepEqual(companyResponse({reports:{CafeFRatios:{year:source}}},'/api/published-ratios','quarter'),[]);
});
