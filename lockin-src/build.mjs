import { build } from 'esbuild';
await build({ entryPoints: ['src/cloud.js'], bundle: true, format: 'esm', minify: true, target: ['es2019','safari15'], outfile: process.argv[2] || '../lockin/cloud.js', legalComments: 'none', banner: { js: '/* Lock-In cloud sync. Built from lockin-build/src with Firebase JS SDK 12.19.0 (Apache-2.0). */' } });
