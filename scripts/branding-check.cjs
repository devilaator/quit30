const fs=require('node:fs');
const ts=require('typescript');
const Module=require('node:module');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const compile=(source,file)=>ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,file)=>m._compile(compile(fs.readFileSync(file,'utf8'),file),file);
let hooks=[],cursor=0,effects=[],animations=[],opened=[],reduced=false;
const react={useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return [hooks[i],v=>{hooks[i]=typeof v==='function'?v(hooks[i]):v;}];},useRef(value){const i=cursor++;if(!(i in hooks))hooks[i]={current:value};return hooks[i];},useEffect(fn){effects.push(fn);}};
const jsx=(type,props)=>({type,props:props||{}});
const rn={Platform:{OS:'android'},StyleSheet:{create:s=>s,absoluteFill:{}},AccessibilityInfo:{isReduceMotionEnabled:async()=>reduced},Easing:{linear:x=>x},Linking:{openURL:async url=>{opened.push(url);}},Animated:{View:'Animated.View',Value:class {interpolate(config){return config;}},timing(value,config){const animation={config,start(callback){this.callback=callback;},stop(){}};animations.push(animation);return animation;}}};
for(const name of ['View','Text','Pressable','TextInput','Modal','ScrollView','KeyboardAvoidingView'])rn[name]=name;
const originalLoad=Module._load;
Module._load=function(id,parent,isMain){if(id==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({top:24,bottom:24,left:0,right:0})};if(id==='react')return react;if(id==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'Fragment'};if(id==='react-native')return rn;if(id==='react-native-svg')return {__esModule:true,default:'Svg',Defs:'Defs',LinearGradient:'LinearGradient',Stop:'Stop',Text:'SvgText'};if(id==='./components'&&parent?.filename.includes('src'))return {palette:{muted:'#aaa',sand:'#ccc',danger:'#f88'},ui:{}};return originalLoad.call(this,id,parent,isMain);};
const {DevReset}=require('../src/DevReset.tsx');
const {StartupIntro,INTRO_TIMING}=require('../src/StartupIntro.tsx');
const {BrandInfo}=require('../src/BrandInfo.tsx');
function fresh(){hooks=[];cursor=0;effects=[];animations=[];opened=[];global.__DEV__=true;}
function render(component,props){cursor=0;return component(props);}
function nodes(tree,type){if(!tree || typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(x=>nodes(x,type));return [...(tree.type===type?[tree]:[]),...nodes(tree.props?.children,type)];}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('debug reset: short tap cannot activate or delete; long press, exact RESET, final action required',async()=>{
 fresh();let deletes=0;const props={language:'et',onReset:async token=>{assert.equal(token,'RESET');deletes++;}};
 let tree=render(DevReset,props);const trigger=nodes(tree,'Pressable')[0];assert.equal(trigger.props.onPress,undefined);assert.equal(trigger.props.delayLongPress,1000);assert.equal(nodes(tree,'Modal')[0].props.visible,false);assert.equal(deletes,0);
 trigger.props.onLongPress();tree=render(DevReset,props);assert.equal(nodes(tree,'Modal')[0].props.visible,true);
 let final=nodes(tree,'Pressable')[1];assert.equal(final.props.disabled,true);final.props.onPress();await flush();assert.equal(deletes,0);
 for(const wrong of ['reset',' RESET','RESET ','RESE']){nodes(tree,'TextInput')[0].props.onChangeText(wrong);tree=render(DevReset,props);assert.equal(nodes(tree,'Pressable')[1].props.disabled,true);}
 nodes(tree,'TextInput')[0].props.onChangeText('RESET');tree=render(DevReset,props);final=nodes(tree,'Pressable')[1];assert.equal(final.props.disabled,false);assert.equal(deletes,0);final.props.onPress();final.props.onPress();await flush();assert.equal(deletes,1);
});
test('cancel clears typed confirmation and requires a new deliberate activation',()=>{fresh();const props={language:'en',onReset:async()=>{throw Error('must not run');}};let tree=render(DevReset,props);nodes(tree,'Pressable')[0].props.onLongPress();tree=render(DevReset,props);nodes(tree,'TextInput')[0].props.onChangeText('RESET');tree=render(DevReset,props);nodes(tree,'Pressable')[2].props.onPress();tree=render(DevReset,props);assert.equal(nodes(tree,'Modal')[0].props.visible,false);nodes(tree,'Pressable')[0].props.onLongPress();tree=render(DevReset,props);assert.equal(nodes(tree,'TextInput')[0].props.value,'');});
test('production reset component renders nothing',()=>{fresh();global.__DEV__=false;assert.equal(render(DevReset,{language:'ru',onReset:async()=>{throw Error('forbidden');}}),null);});
test('intro mounts app immediately in debug and release, uses horizontal ordered gradient, lasts 900 ms',async()=>{
 for(const dev of [true,false]){fresh();global.__DEV__=dev;reduced=false;const child=jsx('App',{});const tree=render(StartupIntro,{children:child});assert.equal(nodes(tree,'App').length,1);const gradient=nodes(tree,'LinearGradient')[0];assert.equal(gradient.props.x1,'0%');assert.equal(gradient.props.x2,'100%');assert.deepEqual(nodes(tree,'Stop').map(x=>x.props.stopColor),['#DB5551','#EC9251','#E7C66A','#70AD83']);effects[0]();await flush();assert.deepEqual(INTRO_TIMING,{fadeIn:200,hold:400,fadeOut:300});assert.equal(animations[0].config.duration,900);assert.equal(animations[0].config.useNativeDriver,true);animations[0].callback({finished:true});assert.equal(nodes(render(StartupIntro,{children:child}),'Svg').length,0);assert.equal(nodes(render(StartupIntro,{children:child}),'App').length,1);}
});
test('reduced motion uses a short 400 ms fade-only intro',async()=>{fresh();reduced=true;render(StartupIntro,{children:jsx('App',{})});effects[0]();await flush();assert.equal(animations[0].config.duration,400);});
test('settings brand link opens the fixed HTTPS address',async()=>{fresh();const tree=render(BrandInfo,{language:'et'});nodes(tree,'Pressable')[0].props.onPress();await flush();assert.deepEqual(opened,['https://devilaator.ee']);});
test('actual reset handler independently blocks production and incorrect confirmation; only removes QUIT30 keys',async()=>{
 const source=fs.readFileSync('App.tsx','utf8');const ast=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let arrow;
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='resetToOnboarding')arrow=n.initializer.arguments[0];ts.forEachChild(n,visit);}visit(ast);assert.ok(arrow);
 const code=compile('module.exports = '+arrow.getText(ast),'reset.ts');
 for(const [dev,token,allowed] of [[false,'RESET',false],[true,'reset',false],[true,'RESET ',false],[true,'RESET',true]]){
  let deletes=[];let cancellations=0;const context={module:{exports:null},__DEV__:dev,saving:{current:false},STORAGE_KEY:'quit30.userSettings.v1',CRAVING_END_KEY:'quit30.cravingEndsAt.v1',CRAVING_SECONDS:300,SUPPORT_HISTORY_KEY:'quit30.supportHistory.v1',AsyncStorage:{multiRemove:async keys=>{deletes.push(...keys);}},cancelDailyReminder:async()=>{cancellations++;}};
  for(const name of new Set(arrow.getText(ast).match(/\bset[A-Z]\w+/g)))context[name]=()=>{};
  vm.runInNewContext(code,context);await context.module.exports(token);assert.equal(cancellations,allowed?1:0);assert.deepEqual(deletes,allowed?['quit30.userSettings.v1','quit30.cravingEndsAt.v1','quit30.supportHistory.v1']:[]);
 }
 assert.ok(source.includes('{__DEV__ && <DevReset'));
});

