const fs=require('node:fs'),path=require('node:path');
const {validateReport}=require('./validate.cjs');
const contract=JSON.parse(fs.readFileSync(path.join(__dirname,'community-normalized.schema.json')));
function validateNormalizedReport(input){
 if(input?.schema==='llm-benchmarker.community.bundle'){
  if(input.schemaVersion!=='1.1.0'||!Array.isArray(input.reports)||!input.reports.length||Object.keys(input).some(k=>!['schema','schemaVersion','reports'].includes(k)))throw Error('Invalid normalized bundle');
  input.reports.forEach(validateNormalizedReport);return true;
 }
 validateReport(input,contract);
 for(const machine of input.machines)if(machine.naming.matchKey!==machine.naming.normalizedName.toLowerCase())throw Error('Invalid machine match key');
 for(const test of input.tests){if(test.model.naming.matchKey!==test.model.naming.normalizedName.toLowerCase()||test.model.naming.originalName!==test.model.id)throw Error('Invalid model name identity');}
 return true;
}
module.exports={validateNormalizedReport};
if(require.main===module){validateNormalizedReport(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));console.log('PASS: normalized community report/bundle');}
