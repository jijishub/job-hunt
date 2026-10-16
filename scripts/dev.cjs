const path = require('node:path');
const { spawn } = require('node:child_process');

function developmentEnvironment(env) {
  const next = { ...env, NODE_ENV: 'development' };
  if (env.DEV_DATABASE_URL && env.DB_MODE !== 'local') {
    if ([env.POSTGRES_URL,env.DATABASE_URL].includes(env.DEV_DATABASE_URL)) throw Error('DEV_DATABASE_URL must differ from the configured production URL.');
    next.POSTGRES_URL = env.DEV_DATABASE_URL;
    next.DATABASE_URL = env.DEV_DATABASE_URL;
    next.DB_DRIVER = env.DEV_DB_DRIVER || 'postgres';
    next.DB_MODE = 'database';
  } else {
    next.DB_MODE = 'local';
    next.DB_LOCAL_DIR = env.DB_LOCAL_DIR || '.data/development';
    next.POSTGRES_URL = '';
    next.DATABASE_URL = '';
  }
  return next;
}
function main() {
  require('@next/env').loadEnvConfig(path.resolve(__dirname,'..'),true);
  const env = developmentEnvironment(process.env);
  console.log(env.DB_MODE === 'local' ? 'Development uses isolated local JSON storage.' : 'Development uses DEV_DATABASE_URL.');
  const child = spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev',...process.argv.slice(2)],{env,stdio:'inherit',windowsHide:true});
  child.on('error',()=>{console.error('Could not start the development server.');process.exitCode=1;});
  child.on('exit',code=>{process.exitCode=code || 0;});
}
if(require.main===module){try{main();}catch{console.error('Development database configuration is unsafe. Use separate DEV_DATABASE_URL or local JSON storage.');process.exitCode=1;}}
module.exports={developmentEnvironment};
