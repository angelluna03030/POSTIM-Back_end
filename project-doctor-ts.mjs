#!/usr/bin/env node
/**
 * 🩺 project-doctor.mjs  ─  Generic Edition (TypeScript)
 *
 * Para cualquier proyecto Node.js / React / Next.js con TypeScript
 * Uso: node project-doctor.mjs [--fix] [--deep] [--ci] [--json] [--skip-install]
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// ─────────────────────────────────────────
// FLAGS & CONFIG
// ─────────────────────────────────────────
const ARGS      = process.argv.slice(2);
const FIX       = ARGS.includes("--fix");
const DEEP      = ARGS.includes("--deep");
const CI        = ARGS.includes("--ci");
const JSON_OUT  = ARGS.includes("--json");
const SKIP_INST = ARGS.includes("--skip-install");
const ROOT      = process.cwd();
const PKG_PATH  = path.join(ROOT, "package.json");

// ─────────────────────────────────────────
// UI
// ─────────────────────────────────────────
const C = {
  reset:"\x1b[0m", bold:"\x1b[1m", dim:"\x1b[2m",
  red:"\x1b[31m", green:"\x1b[32m", yellow:"\x1b[33m",
  blue:"\x1b[34m", magenta:"\x1b[35m", cyan:"\x1b[36m",
  bgBlue:"\x1b[44m", bgRed:"\x1b[41m", white:"\x1b[37m",
};
const I = {
  ok:`${C.green}✔${C.reset}`, warn:`${C.yellow}⚠${C.reset}`,
  err:`${C.red}✖${C.reset}`, info:`${C.cyan}ℹ${C.reset}`,
  fix:`${C.magenta}⚡${C.reset}`, run:`${C.blue}▶${C.reset}`,
};

const sec = (t) => console.log(`\n${C.bold}${C.bgBlue}  ${t}  ${C.reset}\n`);
const log = (ic,msg,d="") => console.log(`  ${ic} ${msg}${d ? `  ${C.dim}→ ${d}${C.reset}` : ""}`);

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
const run    = (cmd,o={}) => { try { return execSync(cmd,{cwd:ROOT,encoding:"utf8",stdio:"pipe",...o}); } catch(e){ return e.stdout||e.stderr||""; }};
const hasPkg = (n) => fs.existsSync(path.join(ROOT,"node_modules",n));
const readPkg= () => JSON.parse(fs.readFileSync(PKG_PATH,"utf8"));
const writePkg=(p) => fs.writeFileSync(PKG_PATH,JSON.stringify(p,null,2)+"\n","utf8");

function getAllFiles(dir, exts, ignore=["node_modules","dist","build",".git","coverage",".next","out"]) {
  const res=[];
  if(!fs.existsSync(dir)) return res;
  function walk(d){
    for(const f of fs.readdirSync(d)){
      if(ignore.some(i=>f===i||d.includes(path.sep+i))) continue;
      const full=path.join(d,f);
      if(fs.statSync(full).isDirectory()) walk(full);
      else if(exts.some(e=>full.endsWith(e))) res.push(full);
    }
  }
  walk(dir); return res;
}

// ─────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────
const R = {
  unusedDeps:[], removedDeps:[], securityIssues:[],
  lintErrors:0, lintWarnings:0, typeErrors:0,
  testsPassed:null, testsFailed:null, coverage:null,
  circularDeps:[], duplicateDeps:[], largeFiles:[],
  todoCount:0, anyUsage:0, nonNullAssertions:0,
  errors:[], warnings:[],
};

// ─────────────────────────────────────────
// BANNER
// ─────────────────────────────────────────
function banner(pkg){
  const fw = detectFramework(pkg);
  console.log(`
${C.bold}${C.cyan}╔══════════════════════════════════════════════════════╗
║      🩺  PROJECT DOCTOR  ─  TypeScript Edition       ║
║         Auditoría completa · JS / TS projects         ║
╚══════════════════════════════════════════════════════╝${C.reset}

  ${I.info} Proyecto  : ${C.bold}${pkg.name||"?"}${C.reset}  v${pkg.version||"?"}
  ${I.info} Framework : ${C.cyan}${fw}${C.reset}
  ${I.info} Modo      : ${FIX ? `${C.green}--fix (correcciones ON)` : `${C.yellow}solo lectura`}${C.reset}
`);
}

function detectFramework(pkg){
  const deps={...(pkg.dependencies||{}),...(pkg.devDependencies||{})};
  if(deps.next)       return "Next.js";
  if(deps.nuxt)       return "Nuxt.js";
  if(deps["@remix-run/react"]) return "Remix";
  if(deps.astro)      return "Astro";
  if(deps["@sveltejs/kit"]) return "SvelteKit";
  if(deps.react)      return "React";
  if(deps.express)    return "Express";
  if(deps["@nestjs/core"]) return "NestJS";
  return "Node.js genérico";
}

// ─────────────────────────────────────────
// 1. TYPESCRIPT CONFIG
// ─────────────────────────────────────────
async function checkTsConfig() {
  sec("📐 Configuración TypeScript");

  const tscPath = path.join(ROOT,"tsconfig.json");
  if(!fs.existsSync(tscPath)){
    log(I.warn,"tsconfig.json no encontrado");
    if(FIX){
      const config = {
        compilerOptions:{
          target:"ES2020", module:"ESNext", lib:["ES2020","DOM","DOM.Iterable"],
          moduleResolution:"bundler", strict:true, noUnusedLocals:true,
          noUnusedParameters:true, noFallthroughCasesInSwitch:true,
          skipLibCheck:true, esModuleInterop:true, allowSyntheticDefaultImports:true,
          forceConsistentCasingInFileNames:true, resolveJsonModule:true,
          isolatedModules:true, noEmit:true,
          baseUrl:".", paths:{"@/*":["./src/*"]},
        },
        include:["src"],
        exclude:["node_modules","dist","coverage"],
      };
      fs.writeFileSync(tscPath,JSON.stringify(config,null,2)+"\n");
      log(I.fix,"tsconfig.json creado con strict mode");
    }
    return;
  }

  const raw = fs.readFileSync(tscPath,"utf8")
    .replace(/\/\/.*$/gm, "")           // elimina comentarios //
    .replace(/\/\*[\s\S]*?\*\//g, "")   // elimina comentarios /* */
    .replace(/,\s*([}\]])/g, "$1");     // elimina trailing commas
  const tsconfig = JSON.parse(raw);
  const opts     = tsconfig.compilerOptions||{};

  const strictChecks = {
    "strict":                opts.strict,
    "noUnusedLocals":        opts.noUnusedLocals,
    "noUnusedParameters":    opts.noUnusedParameters,
    "noImplicitReturns":     opts.noImplicitReturns,
    "skipLibCheck":          opts.skipLibCheck,
    "forceConsistentCasing": opts.forceConsistentCasingInFileNames,
  };

  for(const [k,v] of Object.entries(strictChecks)){
    log(v ? I.ok : I.warn, k, v ? "" : "no habilitado (recomendado: true)");
  }

  if(!opts.strict) R.warnings.push("TypeScript strict mode desactivado");
}

// ─────────────────────────────────────────
// 2. VERIFICACIÓN DE TIPOS
// ─────────────────────────────────────────
async function checkTypes() {
  sec("🔎 TypeScript — Errores de tipos");

  if(!fs.existsSync(path.join(ROOT,"tsconfig.json"))){
    log(I.warn,"Sin tsconfig.json, omitiendo verificación de tipos"); return;
  }

  log(I.run,"Ejecutando tsc --noEmit...");
  const out    = run("npx tsc --noEmit 2>&1");
  const errors = out.split("\n").filter(l=>l.includes(": error TS"));

  R.typeErrors = errors.length;

  if(errors.length===0) log(I.ok,"Sin errores de TypeScript ✓");
  else {
    log(I.err,`${errors.length} errores de TypeScript:`);
    errors.slice(0,8).forEach(e=>log(I.err,`  ${e.trim()}`));
    if(errors.length>8) log(I.dim,`  ... y ${errors.length-8} más`);
    R.errors.push(`${errors.length} errores de TypeScript`);
  }
}

// ─────────────────────────────────────────
// 3. CALIDAD DE TIPOS (any, non-null assertions)
// ─────────────────────────────────────────
async function checkTypeQuality() {
  sec("🏷  Calidad de tipos");

  const files = getAllFiles(path.join(ROOT,"src"),[".ts",".tsx"]);
  if(files.length===0){ log(I.warn,"Sin archivos .ts/.tsx en src/"); return; }

  let anyCount=0, nonNull=0, tsIgnore=0, asAny=0;
  for(const f of files){
    const c=fs.readFileSync(f,"utf8");
    anyCount += (c.match(/:\s*any\b/g)||[]).length;
    nonNull  += (c.match(/!\./g)||[]).length;
    tsIgnore += (c.match(/@ts-ignore/g)||[]).length;
    asAny    += (c.match(/as\s+any\b/g)||[]).length;
  }

  R.anyUsage=anyCount+asAny; R.nonNullAssertions=nonNull;

  log(anyCount===0 ? I.ok : I.warn,
    `Uso de 'any':`, anyCount>0 ? `${anyCount} ocurrencias` : "ninguna ✓");
  log(asAny===0 ? I.ok : I.warn,
    `'as any' casting:`, asAny>0 ? `${asAny} ocurrencias` : "ninguna ✓");
  log(nonNull===0 ? I.ok : I.warn,
    `Non-null assertions (!.):`, nonNull>0 ? `${nonNull} ocurrencias` : "ninguna ✓");
  log(tsIgnore===0 ? I.ok : I.warn,
    `@ts-ignore:`, tsIgnore>0 ? `${tsIgnore} ocurrencias` : "ninguna ✓");

  if(anyCount+asAny>10) R.warnings.push(`Alto uso de 'any': ${anyCount+asAny} ocurrencias`);
  if(tsIgnore>0)        R.warnings.push(`${tsIgnore} @ts-ignore encontrados`);

  // Resumen
  log(I.info,`Total archivos TS analizados: ${files.length}`);
}

// ─────────────────────────────────────────
// 4. DEPENDENCIAS SIN USO
// ─────────────────────────────────────────
async function checkUnusedDeps(pkg) {
  sec("📦 Dependencias no utilizadas");

  if(!hasPkg("depcheck")&&!SKIP_INST){
    log(I.run,"Instalando depcheck...");
    run("npm install --save-dev depcheck --no-audit --no-fund");
  }

  const ignore=[
    "typescript","@types/*","ts-node","tsx","tsup","esbuild",
    "vite","vitest","jest","@testing-library/*",
    "eslint","prettier","@typescript-eslint/*",
    "husky","lint-staged","commitlint",
  ].join(",");

  const out = run(`npx depcheck --json --ignores="${ignore}" 2>/dev/null`);
  let parsed;
  try { parsed=JSON.parse(out); } catch { log(I.warn,"No se pudo parsear depcheck"); return; }

  const unused    = Object.keys(parsed.dependencies   ||{});
  const unusedDev = Object.keys(parsed.devDependencies||{});
  const missing   = Object.keys(parsed.missing        ||{});

  if(unused.length===0&&unusedDev.length===0){
    log(I.ok,"Todas las dependencias están en uso");
  } else {
    if(unused.length>0){
      log(I.warn,`${unused.length} deps de producción sin uso:`,unused.join(", "));
      R.unusedDeps.push(...unused.map(d=>({name:d,type:"dep"})));
      if(FIX){ run(`npm uninstall ${unused.join(" ")} --no-audit`); R.removedDeps.push(...unused); log(I.fix,"Eliminadas"); }
    }
    if(unusedDev.length>0){
      log(I.warn,`${unusedDev.length} devDeps sin uso:`,unusedDev.join(", "));
      R.unusedDeps.push(...unusedDev.map(d=>({name:d,type:"devDep"})));
      if(FIX){ run(`npm uninstall --save-dev ${unusedDev.join(" ")} --no-audit`); R.removedDeps.push(...unusedDev); log(I.fix,"Eliminadas"); }
    }
  }

  if(missing.length>0){
    log(I.err,`${missing.length} deps usadas pero no instaladas:`,missing.join(", "));
    R.errors.push(`Deps faltantes: ${missing.join(", ")}`);
    if(FIX){ run(`npm install ${missing.join(" ")} --no-audit`); log(I.fix,"Instaladas"); }
  }
}

// ─────────────────────────────────────────
// 5. @types FALTANTES
// ─────────────────────────────────────────
async function checkMissingTypes(pkg) {
  sec("🏷  @types faltantes");

  const deps = Object.keys(pkg.dependencies||{});
  const devDeps = Object.keys(pkg.devDependencies||{});
  const allDeps = [...deps,...devDeps];

  // Paquetes JS comunes que tienen @types
  const commonTypes = [
    "express","node","react","react-dom","jest","mocha","jasmine",
    "lodash","uuid","cors","morgan","multer","bcrypt","bcryptjs",
    "jsonwebtoken","compression","helmet","dotenv","supertest",
  ];

  const needsTypes = deps.filter(d=>{
    const baseName = d.replace(/^@[^/]+\//,"");
    return commonTypes.includes(baseName)&&
      !allDeps.includes(`@types/${baseName}`)&&
      !allDeps.includes(`@types/${d}`);
  });

  if(needsTypes.length===0){
    log(I.ok,"Todos los @types necesarios están instalados");
  } else {
    log(I.warn,`${needsTypes.length} @types posiblemente faltantes:`);
    needsTypes.forEach(d=>{
      const baseName = d.replace(/^@[^/]+\//,"");
      log(I.info,`  @types/${baseName}`);
    });
    if(FIX){
      const toInstall=needsTypes.map(d=>`@types/${d.replace(/^@[^/]+\//,"")}`);
      log(I.fix,`Instalando: ${toInstall.join(", ")}`);
      run(`npm install --save-dev ${toInstall.join(" ")} --no-audit`);
      log(I.ok,"@types instalados");
    }
  }
}

// ─────────────────────────────────────────
// 6. SEGURIDAD
// ─────────────────────────────────────────
async function checkSecurity() {
  sec("🔒 Seguridad (npm audit)");
  const out=run("npm audit --json 2>/dev/null");
  let audit={};
  try{ audit=JSON.parse(out||"{}"); }catch{}

  const v=audit.metadata?.vulnerabilities||{};
  const sum=(v.critical||0)+(v.high||0)+(v.moderate||0)+(v.low||0);

  if(sum===0) log(I.ok,"Sin vulnerabilidades");
  else {
    if(v.critical) log(I.err, `${v.critical} críticas`);
    if(v.high)     log(I.err, `${v.high} altas`);
    if(v.moderate) log(I.warn,`${v.moderate} moderadas`);
    if(v.low)      log(I.info,`${v.low} bajas`);
    if(FIX){ run("npm audit fix --no-audit"); log(I.fix,"Parches aplicados"); }
  }
}

// ─────────────────────────────────────────
// 7. LINT
// ─────────────────────────────────────────
async function runLint(pkg) {
  sec("🔍 ESLint");
  if(!pkg.scripts?.lint){ log(I.warn,"Sin script de lint"); return; 
    
  }

  const out=run("npm run lint -- --format compact 2>&1");
  const errors  =(out.match(/: error /g)  ||[]).length;
  const warnings=(out.match(/: warning /g)||[]).length;

  R.lintErrors=errors; R.lintWarnings=warnings;

  if(errors===0&&warnings===0) log(I.ok,"Sin errores de lint");
  else {
    if(errors>0)   { log(I.err, `${errors} errores`);   R.errors.push(`${errors} errores ESLint`); }
    if(warnings>0)   log(I.warn,`${warnings} warnings`);
    if(FIX){ run("npm run lint -- --fix 2>&1"); log(I.fix,"Auto-fix aplicado"); }
  }
}

// ─────────────────────────────────────────
// 8. FORMATO (Prettier)
// ─────────────────────────────────────────
async function checkFormat(pkg) {
  sec("✨ Formato (Prettier)");

  const hasPrettier = hasPkg("prettier")||
    fs.existsSync(path.join(ROOT,".prettierrc"))||
    fs.existsSync(path.join(ROOT,".prettierrc.json"))||
    fs.existsSync(path.join(ROOT,"prettier.config.ts"));

  if(!hasPrettier){
    log(I.warn,"Prettier no encontrado");
    if(FIX){
      run("npm install --save-dev prettier --no-audit");
      const rc={semi:true,singleQuote:true,tabWidth:2,trailingComma:"es5",
        printWidth:100,bracketSpacing:true,arrowParens:"always"};
      fs.writeFileSync(path.join(ROOT,".prettierrc.json"),JSON.stringify(rc,null,2)+"\n");
      log(I.fix,"Prettier instalado y .prettierrc.json creado");
    }
    return;
  }

  const out=run(`npx prettier --check "src/**/*.{ts,tsx,js,jsx,css,scss}" 2>&1`);
  if(out.includes("All matched files use Prettier formatting")) log(I.ok,"Código bien formateado");
  else {
    log(I.warn,"Archivos sin formato encontrados");
    if(FIX){ run(`npx prettier --write "src/**/*.{ts,tsx,js,jsx,css,scss}" 2>&1`); log(I.fix,"Formateado aplicado"); }
  }
}

// ─────────────────────────────────────────
// 9. TESTS
// ─────────────────────────────────────────
async function runTests(pkg) {
  sec("🧪 Tests");
  if(!pkg.scripts?.test){ log(I.warn,"Sin script de test"); return; }

  const out  = run("npm test -- --passWithNoTests 2>&1");
  const pass = +(out.match(/(\d+)\s+passed/)?.[1]||0);
  const fail = +(out.match(/(\d+)\s+failed/)?.[1]||0);

  R.testsPassed=pass; R.testsFailed=fail;

  if(fail===0&&pass>0) log(I.ok,`${pass} tests pasaron`);
  else if(fail>0){
    log(I.err,`${fail} fallaron, ${pass} pasaron`);
    R.errors.push(`${fail} tests fallando`);
    const failLines=out.split("\n").filter(l=>l.includes("FAIL")||l.includes("✗")).slice(0,5);
    failLines.forEach(l=>log(I.err,`  ${l.trim()}`));
  } else log(I.warn,"No se encontraron resultados de tests");

  // Cobertura
  const covOut=run("npm test -- --coverage --coverageReporters=text-summary 2>&1");
  const covMatch=covOut.match(/Statements\s*:\s*([\d.]+)%/);
  if(covMatch){
    const cov=parseFloat(covMatch[1]);
    R.coverage=cov;
    const ico=cov>=80?I.ok:cov>=50?I.warn:I.err;
    log(ico,`Cobertura: ${cov}%`);
    if(cov<50) R.warnings.push(`Cobertura baja: ${cov}%`);
  }
}

// ─────────────────────────────────────────
// 10. DEPENDENCIAS DESACTUALIZADAS
// ─────────────────────────────────────────
async function checkOutdated() {
  sec("🔄 Dependencias desactualizadas");
  const out=run("npm outdated --json 2>/dev/null");
  let od={};
  try{ od=JSON.parse(out||"{}"); }catch{}
  const keys=Object.keys(od);
  if(keys.length===0){ log(I.ok,"Todo actualizado"); return; }

  const major=keys.filter(k=>{
    const c=parseInt((od[k].current||"0").split(".")[0]);
    const l=parseInt((od[k].latest||"0").split(".")[0]);
    return l>c;
  });
  const minor=keys.filter(k=>!major.includes(k));

  if(major.length) log(I.err, `${major.length} con major version desactualizada:`,major.join(", "));
  if(minor.length) log(I.warn,`${minor.length} con updates menores disponibles`);
  if(FIX&&minor.length){ run("npm update --no-audit"); log(I.fix,"Updates menores aplicados"); }
}

// ─────────────────────────────────────────
// 11. CIRCULARES (DEEP)
// ─────────────────────────────────────────
async function checkCircular() {
  if(!DEEP) return;
  sec("🔄 Dependencias circulares");

  if(!hasPkg("madge")&&!SKIP_INST){
    run("npm install --save-dev madge --no-audit");
  }

  const out=run("npx madge --circular --extensions ts,tsx,js,jsx src/ 2>/dev/null");
  if(out.includes("No circular")) log(I.ok,"Sin dependencias circulares");
  else {
    const n=(out.match(/→/g)||[]).length;
    log(I.warn,`${n} ciclos detectados`);
    R.circularDeps=[out.trim()];
  }
}

// ─────────────────────────────────────────
// 12. ARCHIVOS GRANDES + TODOS
// ─────────────────────────────────────────
async function checkCodeQuality() {
  sec("📊 Calidad de código");

  const files=getAllFiles(path.join(ROOT,"src"),[".ts",".tsx",".js",".jsx"]);
  let todos=0; const large=[];
  for(const f of files){
    const c=fs.readFileSync(f,"utf8");
    const lines=c.split("\n");
    todos+=(c.match(/\/\/\s*(TODO|FIXME|HACK|BUG)/gi)||[]).length;
    if(lines.length>300){ large.push({file:path.relative(ROOT,f),lines:lines.length}); }
  }

  R.todoCount=todos; R.largeFiles=large;
  log(todos===0?I.ok:I.warn, todos===0?"Sin TODOs pendientes":`${todos} TODOs/FIXMEs`);
  if(large.length>0){
    log(I.warn,`${large.length} archivos grandes (>300 líneas):`);
    large.slice(0,5).forEach(f=>log(I.info,`  ${f.file}`,`${f.lines} líneas`));
  } else log(I.ok,"Sin archivos excesivamente grandes");
}

// ─────────────────────────────────────────
// 13. SCRIPTS RECOMENDADOS
// ─────────────────────────────────────────
async function checkScripts(pkg) {
  sec("📋 Scripts recomendados");

  const recommended={
    "lint":          "eslint . --ext .ts,.tsx",
    "lint:fix":      "eslint . --ext .ts,.tsx --fix",
    "format":        "prettier --write \"src/**/*.{ts,tsx,css,scss}\"",
    "format:check":  "prettier --check \"src/**/*.{ts,tsx,css,scss}\"",
    "type-check":    "tsc --noEmit",
    "test:coverage": pkg.scripts?.test?.includes("vitest")
                       ? "vitest run --coverage"
                       : "jest --coverage",
    "clean":         "rm -rf dist .next out coverage",
  };

  const missing=Object.entries(recommended).filter(([k])=>!pkg.scripts?.[k]);
  if(missing.length===0){ log(I.ok,"Todos los scripts recomendados presentes"); return; }

  log(I.info,`${missing.length} scripts recomendados faltantes:`);
  missing.forEach(([k,v])=>log(I.warn,`  "${k}"`,v));

  if(FIX){
    const p=readPkg();
    if(!p.scripts) p.scripts={};
    missing.forEach(([k,v])=>{ if(!p.scripts[k]) p.scripts[k]=v; });
    writePkg(p);
    log(I.fix,"Scripts agregados");
  }
}

// ─────────────────────────────────────────
// 14. .gitignore
// ─────────────────────────────────────────
async function checkGitignore() {
  sec("📄 .gitignore");
  const gPath=path.join(ROOT,".gitignore");
  const required=["node_modules",".env",".env.local","dist","build",".next","out",
    "coverage","*.log",".DS_Store","*.tsbuildinfo"];

  if(!fs.existsSync(gPath)){
    log(I.err,".gitignore no encontrado");
    if(FIX){ fs.writeFileSync(gPath,required.join("\n")+"\n"); log(I.fix,"Creado"); }
    return;
  }
  const content=fs.readFileSync(gPath,"utf8");
  const miss=required.filter(e=>!content.includes(e));
  if(miss.length===0) log(I.ok,"Todas las entradas críticas presentes");
  else {
    log(I.warn,`Faltantes: ${miss.join(", ")}`);
    if(FIX){ fs.appendFileSync(gPath,"\n"+miss.join("\n")+"\n"); log(I.fix,"Añadidas"); }
  }
}

// ─────────────────────────────────────────
// 15. HUSKY / LINT-STAGED (bonus)
// ─────────────────────────────────────────
async function checkGitHooks(pkg) {
  sec("🪝 Git Hooks (Husky + lint-staged)");

  const hasHusky     = hasPkg("husky")||!!pkg.devDependencies?.husky;
  const hasLintStaged= hasPkg("lint-staged")||!!pkg.devDependencies?.["lint-staged"];
  const hasHuskyDir  = fs.existsSync(path.join(ROOT,".husky"));

  log(hasHusky      ? I.ok : I.info, "husky",       hasHusky ? "" : "npm install --save-dev husky");
  log(hasLintStaged ? I.ok : I.info, "lint-staged",  hasLintStaged ? "" : "npm install --save-dev lint-staged");
  log(hasHuskyDir   ? I.ok : I.warn, ".husky/",      hasHuskyDir ? "" : "npx husky init");

  if(!hasHusky&&!hasLintStaged)
    log(I.info,"Tip: husky + lint-staged evitan commits con errores de lint/tipos");
}

// ─────────────────────────────────────────
// RESUMEN
// ─────────────────────────────────────────
function summary() {
  console.log(`\n${C.bold}${C.bgBlue}  📊 RESUMEN FINAL  ${C.reset}\n`);

  const errs=R.errors.length, warns=R.warnings.length;

  if(errs===0&&warns===0){
    console.log(`  ${C.bold}${C.green}✅ ¡Proyecto TypeScript en excelente estado!${C.reset}\n`);
  } else {
    if(errs>0){
      console.log(`  ${I.err} ${C.bold}${C.red}${errs} problema(s) crítico(s):${C.reset}`);
      R.errors.forEach(e=>console.log(`    ${C.red}• ${e}${C.reset}`));
    }
    if(warns>0){
      console.log(`  ${I.warn} ${C.bold}${C.yellow}${warns} advertencia(s):${C.reset}`);
      R.warnings.forEach(w=>console.log(`    ${C.yellow}• ${w}${C.reset}`));
    }
  }

  const stats=[
    R.typeErrors>0        && `${R.typeErrors} errores TS`,
    R.unusedDeps.length>0 && `${R.unusedDeps.length} deps sin uso`,
    R.anyUsage>0          && `${R.anyUsage}× 'any'`,
    R.testsPassed!==null  && `Tests ${R.testsPassed}✔ ${R.testsFailed}✖`,
    R.coverage!==null     && `Cov ${R.coverage}%`,
    R.todoCount>0         && `${R.todoCount} TODOs`,
    R.lintErrors>0        && `${R.lintErrors} lint errors`,
  ].filter(Boolean);

  if(stats.length>0)
    console.log(`\n  ${C.dim}${stats.join("  │  ")}${C.reset}\n`);

  if(!FIX&&(errs>0||warns>0))
    console.log(`  ${C.dim}💡 Usa ${C.cyan}--fix${C.reset}${C.dim} para correcciones automáticas${C.reset}\n`);
  if(!DEEP)
    console.log(`  ${C.dim}💡 Usa ${C.cyan}--deep${C.reset}${C.dim} para análisis de deps circulares${C.reset}\n`);

  if(JSON_OUT){
    fs.writeFileSync(path.join(ROOT,"project-doctor-report.json"),JSON.stringify(R,null,2));
    log(I.info,"Reporte guardado en project-doctor-report.json");
  }

  if(CI&&errs>0){
    console.log(`\n  ${C.bgRed}${C.white} CI: Falló con ${errs} error(es) ${C.reset}\n`);
    process.exit(1);
  }
}

// ─────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────
async function main(){
  if(!fs.existsSync(PKG_PATH)){ console.error("No hay package.json"); process.exit(1); }
  const pkg=readPkg();
  banner(pkg);

  await checkTsConfig();
  await checkTypes();
  await checkTypeQuality();
  await checkUnusedDeps(pkg);
  await checkMissingTypes(pkg);
  await checkSecurity();
  await runLint(pkg);
  await checkFormat(pkg);
  await runTests(pkg);
  await checkOutdated();
  await checkCircular();
  await checkCodeQuality();
  await checkScripts(pkg);
  await checkGitignore();
  await checkGitHooks(pkg);
  summary();
}

main().catch(e=>{ console.error("Error:",e.message); process.exit(1); });
