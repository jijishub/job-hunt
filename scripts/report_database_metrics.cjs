// Reads existing server logs only. Never opens a database connection.
const fs=require('node:fs');
function summarize(text) {
  const groups=new Map();
  for(const line of text.split(/\r?\n/)) {
    let event;try{event=JSON.parse(line);}catch{continue;}
    if(!['database_query','database_transaction','api_response'].includes(event.event))continue;
    const key=[event.event,event.operation||event.fingerprint||event.provider].join(':');
    const group=groups.get(key)||{operation:key,events:0,operations:0,jsonBytes:0,failures:0,totalMs:0};
    group.events++;group.operations+=Number(event.operations||1);group.jsonBytes+=Number(event.resultJsonBytes||event.responseJsonBytes||0);group.totalMs+=Number(event.durationMs||0);if(event.success===false)group.failures++;
    groups.set(key,group);
  }
  return {note:'JSON byte estimates, not billed wire bytes. Database and API totals are separate; do not add them together.',operations:[...groups.values()]};
}
if(require.main===module)console.log(JSON.stringify(summarize(fs.readFileSync(process.argv[2]||0,'utf8')),null,2));
module.exports={summarize};
