const path=require('node:path');
const {loadTypescript}=require('./migrate_db.cjs');
function getClient(){
  const sql=loadTypescript(path.resolve(__dirname,'../src/lib/database.ts')).getDatabaseClient();
  if(!sql)throw Error('This command requires an explicitly configured PostgreSQL database; DB_MODE=local disables database access.');
  return sql;
}
module.exports={getClient};
