import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, cp, rm, chmod } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const run=promisify(execFile),version=JSON.parse(await readFile('package.json')).version;
const NODE_VERSION='24.22.2';
const architectures=process.env.WBCB_PACKAGE_ARCH?[process.env.WBCB_PACKAGE_ARCH]:['arm64','x64'];
await mkdir('.cache',{recursive:true});await mkdir('release',{recursive:true});
const shas=await (await fetch(`https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt`,{signal:AbortSignal.timeout(30000)})).text();
const sourceCommit=(await run('/usr/bin/git',['rev-parse','HEAD'])).stdout.trim();
const manifest={version,sourceCommit,nodeVersion:NODE_VERSION,builtAt:new Date().toISOString(),packages:[]};
for(const arch of architectures){
 if(!['arm64','x64'].includes(arch))throw Error('Unsupported arch');
 const filename=`node-v${NODE_VERSION}-darwin-${arch}.tar.gz`;const expected=shas.split('\n').find(l=>l.endsWith('  '+filename))?.split(' ')[0];if(!expected)throw Error('Official Node checksum not found');
 const archive=join('.cache',filename);let buffer;try{buffer=await readFile(archive);}catch{const response=await fetch(`https://nodejs.org/dist/v${NODE_VERSION}/${filename}`,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error('Node download failed');buffer=Buffer.from(await response.arrayBuffer());await writeFile(archive,buffer);}
 const digest=createHash('sha256').update(buffer).digest('hex');if(digest!==expected)throw Error('Node checksum mismatch');
 await run('/usr/bin/tar',['-xzf',archive,'-C','.cache']);const nodeRoot=join('.cache',`node-v${NODE_VERSION}-darwin-${arch}`);
 const folder=join('release',`WorkBuddy-Codex-Bridge-${version}-macOS-${arch}`);await rm(folder,{recursive:true,force:true});
 const app=join(folder,'WorkBuddy Codex Bridge.app'),resources=join(app,'Contents','Resources'),macos=join(app,'Contents','MacOS');await mkdir(resources,{recursive:true});await mkdir(macos,{recursive:true});
 for(const file of ['cli.mjs','server.mjs','accounts.mjs'])await cp(join('dist',file),join(resources,file));await cp('dist/web',join(resources,'web'),{recursive:true});
 await cp(join(nodeRoot,'bin/node'),join(resources,'node'));await cp(join(nodeRoot,'LICENSE'),join(resources,'NODE-LICENSE'));await writeFile(join(resources,'BUILD.json'),JSON.stringify({version,sourceCommit,nodeVersion:NODE_VERSION,arch},null,2));await cp('LICENSE',join(resources,'LICENSE'));await cp('THIRD_PARTY_NOTICES.txt',join(resources,'THIRD_PARTY_NOTICES.txt'));
 const tomlLicense=await readFile('node_modules/smol-toml/LICENSE','utf8');await writeFile(join(resources,'SMOL-TOML-LICENSE'),tomlLicense);
 const info=`<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>launcher</string><key>CFBundleIdentifier</key><string>org.workbuddy.codex.bridge</string><key>CFBundleName</key><string>WorkBuddy Codex Bridge</string><key>CFBundleDisplayName</key><string>WorkBuddy Codex Bridge</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>${version}</string><key>CFBundleVersion</key><string>${version}</string><key>LSMinimumSystemVersion</key><string>13.0</string><key>LSUIElement</key><true/><key>NSHighResolutionCapable</key><true/></dict></plist>`;
 await writeFile(join(app,'Contents','Info.plist'),info);
 await run('/usr/bin/swiftc',['scripts/Launcher.swift','-O','-target',`${arch==='x64'?'x86_64':'arm64'}-apple-macosx13.0`,'-o',join(macos,'launcher')],{timeout:180000});
 await chmod(join(resources,'node'),0o755);await run('/usr/bin/codesign',['--force','--deep','--sign','-',app],{timeout:30000});
 const installer='#!/bin/sh\nset -eu\nHERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"\nexec "$HERE/WorkBuddy Codex Bridge.app/Contents/Resources/node" "$HERE/WorkBuddy Codex Bridge.app/Contents/Resources/cli.mjs" install\n';
 await writeFile(join(folder,'安装.command'),installer,{mode:0o755});await writeFile(join(folder,'卸载.command'),installer.replace(' install\n',' uninstall\n'),{mode:0o755});
 await cp('docs/INSTALL.zh-CN.md',join(folder,'使用说明.md'));
 const zip=folder+'.zip';await rm(zip,{force:true});await run('/usr/bin/ditto',['-c','-k','--sequesterRsrc','--keepParent',folder,zip],{timeout:180000});
 const data=await readFile(zip);manifest.packages.push({file:zip.split('/').at(-1),arch,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),nodeArchiveSha256:expected});console.log('Packaged '+zip);
}
await writeFile('release/manifest.json',JSON.stringify(manifest,null,2)+'\n');await writeFile('release/SHA256SUMS.txt',manifest.packages.map(p=>p.sha256+'  '+p.file).join('\n')+'\n');
