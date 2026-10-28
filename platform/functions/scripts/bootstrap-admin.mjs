// Run only with an operator's Application Default Credentials on the selected staging project.
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
const [projectId,uid]=process.argv.slice(2);
if(!projectId||!uid||process.env.NEXUS_BOOTSTRAP_PROJECT!==projectId)throw new Error('Set NEXUS_BOOTSTRAP_PROJECT to the explicit target project and pass projectId and verified user UID.');
initializeApp({projectId});const auth=getAuth(),user=await auth.getUser(uid);if(!user.emailVerified)throw new Error('User must verify their email first.');
await auth.setCustomUserClaims(uid,{...user.customClaims,nxAdmin:true});
await getFirestore().doc('nx_staff/'+uid).set({role:'admin',active:true,createdAtMs:Date.now()});
console.log('Administrator provisioned. Sign out and sign in to refresh the token.');
