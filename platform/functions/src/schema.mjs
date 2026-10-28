import {z} from 'zod';
const id=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);const short=z.string().trim().min(1).max(120);const cents=z.number().int().min(0).max(100000000);const amount=cents.min(1);const text=z.string().trim().max(800);const code=z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,40}$/);
const url=z.union([z.literal(''),z.string().url().max(600).refine(v=>v.startsWith('https://'),'Usa HTTPS')]);
export const product=z.object({name:short,description:text,category:short,subcategory:short,priceCents:cents,pricePoints:cents,stock:z.number().int().min(0).max(100000),unlimited:z.boolean(),active:z.boolean(),requiresPlayerId:z.boolean(),kind:z.enum(['service','physical','digital']),imageUrl:url}).strict();
const purchase=z.object({items:z.array(z.object({productId:id,quantity:z.number().int().min(1).max(99),playerId:z.string().regex(/^[0-9]{5,20}$/).optional()}).strict()).min(1).max(30),currency:z.enum(['cash','points']),coupon:code.optional(),referralCode:code.optional(),expectedTotal:cents}).strict();
export const schemas={
 bootstrap:z.object({name:short}).strict(),
 profile:z.object({name:short,contact:z.string().trim().max(80),savedPlayers:z.array(z.object({id:z.string().regex(/^[0-9]{5,20}$/),name:short}).strict()).max(20)}).strict(),
 purchase,
 quote:purchase.omit({expectedTotal:true}),
 deposit:z.object({amountCents:amount,bankId:id,reference:z.string().trim().min(4).max(120)}).strict(),
 transfer:z.object({recipientUid:id,currency:z.enum(['cash','points']),amount}).strict(),
 reward:z.object({}).strict(),redeem:z.object({code}).strict(),
 adminUser:z.object({uid:id,disabled:z.boolean()}).strict(),
 adminProduct:z.object({id,product}).strict(),
 adminStock:z.object({productId:id,codes:z.array(z.string().trim().min(1).max(300)).min(1).max(100)}).strict(),
 adminDeposit:z.object({id,approve:z.boolean(),note:text}).strict(),
 adminOrder:z.object({id,status:z.enum(['fulfilled','refunded']),note:text}).strict(),
 adminAdjust:z.object({uid:id,currency:z.enum(['cash','points']),amount:z.number().int().min(-100000000).max(100000000).refine(n=>n!==0),reason:z.string().trim().min(8).max(400)}).strict(),
 adminSettings:z.object({taxBps:z.number().int().min(0).max(10000),rewardPoints:z.number().int().min(0).max(1000),transferFeeBps:z.number().int().min(0).max(1000),referralBps:z.number().int().min(0).max(2000),pointsPerCordoba:z.number().int().min(0).max(1000),maintenance:z.boolean(),transfersEnabled:z.boolean(),announcement:z.string().max(300),whatsapp:z.string().regex(/^[0-9]{8,15}$|^$/)}).strict(),
 adminBank:z.object({id,name:short,account:z.string().trim().min(1).max(100),holder:short,active:z.boolean()}).strict(),
 adminCoupon:z.object({code,discountBps:z.number().int().min(1).max(10000),minimumCents:cents,maxUses:z.number().int().min(1).max(100000),expiresAtMs:z.number().int().positive(),active:z.boolean()}).strict(),
 adminGift:z.object({code,currency:z.enum(['cash','points']),amount,maxUses:z.number().int().min(1).max(10000),expiresAtMs:z.number().int().positive()}).strict(),
 debtPayment:z.object({amountCents:amount}).strict(),
 adminDebt:z.object({uid:id,amountCents:z.number().int().min(-100000000).max(100000000).refine(n=>n!==0),reason:z.string().trim().min(8).max(400)}).strict(),
 adminSale:z.object({uid:id,items:purchase.shape.items,reference:short}).strict(),
 raffleEnter:z.object({raffleId:id}).strict(),
 adminRaffle:z.object({id,title:short,prize:short,endsAtMs:z.number().int().positive(),active:z.boolean()}).strict(),
 adminRaffleDraw:z.object({id}).strict()
};
export function parseRequest(data){const req=z.object({action:z.enum(Object.keys(schemas)),payload:z.unknown(),requestId:z.string().uuid()}).strict().parse(data);return {...req,payload:schemas[req.action].parse(req.payload)};}
