import {initializeApp} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {logger} from 'firebase-functions';
import {createHash,randomInt} from 'node:crypto';
import {parseRequest} from './schema.mjs';
import {fail,quote,debit,credit,add,basis,transitionOrder,dayKey,integer} from './domain.mjs';
initializeApp();const db=getFirestore();
const hash=value=>createHash('sha256').update(value).digest('hex');
const defaults={taxBps:0,rewardPoints:0,transferFeeBps:0,referralBps:0,pointsPerCordoba:0,maintenance:true,transfersEnabled:false,announcement:'',whatsapp:''};
const doc=(collection,id)=>db.collection('nx_'+collection).doc(id);
// No privileged decision comes from a profile field, browser flag, or shared password.
export async function handleRequest(request){
 if(!request.auth||!request.auth.token.email_verified)throw new HttpsError('unauthenticated','Inicia sesión con un correo verificado.');
 let req;try{req=parseRequest(request.data);}catch{throw new HttpsError('invalid-argument','Revisa los datos de la solicitud.');}
 const uid=request.auth.uid,now=Date.now(),fingerprint=hash(JSON.stringify(req));
 try{
  // Count attempted requests, including rejected operations, to bound code guessing.
  const rateRef=doc('rates',hash(uid+':'+Math.floor(now/60000)));
  await db.runTransaction(async t=>{const r=await t.get(rateRef),count=r.exists?r.data().count:0;if(count>=30)fail('Demasiadas solicitudes. Inténtalo en un minuto.','resource-exhausted');t.set(rateRef,{count:count+1,createdAtMs:now});});
  return await db.runTransaction(async raw=>{
  // Buffer writes: Firestore requires every read to precede every write.
  const pending=new Map(),cache=new Map();
  const get=async(c,id)=>{const ref=doc(c,id);if(pending.has(ref.path))return pending.get(ref.path).data;if(cache.has(ref.path))return cache.get(ref.path);const snap=await raw.get(ref);const value=snap.exists?snap.data():null;cache.set(ref.path,value);return value;};
  const set=(c,id,data)=>pending.set(doc(c,id).path,{ref:doc(c,id),data});
  const opId=hash(uid+':'+req.requestId),previous=await get('operations',opId);
  if(previous){if(previous.fingerprint!==fingerprint)fail('La solicitud ya existe con otros datos.','already-exists');return previous.result;}
  const staff=await get('staff',uid),isAdmin=staff?.active===true&&staff?.role==='admin'&&request.auth.token.nxAdmin===true;
  if(req.action.startsWith('admin')&&!isAdmin)fail('Esta operación requiere administración.','permission-denied');
  const user=await get('users',uid);
  if(user?.disabled)fail('Cuenta suspendida.','permission-denied');
  const settings={...defaults,...await get('settings','store')};
  if(settings.maintenance&&!isAdmin&&!['bootstrap','profile'].includes(req.action))fail('La tienda está en mantenimiento.');
  if(!user&&req.action!=='bootstrap')fail('Completa primero tu perfil.');
  const p=req.payload;let result={ok:true};
  const account=async(id)=>{const u=await get('users',id);if(!u||u.disabled)fail('Cuenta no disponible.');return u;};
  let eventIndex=0;
  const ledger=(owner,currency,delta,kind,reference,wallet)=>{const id=opId+'_'+eventIndex++;set('ledger',id,{uid:owner,currency,delta,kind,reference,actorUid:uid,createdAtMs:now,balanceAfter:currency==='points'?wallet.points:wallet.balanceCents});};
  const saveWallet=(owner,wallet)=>set('users',owner,{...wallet,updatedAtMs:now});
  if(req.action==='bootstrap'){
   if(!user){const referralCode='NX-'+hash(uid).slice(0,12).toUpperCase();set('users',uid,{uid,name:p.name,email:request.auth.token.email||'',contact:'',savedPlayers:[],balanceCents:0,points:0,debtCents:0,disabled:false,referralCode,createdAtMs:now});set('referrals',referralCode,{uid});}
  }else if(req.action==='profile'){saveWallet(uid,{...user,...p});}
  else if(req.action==='purchase'||req.action==='adminSale'||req.action==='quote'){
   const target=req.action==='adminSale'?p.uid:uid,owner=await account(target),currency=p.currency||'cash',productMap={};
   for(const item of p.items)productMap[item.productId]=await get('products',item.productId);
   let coupon=null;
   if(p.coupon){coupon=await get('coupons',p.coupon);if(!coupon)fail('Cupón no válido.');if(await get('couponUses',hash(target+':'+p.coupon)))fail('Ya usaste este cupón.');}
   const q=quote(p.items,productMap,settings,coupon,now);
   if(currency==='points'&&(p.coupon||p.referralCode))fail('Los canjes no combinan cupones ni referidos.');
   if(currency==='points'&&q.lines.some(i=>i.pricePoints<=0))fail('Uno de los productos no admite puntos.');
   if(req.action==='quote'){for(const {ref,data} of pending.values())raw.set(ref,data);return {ok:true,...q};}
   if(req.action==='purchase'&&p.expectedTotal!==(currency==='points'?q.totalPoints:q.totalCents))fail('El precio cambió. Revisa el nuevo total antes de confirmar.');
   let sponsorUid=null,sponsor=null;
   if(p.referralCode){const referral=await get('referrals',p.referralCode);if(!referral||referral.uid===target)fail('Código de referido no válido.');if(owner.referredBy&&owner.referredBy!==referral.uid)fail('Ya tienes un referente asignado.');sponsorUid=referral.uid;sponsor=await account(sponsorUid);}
   else if(owner.referredBy&&currency==='cash'){sponsorUid=owner.referredBy;sponsor=await account(sponsorUid);}
   const orderId=opId;
   let updated=req.action==='adminSale'?{...owner}:debit(owner,currency,currency==='points'?q.totalPoints:q.totalCents);
   let earned=0;if(currency==='cash'){earned=Math.floor((q.subtotalCents-q.discountCents)*settings.pointsPerCordoba/100);if(earned)updated=credit(updated,'points',earned);}
   if(sponsorUid&&!owner.referredBy)updated.referredBy=sponsorUid;
   const deliveries=[];
   for(const [productId,product] of Object.entries(productMap)){
    const quantity=p.items.filter(i=>i.productId===productId).reduce((n,i)=>n+i.quantity,0);
    if(product.kind==='digital'){
     const secret=await get('stock',productId);if(!secret||secret.codes.length<quantity)fail('No hay códigos disponibles.');
     deliveries.push({productId,codes:secret.codes.slice(0,quantity)});set('stock',productId,{codes:secret.codes.slice(quantity)});
    }
    set('products',productId,{...product,stock:product.unlimited?product.stock:product.stock-quantity,sold:(product.sold||0)+quantity,updatedAtMs:now});
   }
   if(coupon){set('coupons',p.coupon,{...coupon,used:(coupon.used||0)+1});set('couponUses',hash(target+':'+p.coupon),{uid:target,code:p.coupon,orderId});}
   const commission=sponsor?basis(q.subtotalCents-q.discountCents,settings.referralBps):0;
   if(commission){const w=credit(sponsor,'cash',commission);saveWallet(sponsorUid,w);ledger(sponsorUid,'cash',commission,'referral',orderId,w);}
   saveWallet(target,updated);
   if(req.action!=='adminSale')ledger(target,currency,-(currency==='points'?q.totalPoints:q.totalCents),'purchase',orderId,updated);
   if(earned)ledger(target,'points',earned,'purchase_reward',orderId,updated);
   const instant=q.lines.every(i=>i.kind==='digital');
   set('orders',orderId,{uid:target,...q,currency,status:instant?'fulfilled':'pending',deliveries,earnedPoints:earned,sponsorUid,commissionCents:commission,paidExternally:req.action==='adminSale',reference:p.reference||'',createdAtMs:now,updatedAtMs:now});result={ok:true,orderId,...q};
  }else if(req.action==='deposit'){
   const bank=await get('banks',p.bankId);if(!bank?.active)fail('Cuenta de depósito no disponible.');
   const referenceKey=hash(p.bankId+':'+p.reference.toUpperCase().replace(/\s/g,''));if(await get('depositReferences',referenceKey))fail('Esta referencia ya fue registrada.');
   set('depositReferences',referenceKey,{depositId:opId});set('deposits',opId,{...p,uid,status:'pending',createdAtMs:now});result={ok:true,depositId:opId};
  }else if(req.action==='adminDeposit'){
   const deposit=await get('deposits',p.id);if(!deposit||deposit.status!=='pending')fail('Solicitud ya procesada.');
   if(p.approve){const u=await account(deposit.uid),w=credit(u,'cash',deposit.amountCents);saveWallet(deposit.uid,w);ledger(deposit.uid,'cash',deposit.amountCents,'deposit',p.id,w);}
   set('deposits',p.id,{...deposit,status:p.approve?'approved':'rejected',reviewedBy:uid,note:p.note,reviewedAtMs:now});
  }else if(req.action==='transfer'){
   if(!settings.transfersEnabled)fail('Transferencias deshabilitadas.');if(p.recipientUid===uid)fail('El destinatario debe ser otra persona.');
   const receiver=await account(p.recipientUid),fee=basis(p.amount,settings.transferFeeBps),sender=debit(user,p.currency,add(p.amount,fee)),recipient=credit(receiver,p.currency,p.amount);
   saveWallet(uid,sender);saveWallet(p.recipientUid,recipient);ledger(uid,p.currency,-add(p.amount,fee),'transfer_out',opId,sender);ledger(p.recipientUid,p.currency,p.amount,'transfer_in',opId,recipient);
   set('transfers',opId,{senderUid:uid,recipientUid:p.recipientUid,currency:p.currency,amount:p.amount,fee,createdAtMs:now});result={ok:true,fee};
  }else if(req.action==='reward'){
   if(settings.rewardPoints<=0)fail('Recompensa diaria deshabilitada.');const day=dayKey(now);if(user.rewardDay===day)fail('Ya recibiste la recompensa de hoy.');
   const w={...credit(user,'points',settings.rewardPoints),rewardDay:day};saveWallet(uid,w);ledger(uid,'points',settings.rewardPoints,'daily_reward',day,w);result={ok:true,points:settings.rewardPoints};
  }else if(req.action==='redeem'){
   const key=hash(p.code),gift=await get('gifts',key),useId=hash(uid+':'+key);if(!gift||gift.expiresAtMs<=now||gift.used>=gift.maxUses||await get('giftUses',useId))fail('Código no disponible o ya utilizado.');
   const w=credit(user,gift.currency,gift.amount);saveWallet(uid,w);ledger(uid,gift.currency,gift.amount,'gift',key,w);set('gifts',key,{...gift,used:gift.used+1});set('giftUses',useId,{uid,createdAtMs:now});
  }else if(req.action==='adminAdjust'){
   const u=await account(p.uid),w=p.amount>0?credit(u,p.currency,p.amount):debit(u,p.currency,-p.amount);saveWallet(p.uid,w);ledger(p.uid,p.currency,p.amount,'adjustment',opId,w);
  }else if(req.action==='adminUser'){
   if(p.uid===uid||(await get('staff',p.uid))?.active)fail('Los permisos del equipo se gestionan fuera de la tienda.');const u=await get('users',p.uid);if(!u)fail('Cuenta no encontrada.');saveWallet(p.uid,{...u,disabled:p.disabled});
  }else if(req.action==='adminProduct'){
   const existing=await get('products',p.id);if(p.product.kind==='digital'){
    const secret=await get('stock',p.id);p.product.stock=secret?.codes?.length||0;p.product.unlimited=false;
   }set('products',p.id,{...p.product,sold:existing?.sold||0,updatedAtMs:now});
  }else if(req.action==='adminStock'){
   const product=await get('products',p.productId);if(!product||product.kind!=='digital')fail('Selecciona un producto digital.');const stock=await get('stock',p.productId)||{codes:[]};
   const codes=[...stock.codes,...p.codes];if(new Set(codes).size!==codes.length||codes.length>2000)fail('Códigos duplicados o límite de inventario superado.');
   for(const code of p.codes){const key=hash(code);if(await get('codeFingerprints',key))fail('Un código ya fue cargado anteriormente.');set('codeFingerprints',key,{productId:p.productId,createdAtMs:now});}
   set('stock',p.productId,{codes});set('products',p.productId,{...product,stock:codes.length,unlimited:false});
  }else if(req.action==='adminSettings'){set('settings','store',p);}
  else if(req.action==='adminBank'){set('banks',p.id,p);}
  else if(req.action==='adminCoupon'){
   const old=await get('coupons',p.code);set('coupons',p.code,{...p,used:old?.used||0});
  }else if(req.action==='adminGift'){
   const key=hash(p.code);if(await get('gifts',key))fail('El código ya existe.');const {code,...gift}=p;set('gifts',key,{...gift,used:0,createdAtMs:now});
  }else if(req.action==='adminOrder'){
   const order=await get('orders',p.id);if(!order)fail('Pedido no encontrado.');const updated=transitionOrder(order,p.status);
   if(p.status==='refunded'){
    if(order.deliveries?.length)fail('Este pedido contiene códigos entregados; requiere conciliación manual.');
    if(order.paidExternally)fail('Devuelve el pago externo y registra el ajuste con su referencia.');
    const owner=await account(order.uid);let w=credit(owner,order.currency,order.currency==='points'?order.totalPoints:order.totalCents);
    if(order.earnedPoints)w=debit(w,'points',order.earnedPoints);
    if(order.commissionCents){const sponsor=await account(order.sponsorUid),sw=debit(sponsor,'cash',order.commissionCents);saveWallet(order.sponsorUid,sw);ledger(order.sponsorUid,'cash',-order.commissionCents,'referral_reversal',p.id,sw);}
    for(const line of order.lines){const product=await get('products',line.productId);if(product)set('products',line.productId,{...product,stock:product.unlimited?product.stock:add(product.stock,line.quantity),sold:Math.max(0,(product.sold||0)-line.quantity)});}
    saveWallet(order.uid,w);ledger(order.uid,order.currency,order.currency==='points'?order.totalPoints:order.totalCents,'refund',p.id,w);if(order.earnedPoints)ledger(order.uid,'points',-order.earnedPoints,'reward_reversal',p.id,w);
   }set('orders',p.id,{...updated,note:p.note,updatedAtMs:now,processedBy:uid});
  }else if(req.action==='debtPayment'){
   if(p.amountCents>(user.debtCents||0))fail('El abono supera la deuda.');const w={...debit(user,'cash',p.amountCents),debtCents:user.debtCents-p.amountCents};saveWallet(uid,w);ledger(uid,'cash',-p.amountCents,'debt_payment',opId,w);
  }else if(req.action==='adminDebt'){
   const u=await account(p.uid),debtCents=add(u.debtCents||0,p.amountCents);integer(debtCents);saveWallet(p.uid,{...u,debtCents});set('debts',opId,{uid:p.uid,delta:p.amountCents,reason:p.reason,actorUid:uid,createdAtMs:now});
  }else if(req.action==='adminRaffle'){
   const old=await get('raffles',p.id);if(old?.winnerUid)fail('Sorteo ya finalizado.');set('raffles',p.id,{...p,participants:old?.participants||[],entryCost:0});
  }else if(req.action==='raffleEnter'){
   const r=await get('raffles',p.raffleId);if(!r||!r.active||r.endsAtMs<=now||r.winnerUid)fail('Sorteo cerrado.');if(r.participants.includes(uid))fail('Ya estás participando.');if(r.participants.length>=5000)fail('Sorteo completo.');set('raffles',p.raffleId,{...r,participants:[...r.participants,uid]});
  }else if(req.action==='adminRaffleDraw'){
   const r=await get('raffles',p.id);if(!r||r.winnerUid||r.endsAtMs>now||!r.participants.length)fail('No se puede resolver este sorteo.');const winnerUid=r.participants[randomInt(r.participants.length)];set('raffles',p.id,{...r,active:false,winnerUid,drawnAtMs:now});result={ok:true,winnerUid};
  }
  // Audit metadata deliberately omits gift codes, player details, and payment references.
  set('audit',opId,{actorUid:uid,action:req.action,requestId:req.requestId,createdAtMs:now});
  set('operations',opId,{uid,fingerprint,result,createdAtMs:now});
  for(const {ref,data} of pending.values())raw.set(ref,data);
  return result;
 });}catch(error){if(error.code&&['invalid-argument','failed-precondition','permission-denied','already-exists','resource-exhausted'].includes(error.code))throw new HttpsError(error.code,error.message);logger.error('Operation failed',{action:req.action,requestId:req.requestId,code:error.code||'internal'});throw new HttpsError('internal','No se pudo completar la operación. Conserva la solicitud y vuelve a intentar.');}
}
export const nexusApi=onCall({region:'us-central1',enforceAppCheck:true,maxInstances:10,timeoutSeconds:60,memory:'256MiB'},handleRequest);
