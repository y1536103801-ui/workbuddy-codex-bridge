import { build } from 'esbuild';
import { mkdir, cp } from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const name of ['cli','server','accounts'])await build({entryPoints:[`src/${name}.mjs`],outfile:`dist/${name}.mjs`,bundle:true,platform:'node',format:'esm',target:'node22',sourcemap:false,legalComments:'eof'});
await cp('web','dist/web',{recursive:true});
console.log('Built standalone runtime (no Harness/OpenCodex imports).');
