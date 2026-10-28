export class DomainError extends Error { constructor(code,message){super(message);this.code=code;} }
export const fail=(message,code='failed-precondition')=>{throw new DomainError(code,message);};
export function integer(value,min=0,max=100_000_000){if(!Number.isSafeInteger(value)||value<min||value>max)fail('Cantidad fuera de rango.','invalid-argument');return value;}
export function money(value){return integer(value);}
export function add(a,b){const n=a+b;if(!Number.isSafeInteger(n)||Math.abs(n)>100_000_000)fail('Importe fuera de rango.');return n;}
export function basis(amount,rate){integer(rate,0,10000);return Math.floor((amount*rate+5000)/10000);}
export function quote(items,products,settings,coupon,now=Date.now()){
 if(!Array.isArray(items)||!items.length||items.length>30)fail('Selecciona de 1 a 30 productos.','invalid-argument');
 const seen=new Set();let subtotal=0,points=0;
 const lines=items.map(item=>{
  integer(item.quantity,1,99);const key=item.productId+':'+(item.playerId||'');if(seen.has(key))fail('Producto duplicado.','invalid-argument');seen.add(key);
  const p=products[item.productId];if(!p||!p.active)fail('Producto no disponible.');
  if(p.requiresPlayerId&&!/^[0-9]{5,20}$/.test(item.playerId||''))fail('ID de jugador inválido.','invalid-argument');
  money(p.priceCents);integer(p.pricePoints);if(!p.unlimited&&p.stock<items.filter(i=>i.productId===item.productId).reduce((n,i)=>n+i.quantity,0))fail('Inventario insuficiente.');
  subtotal=add(subtotal,p.priceCents*item.quantity);points=add(points,p.pricePoints*item.quantity);
  return {productId:item.productId,name:p.name,quantity:item.quantity,priceCents:p.priceCents,pricePoints:p.pricePoints,playerId:item.playerId||'',kind:p.kind};
 });
 let discount=0;
 if(coupon){if(!coupon.active||coupon.expiresAtMs<=now||coupon.used>=coupon.maxUses)fail('Cupón no disponible.');if(subtotal<coupon.minimumCents)fail('El pedido no alcanza el mínimo del cupón.');discount=basis(subtotal,coupon.discountBps);}
 const tax=basis(subtotal-discount,settings.taxBps||0);const total=add(subtotal-discount,tax);
 return {lines,subtotalCents:subtotal,discountCents:discount,taxCents:tax,totalCents:total,totalPoints:points};
}
export function debit(wallet,currency,amount){integer(amount,1);const key=currency==='points'?'points':'balanceCents';const available=integer(wallet[key]||0);if(available<amount)fail('Saldo insuficiente.');return {...wallet,[key]:available-amount};}
export function credit(wallet,currency,amount){integer(amount,1);const key=currency==='points'?'points':'balanceCents';return {...wallet,[key]:add(integer(wallet[key]||0),amount)};}
export function transitionOrder(order,status){const allowed={pending:['fulfilled','refunded'],fulfilled:[],refunded:[]};if(!allowed[order.status]?.includes(status))fail('El pedido ya fue procesado o la transición no es válida.');return {...order,status};}
export const dayKey=(time)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Managua',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
