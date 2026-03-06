#!/usr/bin/env node
/**
 * 🩺 project-doctor.mjs  ─  MERN / Node.js Edition (JavaScript)
 *
 * Cubre: MongoDB · Express · React · Node.js
 * Uso:   node project-doctor.mjs [--fix] [--deep] [--ci] [--json] [--skip-install]
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// ─────────────────────────────────────────
// FLAGS
// ─────────────────────────────────────────
const ARGS        = process.argv.slice(2);
const FIX         = ARGS.includes("--fix");
const DEEP        = ARGS.includes("--deep");
const CI          = ARGS.includes("--ci");
const JSON_OUT    = ARGS.includes("--json");
const SKIP_INST   = ARGS.includes("--skip-install");
const ROOT        = process.cwd();
const PKG_PATH    = path.join(ROOT, "package.json");

// ─────────────────────────────────────────
// UI
// ─────────────────────────────────────────
const C = {
  reset:"\x1b[0m", bold:"\x1b[1m", dim:"\x1b[2m",
  red:"\x1b[31m", green:"\x1b[32m", yellow:"\x1b[33m",
  blue:"\x1b[34m", magenta:"\x1b[35m", cyan:"\x1b[36m",
  bgRed:"\x1b[41m", bgGreen:"\x1b[42m", bgBlue:"\x1b[44m", white:"\x1b[37m",
};
const I = {
  ok:`${C.green}✔${C.reset}`, warn:`${C.yellow}⚠${C.reset}`,
  err:`${C.red}✖${C.reset}`, info:`${C.cyan}ℹ${C.reset}`,
  fix:`${C.magenta}⚡${C.reset}`, run:`${C.blue}▶${C.reset}`,
};

const sec = (t) => console.log(`\n${C.bold}${C.bgBlue}  ${t}  ${C.reset}\n`);
const log = (ic, msg, d="") => console.log(`  ${ic} ${msg}${d ? `  ${C.dim}→ ${d}${C.reset}` : ""}`);

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
const run   = (cmd, o={}) => { try { return execSync(cmd,{cwd:ROOT,encoding:"utf8",stdio:"pipe",...o}); } catch(e){ return e.stdout||e.stderr||""; }};
const hasPkg= (n) => fs.existsSync(path.join(ROOT,"node_modules",n));
const hasCmd= (c) => { try{ execSync(`which ${c}`,{stdio:"pipe"}); return true; }catch{ return false; }};
const readPkg = () => JSON.parse(fs.readFileSync(PKG_PATH,"utf8"));
const writePkg= (p) => fs.writeFileSync(PKG_PATH, JSON.stringify(p,null,2)+"\n","utf8");

function getAllFiles(dir, exts, ignore=["node_modules","dist","build",".git","coverage"]) {
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
  lintErrors:0, lintWarnings:0, testsPassed:null, testsFailed:null,
  circularDeps:[], duplicateDeps:[], largeFiles:[], todoCount:0,
  envMissing:[], mongooseIssues:[], apiIssues:[],
  errors:[], warnings:[],
};

// ─────────────────────────────────────────
// BANNER
// ─────────────────────────────────────────
function banner(pkg){
  const isMono = fs.existsSync(path.join(ROOT,"client")) && fs.existsSync(path.join(ROOT,"server"));
  console.log(`
${C.bold}${C.cyan}╔══════════════════════════════════════════════════════╗
║       🩺  PROJECT DOCTOR  ─  MERN Edition            ║
║          MongoDB · Express · React · Node             ║
╚══════════════════════════════════════════════════════╝${C.reset}

  ${I.info} Proyecto : ${C.bold}${pkg.name||"?"}${C.reset}  v${pkg.version||"?"}
  ${I.info} Modo     : ${FIX ? `${C.green}--fix (correcciones ON)` : `${C.yellow}solo lectura`}${C.reset}
  ${I.info} Estructura: ${isMono ? `${C.cyan}monorepo (client/ + server/)` : `${C.cyan}proyecto único`}${C.reset}
`);
}

// ─────────────────────────────────────────
// 1. DETECCIÓN DE ESTRUCTURA MERN
// ─────────────────────────────────────────
async function detectStructure(pkg) {
  sec("🗂  Estructura del proyecto MERN");

  const checks = {
    "client/ (React)":       fs.existsSync(path.join(ROOT,"client")),
    "server/ (Express)":     fs.existsSync(path.join(ROOT,"server")),
    "src/ (unified)":        fs.existsSync(path.join(ROOT,"src")),
    "models/ (Mongoose)":    fs.existsSync(path.join(ROOT,"models")) || fs.existsSync(path.join(ROOT,"server","models")),
    "routes/ (Express)":     fs.existsSync(path.join(ROOT,"routes")) || fs.existsSync(path.join(ROOT,"server","routes")),
    "controllers/":          fs.existsSync(path.join(ROOT,"controllers")) || fs.existsSync(path.join(ROOT,"server","controllers")),
    "middleware/":           fs.existsSync(path.join(ROOT,"middleware")) || fs.existsSync(path.join(ROOT,"server","middleware")),
    ".env":                  fs.existsSync(path.join(ROOT,".env")),
    ".env.example":          fs.existsSync(path.join(ROOT,".env.example")),
    "nodemon.json / .nodemonrc": fs.existsSync(path.join(ROOT,"nodemon.json")),
  };

  for(const [k,v] of Object.entries(checks)){
    log(v ? I.ok : I.warn, k, v ? "" : "no encontrado");
  }

  if(!checks[".env.example"] && FIX){
    log(I.fix, "Creando .env.example básico...");
    fs.writeFileSync(path.join(ROOT,".env.example"),
`# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017/myapp

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRE=30d

# Client (si usas CRA/Vite)
# VITE_API_URL=http://localhost:5000/api
`);
    log(I.ok, ".env.example creado");
  }
}

// ─────────────────────────────────────────
// 2. VARIABLES DE ENTORNO
// ─────────────────────────────────────────
async function checkEnv() {
  sec("🔐 Variables de entorno");

  const envPath    = path.join(ROOT,".env");
  const exPath     = path.join(ROOT,".env.example");
  const criticalVars = ["MONGO_URI","PORT","JWT_SECRET","NODE_ENV"];

  if(!fs.existsSync(envPath)){
    log(I.err, ".env no encontrado");
    R.errors.push(".env faltante");
    return;
  }

  const envContent = fs.readFileSync(envPath,"utf8");
  const defined    = envContent.split("\n")
    .filter(l=>l.trim()&&!l.startsWith("#"))
    .map(l=>l.split("=")[0].trim());

  // Variables críticas
  for(const v of criticalVars){
    if(!defined.includes(v)){
      log(I.warn, `${v} no definida en .env`);
      R.envMissing.push(v);
      R.warnings.push(`Variable de entorno faltante: ${v}`);
    } else {
      log(I.ok, v+" definida");
    }
  }

  // Comparar con .env.example
  if(fs.existsSync(exPath)){
    const exContent  = fs.readFileSync(exPath,"utf8");
    const exVars     = exContent.split("\n")
      .filter(l=>l.trim()&&!l.startsWith("#"))
      .map(l=>l.split("=")[0].trim());
    const missingFromEnv = exVars.filter(v=>!defined.includes(v));
    if(missingFromEnv.length > 0){
      log(I.warn, `${missingFromEnv.length} vars en .env.example pero no en .env:`,
        missingFromEnv.join(", "));
    }
  }

  // Detectar valores hardcodeados sospechosos
  const suspicious = envContent.match(/SECRET\s*=\s*(secret|1234|password|changeme|test)/gi);
  if(suspicious){
    log(I.err, `Valores inseguros en .env: ${suspicious.length} encontrados`);
    R.errors.push("Secretos inseguros en .env");
  }
}

// ─────────────────────────────────────────
// 3. DEPENDENCIAS SIN USO
// ─────────────────────────────────────────
async function checkUnusedDeps(pkg) {
  sec("📦 Dependencias no utilizadas");

  if(!hasPkg("depcheck")&&!SKIP_INST){
    log(I.run,"Instalando depcheck...");
    run("npm install --save-dev depcheck --no-audit --no-fund");
  }

  // Ignorar paquetes típicos MERN que depcheck no detecta
  const ignore = [
    "dotenv","nodemon","concurrently","cross-env",
    "mongoose","express","cors","helmet","morgan","compression",
    "bcryptjs","jsonwebtoken","express-validator","express-async-handler",
    "multer","cloudinary","stripe","socket.io",
    "react-dom","react-scripts","vite","@vitejs/plugin-react",
    "eslint","prettier","jest","supertest","@types/*",
  ].join(",");

  const out = run(`npx depcheck --json --ignores="${ignore}" 2>/dev/null`);
  let parsed;
  try { parsed = JSON.parse(out); } catch { log(I.warn,"No se pudo parsear depcheck"); return; }

  const unused    = Object.keys(parsed.dependencies   || {});
  const unusedDev = Object.keys(parsed.devDependencies|| {});
  const missing   = Object.keys(parsed.missing        || {});

  if(unused.length===0&&unusedDev.length===0){
    log(I.ok,"Todas las dependencias están siendo usadas");
  } else {
    if(unused.length>0){
      log(I.warn,`${unused.length} deps de producción sin uso:`, unused.join(", "));
      R.unusedDeps.push(...unused.map(d=>({name:d,type:"dep"})));
      if(FIX){ run(`npm uninstall ${unused.join(" ")} --no-audit`); R.removedDeps.push(...unused); log(I.fix,"Eliminadas"); }
    }
    if(unusedDev.length>0){
      log(I.warn,`${unusedDev.length} devDeps sin uso:`, unusedDev.join(", "));
      R.unusedDeps.push(...unusedDev.map(d=>({name:d,type:"devDep"})));
      if(FIX){ run(`npm uninstall --save-dev ${unusedDev.join(" ")} --no-audit`); R.removedDeps.push(...unusedDev); log(I.fix,"Eliminadas"); }
    }
  }

  if(missing.length>0){
    log(I.err,`${missing.length} deps usadas pero NO instaladas:`, missing.join(", "));
    R.errors.push(`Deps faltantes: ${missing.join(", ")}`);
    if(FIX){ run(`npm install ${missing.join(" ")} --no-audit`); log(I.fix,"Instaladas"); }
  }
}

// ─────────────────────────────────────────
// 4. SEGURIDAD
// ─────────────────────────────────────────
async function checkSecurity() {
  sec("🔒 Seguridad");

  // npm audit
  const out = run("npm audit --json 2>/dev/null");
  let audit={};
  try{ audit=JSON.parse(out||"{}"); }catch{}

  const v = audit.metadata?.vulnerabilities||{};
  const sum = (v.critical||0)+(v.high||0)+(v.moderate||0)+(v.low||0);

  if(sum===0){ log(I.ok,"Sin vulnerabilidades npm"); }
  else {
    if(v.critical) log(I.err,`${v.critical} vulnerabilidades CRÍTICAS`);
    if(v.high)     log(I.err,`${v.high} vulnerabilidades ALTAS`);
    if(v.moderate) log(I.warn,`${v.moderate} vulnerabilidades moderadas`);
    if(v.low)      log(I.info,`${v.low} vulnerabilidades bajas`);
    if(FIX&&(v.critical||v.high)){ run("npm audit fix --no-audit"); log(I.fix,"Parches aplicados"); }
  }

  // MERN-specific: chequeos de seguridad en código
  sec("🛡  Patrones de seguridad MERN");

  const serverFiles = getAllFiles(
    path.join(ROOT, fs.existsSync(path.join(ROOT,"server")) ? "server" : "."),
    [".js",".mjs"],
    ["node_modules","dist","client","coverage"]
  );

  let helmetFound=false, corsFound=false, ratelimitFound=false, xssFound=false;
  for(const f of serverFiles){
    const c = fs.readFileSync(f,"utf8");
    if(c.includes("helmet"))        helmetFound    = true;
    if(c.includes("cors("))         corsFound      = true;
    if(c.includes("rate-limit")||c.includes("rateLimit")) ratelimitFound=true;
    if(c.includes("xss")||c.includes("sanitize"))         xssFound      =true;
  }

  log(helmetFound    ? I.ok : I.warn, "helmet (headers HTTP seguros)",    helmetFound    ? "" : "npm install helmet");
  log(corsFound      ? I.ok : I.warn, "cors configurado",                 corsFound      ? "" : "npm install cors");
  log(ratelimitFound ? I.ok : I.warn, "rate limiting",                    ratelimitFound ? "" : "npm install express-rate-limit");
  log(xssFound       ? I.ok : I.warn, "sanitización XSS",                 xssFound       ? "" : "npm install express-validator / xss-clean");

  if(!helmetFound)    R.warnings.push("helmet no encontrado en el servidor");
  if(!corsFound)      R.warnings.push("CORS no configurado explícitamente");
  if(!ratelimitFound) R.warnings.push("Sin rate limiting — vulnerable a DDoS/brute force");
}

// ─────────────────────────────────────────
// 5. MONGOOSE / MODELOS
// ─────────────────────────────────────────
async function checkMongoose() {
  sec("🍃 Mongoose / Modelos");

  const modelDirs = [
    path.join(ROOT,"models"),
    path.join(ROOT,"server","models"),
    path.join(ROOT,"src","models"),
  ].filter(d=>fs.existsSync(d));

  if(modelDirs.length===0){
    log(I.warn,"No se encontró carpeta models/");
    return;
  }

  const modelFiles = modelDirs.flatMap(d=>getAllFiles(d,[".js",".mjs"]));
  log(I.info,`${modelFiles.length} modelos encontrados`);

  let noTimestamps=0, noIndex=0, noValidation=0;
  for(const f of modelFiles){
    const c   = fs.readFileSync(f,"utf8");
    const rel = path.relative(ROOT,f);
    if(!c.includes("timestamps")) { noTimestamps++; log(I.warn,`Sin timestamps:`, rel); }
    if(!c.includes("index:")&&!c.includes(".index(")) { noIndex++; }
    if(!c.includes("required")&&!c.includes("validate")) { noValidation++; log(I.warn,`Sin validaciones:`, rel); }
  }

  if(noTimestamps===0) log(I.ok,"Todos los modelos tienen timestamps");
  if(noIndex>0)  log(I.info,`${noIndex} modelos sin índices definidos (considera añadirlos)`);
  if(noValidation===0) log(I.ok,"Todos los modelos tienen validaciones");
}

// ─────────────────────────────────────────
// 6. RUTAS / CONTROLLERS (Express)
// ─────────────────────────────────────────
async function checkExpressRoutes() {
  sec("🛣  Rutas Express");

  const routeDirs = [
    path.join(ROOT,"routes"),
    path.join(ROOT,"server","routes"),
    path.join(ROOT,"src","routes"),
  ].filter(d=>fs.existsSync(d));

  if(routeDirs.length===0){ log(I.warn,"No se encontró carpeta routes/"); return; }

  const routeFiles = routeDirs.flatMap(d=>getAllFiles(d,[".js",".mjs"]));
  log(I.info,`${routeFiles.length} archivos de rutas`);

  let noAuth=0, noValidation=0, noErrorHandling=0;
  for(const f of routeFiles){
    const c   = fs.readFileSync(f,"utf8");
    const rel = path.relative(ROOT,f);
    if(!c.includes("auth")&&!c.includes("protect")&&!c.includes("middleware")) noAuth++;
    if(!c.includes("validate")&&!c.includes("check(")&&!c.includes("body("))   noValidation++;
    if(!c.includes("try")&&!c.includes("asyncHandler")&&!c.includes("catch"))  {
      noErrorHandling++;
      log(I.warn,`Sin manejo de errores async:`, rel);
    }
  }

  log(noAuth===0 ? I.ok : I.warn,
    noAuth===0 ? "Todas las rutas tienen middleware de auth" : `${noAuth} rutas sin middleware de auth`);
  log(noValidation===0 ? I.ok : I.info,
    noValidation===0 ? "Rutas con validación de entrada" : `${noValidation} rutas sin validación de inputs`);
}

// ─────────────────────────────────────────
// 7. MANEJO DE ERRORES GLOBAL
// ─────────────────────────────────────────
async function checkErrorHandling() {
  sec("⚠  Manejo de errores global");

  const serverFiles = getAllFiles(
    path.join(ROOT, fs.existsSync(path.join(ROOT,"server")) ? "server" : "."),
    [".js",".mjs"],
    ["node_modules","client","dist","coverage"]
  );

  let hasGlobalHandler=false, hasNotFound=false, hasUncaughtException=false;
  for(const f of serverFiles){
    const c=fs.readFileSync(f,"utf8");
    if(c.includes("err, req, res, next")) hasGlobalHandler=true;
    if(c.includes("404")||c.includes("notFound")) hasNotFound=true;
    if(c.includes("uncaughtException")||c.includes("unhandledRejection")) hasUncaughtException=true;
  }

  log(hasGlobalHandler      ? I.ok : I.err,  "Middleware de error global (err, req, res, next)");
  log(hasNotFound           ? I.ok : I.warn, "Ruta 404 catch-all");
  log(hasUncaughtException  ? I.ok : I.warn, "process.on('uncaughtException') / 'unhandledRejection'");

  if(!hasGlobalHandler) R.errors.push("Sin middleware de error global en Express");
  if(!hasUncaughtException) R.warnings.push("Sin manejo de uncaughtException/unhandledRejection");
}

// ─────────────────────────────────────────
// 8. CONEXIÓN A MONGODB
// ─────────────────────────────────────────
async function checkMongoConnection() {
  sec("🍃 Conexión MongoDB");

  const allFiles = getAllFiles(ROOT, [".js",".mjs"],
    ["node_modules","dist","client","coverage"]);

  let hasConnect=false, hasErrorHandler=false, hasRetry=false;
  for(const f of allFiles){
    const c=fs.readFileSync(f,"utf8");
    if(c.includes("mongoose.connect")||c.includes("MongoClient.connect")) hasConnect=true;
    if((c.includes("mongoose.connect")||c.includes("MongoClient"))&&c.includes(".catch")) hasErrorHandler=true;
    if(c.includes("retry")||c.includes("reconnect")||c.includes("serverSelectionTimeoutMS")) hasRetry=true;
  }

  log(hasConnect      ? I.ok : I.err, "Conexión a MongoDB encontrada");
  log(hasErrorHandler ? I.ok : I.warn,"Manejo de errores en conexión DB");
  log(hasRetry        ? I.ok : I.info,"Configuración de retry/timeout");

  if(!hasConnect)      R.errors.push("No se encontró conexión a MongoDB");
  if(!hasErrorHandler) R.warnings.push("Conexión a MongoDB sin .catch()");
}

// ─────────────────────────────────────────
// 9. SCRIPTS RECOMENDADOS MERN
// ─────────────────────────────────────────
async function checkScripts(pkg) {
  sec("📋 Scripts recomendados MERN");

  const isMono = fs.existsSync(path.join(ROOT,"client"))&&fs.existsSync(path.join(ROOT,"server"));

  const recommended = isMono ? {
    "dev":          "concurrently \"npm run server\" \"npm run client\"",
    "server":       "nodemon server/index.js",
    "client":       "npm start --prefix client",
    "build":        "npm run build --prefix client",
    "lint":         "eslint . --ext .js",
    "lint:fix":     "eslint . --ext .js --fix",
    "test":         "jest --forceExit --detectOpenHandles",
    "test:watch":   "jest --watch",
    "test:coverage":"jest --coverage",
    "seed":         "node server/seed.js",
    "heroku-postbuild": "npm run build",
  } : {
    "dev":          "nodemon index.js",
    "start":        "node index.js",
    "lint":         "eslint . --ext .js",
    "lint:fix":     "eslint . --ext .js --fix",
    "test":         "jest --forceExit --detectOpenHandles",
    "test:watch":   "jest --watch",
    "test:coverage":"jest --coverage",
  };

  const missing = Object.entries(recommended).filter(([k])=>!pkg.scripts?.[k]);
  if(missing.length===0){ log(I.ok,"Todos los scripts recomendados presentes"); return; }

  log(I.info,`${missing.length} scripts recomendados faltantes:`);
  missing.forEach(([k,v])=>log(I.warn,`  "${k}"`,v));

  if(FIX){
    const p=readPkg();
    if(!p.scripts) p.scripts={};
    missing.forEach(([k,v])=>{ if(!p.scripts[k]) p.scripts[k]=v; });
    writePkg(p);
    log(I.fix,"Scripts agregados a package.json");
  }
}

// ─────────────────────────────────────────
// 10. LINT
// ─────────────────────────────────────────
async function runLint(pkg) {
  sec("🔍 ESLint");
  if(!pkg.scripts?.lint){ log(I.warn,"Sin script de lint"); return; }

  const out = run("npm run lint -- --format compact 2>&1");
  const errors   = (out.match(/: error /g)   || []).length;
  const warnings = (out.match(/: warning /g) || []).length;

  R.lintErrors=errors; R.lintWarnings=warnings;

  if(errors===0&&warnings===0) log(I.ok,"Sin errores de lint");
  else {
    if(errors>0)   { log(I.err, `${errors} errores de lint`);   R.errors.push(`${errors} errores ESLint`); }
    if(warnings>0)   log(I.warn,`${warnings} warnings de lint`);
    if(FIX){ run("npm run lint -- --fix 2>&1"); log(I.fix,"Auto-fix aplicado"); }
  }
}

// ─────────────────────────────────────────
// 11. TESTS (Jest / Supertest)
// ─────────────────────────────────────────
async function runTests(pkg) {
  sec("🧪 Tests (Jest + Supertest)");
  if(!pkg.scripts?.test){ log(I.warn,"Sin script de test"); return; }

  const out   = run("npm test -- --passWithNoTests 2>&1");
  const passed = +(out.match(/(\d+) passed/)?.[1]||0);
  const failed = +(out.match(/(\d+) failed/)?.[1]||0);

  R.testsPassed=passed; R.testsFailed=failed;

  if(failed===0&&passed>0) log(I.ok,`${passed} tests pasaron`);
  else if(failed>0){
    log(I.err,`${failed} tests fallaron, ${passed} pasaron`);
    R.errors.push(`${failed} tests fallando`);
  } else log(I.warn,"No se encontraron tests");

  // Verificar si hay archivos de test
  const testFiles = getAllFiles(ROOT,
    [".test.js",".spec.js",".test.mjs"],
    ["node_modules","dist","client","coverage"]);
  if(testFiles.length===0) log(I.warn,"No se encontraron archivos de test (.test.js / .spec.js)");
  else log(I.info,`${testFiles.length} archivos de test encontrados`);
}

// ─────────────────────────────────────────
// 12. ARCHIVO .GITIGNORE
// ─────────────────────────────────────────
async function checkGitignore() {
  sec("📄 .gitignore");
  const gPath = path.join(ROOT,".gitignore");
  const required = ["node_modules",".env",".env.local","dist","build","coverage","*.log",".DS_Store","uploads/"];

  if(!fs.existsSync(gPath)){
    log(I.err,".gitignore no encontrado");
    if(FIX){ fs.writeFileSync(gPath,required.join("\n")+"\n"); log(I.fix,".gitignore creado"); }
    return;
  }

  const content = fs.readFileSync(gPath,"utf8");
  const miss    = required.filter(e=>!content.includes(e));
  if(miss.length===0) log(I.ok,"Todas las entradas críticas presentes");
  else {
    log(I.warn,`Entradas faltantes: ${miss.join(", ")}`);
    if(FIX){ fs.appendFileSync(gPath,"\n"+miss.join("\n")+"\n"); log(I.fix,"Entradas añadidas"); }
  }
}

// ─────────────────────────────────────────
// 13. TODOS / ARCHIVOS GRANDES
// ─────────────────────────────────────────
async function checkCodeQuality() {
  sec("📊 Calidad de código");

  const files = getAllFiles(ROOT,[".js",".mjs"],
    ["node_modules","dist","client","coverage"]);

  let todos=0; const large=[];
  for(const f of files){
    const content = fs.readFileSync(f,"utf8");
    const lines   = content.split("\n");
    todos += (content.match(/\/\/\s*(TODO|FIXME|HACK|BUG)/gi)||[]).length;
    if(lines.length>300||content.length>60*1024){
      large.push({file:path.relative(ROOT,f), lines:lines.length});
    }
  }

  R.todoCount=todos; R.largeFiles=large;
  log(todos===0 ? I.ok : I.warn,
    todos===0 ? "Sin TODOs pendientes" : `${todos} TODOs/FIXMEs pendientes`);
  if(large.length>0){
    log(I.warn,`${large.length} archivos grandes:`);
    large.slice(0,5).forEach(f=>log(I.info,`  ${f.file}`,`${f.lines} líneas`));
  } else log(I.ok,"Sin archivos excesivamente grandes");
}

// ─────────────────────────────────────────
// 14. DEPS DESACTUALIZADAS
// ─────────────────────────────────────────
async function checkOutdated() {
  sec("🔄 Dependencias desactualizadas");
  const out = run("npm outdated --json 2>/dev/null");
  let od={};
  try{ od=JSON.parse(out||"{}"); }catch{}
  const keys=Object.keys(od);
  if(keys.length===0){ log(I.ok,"Todo actualizado"); return; }
  const critical = keys.filter(k=>parseInt(od[k].latest)>parseInt(od[k].current));
  const minor    = keys.filter(k=>!critical.includes(k));
  if(critical.length) log(I.err, `${critical.length} paquetes con major version desactualizada:`, critical.join(", "));
  if(minor.length)    log(I.warn,`${minor.length} paquetes con updates menores disponibles`);
  if(FIX&&minor.length){ run("npm update --no-audit"); log(I.fix,"Updates menores aplicados"); }
}

// ─────────────────────────────────────────
// RESUMEN
// ─────────────────────────────────────────
function summary() {
  console.log(`\n${C.bold}${C.bgBlue}  📊 RESUMEN FINAL  ${C.reset}\n`);

  const errs  = R.errors.length;
  const warns = R.warnings.length;

  if(errs===0&&warns===0){
    console.log(`  ${C.bold}${C.green}✅ ¡Proyecto MERN en excelente estado!${C.reset}\n`);
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
    R.unusedDeps.length>0  && `${R.unusedDeps.length} deps sin uso`,
    R.removedDeps.length>0 && `${R.removedDeps.length} eliminadas`,
    R.testsPassed!==null   && `Tests ${R.testsPassed}✔ ${R.testsFailed}✖`,
    R.todoCount>0          && `${R.todoCount} TODOs`,
    R.envMissing.length>0  && `${R.envMissing.length} vars .env faltantes`,
  ].filter(Boolean);

  if(stats.length>0)
    console.log(`\n  ${C.dim}${stats.join("  │  ")}${C.reset}\n`);

  if(!FIX&&(errs>0||warns>0))
    console.log(`  ${C.dim}💡 Usa ${C.cyan}--fix${C.reset}${C.dim} para correcciones automáticas${C.reset}\n`);

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

  await detectStructure(pkg);
  await checkEnv();
  await checkUnusedDeps(pkg);
  await checkOutdated();
  await checkSecurity();
  await checkMongoose();
  await checkExpressRoutes();
  await checkErrorHandling();
  await checkMongoConnection();
  await runLint(pkg);
  await runTests(pkg);
  await checkCodeQuality();
  await checkScripts(pkg);
  await checkGitignore();
  summary();
}

main().catch(e=>{ console.error("Error:",e.message); process.exit(1); });
