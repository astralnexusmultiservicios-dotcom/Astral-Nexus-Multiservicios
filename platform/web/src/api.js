import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,createUserWithEmailAndPassword,signInWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,onAuthStateChanged} from 'firebase/auth';
import {getFirestore,collection,doc,getDoc,getDocs,query,where,limit,orderBy} from 'firebase/firestore';
import {initializeAppCheck,ReCaptchaEnterpriseProvider} from 'firebase/app-check';
import {getFunctions,httpsCallable} from 'firebase/functions';
const e=import.meta.env;
export const configured=!!(e.VITE_FIREBASE_PROJECT_ID&&e.VITE_FIREBASE_API_KEY&&e.VITE_FIREBASE_APP_ID&&e.VITE_FIREBASE_AUTH_DOMAIN&&e.VITE_APPCHECK_SITE_KEY);
let auth,db,call;
if(configured){const app=initializeApp({apiKey:e.VITE_FIREBASE_API_KEY,authDomain:e.VITE_FIREBASE_AUTH_DOMAIN,projectId:e.VITE_FIREBASE_PROJECT_ID,appId:e.VITE_FIREBASE_APP_ID});initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(e.VITE_APPCHECK_SITE_KEY),isTokenAutoRefreshEnabled:true});auth=getAuth(app);db=getFirestore(app);call=httpsCallable(getFunctions(app,e.VITE_FUNCTIONS_REGION||'us-central1'),'nexusApi');}
export const watchAuth=fn=>configured?onAuthStateChanged(auth,fn):fn(null);
export const loginGoogle=()=>signInWithPopup(auth,new GoogleAuthProvider());
export const logout=()=>signOut(auth);
export async function login(email,password,register){if(register){const r=await createUserWithEmailAndPassword(auth,email,password);await sendEmailVerification(r.user);return {verify:true};}await signInWithEmailAndPassword(auth,email,password);return {};}
export const resetPassword=email=>sendPasswordResetEmail(auth,email);
export async function mutate(action,payload){
 if(!configured)throw new Error('Conecta Firebase para activar las operaciones.');
 // Retain the same key on network retries; clear only after a definitive response.
 const serialized=JSON.stringify({action,payload});let saved;try{saved=JSON.parse(sessionStorage.getItem('nx-request')||'null');}catch{}
 const requestId=saved?.serialized===serialized?saved.requestId:crypto.randomUUID();
 sessionStorage.setItem('nx-request',JSON.stringify({serialized,requestId}));
 try{const r=await call({action,payload,requestId});sessionStorage.removeItem('nx-request');return r.data;}catch(error){if(!['functions/internal','functions/unavailable','functions/deadline-exceeded'].includes(error.code))sessionStorage.removeItem('nx-request');throw error;}
}
export async function loadData(user){
 if(!configured)return {products:[],settings:{},banks:[],orders:[],ledger:[],deposits:[],raffles:[],users:[],audit:[],coupons:[]};
 const list=async(name,filters=[])=>{const ordering=['orders','ledger','deposits','audit','users'].includes(name)?[orderBy('createdAtMs','desc')]:[];const q=query(collection(db,'nx_'+name),...filters,...ordering,limit(200));const r=await getDocs(q);return r.docs.map(d=>({...d.data(),id:d.id}));};
 const settings=(await getDoc(doc(db,'nx_settings','store'))).data()||{};
 const result={products:await list('products',[where('active','==',true)]),settings,banks:[],orders:[],ledger:[],deposits:[],raffles:[],users:[],audit:[],coupons:[]};
 if(!user?.emailVerified)return result;
 let profile=(await getDoc(doc(db,'nx_users',user.uid))).data();
 if(!profile){await mutate('bootstrap',{name:user.displayName||user.email.split('@')[0]});profile=(await getDoc(doc(db,'nx_users',user.uid))).data();}
 const token=await user.getIdTokenResult();const staff=(await getDoc(doc(db,'nx_staff',user.uid))).data();
 const isAdmin=token.claims.nxAdmin===true&&staff?.active===true&&staff?.role==='admin';
 const own=isAdmin?[]:[where('uid','==',user.uid)];
 const [orders,ledger,deposits,banks,raffles]=await Promise.all([list('orders',own),list('ledger',own),list('deposits',own),list('banks',isAdmin?[]:[where('active','==',true)]),list('raffles')]);
 Object.assign(result,{profile,isAdmin,orders,ledger,deposits,banks,raffles});
 if(isAdmin){const [users,audit,products,coupons]=await Promise.all([list('users'),list('audit'),list('products'),list('coupons')]);Object.assign(result,{users,audit,products,coupons});}
 return result;
}
