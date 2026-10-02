import { PublicClientApplication } from '@azure/msal-browser';
import {base64UTF8,mime,renderPackage,subject} from './core.js';
let ms;
const connections=new Map();
const scopes=['User.Read','Mail.ReadWrite'];
export const mailboxes=()=>[...connections.values()].map(({token,...info})=>info);
export function disconnectMail(){connections.clear();ms?.clearCache();ms=undefined;}
async function json(url,options){ const r=await fetch(url,options);const data=await r.json();if(!r.ok)throw Error(data.error?.message||data.error_description||`Mailbox request failed (${r.status})`);return data; }
export async function connectGoogle(clientId){
 if(!clientId?.endsWith('.apps.googleusercontent.com'))throw Error('Add your Google OAuth client ID in Settings first.');
 if(!window.google?.accounts?.oauth2)throw Error('Google sign-in is still loading or was blocked. Open the builder directly and try again.');
 const result=await new Promise((resolve,reject)=>window.google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/userinfo.email',callback:r=>r.error?reject(Error(r.error)):resolve(r),error_callback:r=>reject(Error(r.message||r.type)),}).requestAccessToken({prompt:'select_account'}));
 const user=await json('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:`Bearer ${result.access_token}`}});
 const key=`google:${user.email}`;connections.set(key,{key,provider:'google',email:user.email,token:result.access_token,expires:Date.now()+result.expires_in*1000});
}
export async function connectMicrosoft(clientId){
 if(!clientId)throw Error('Add your Microsoft application client ID in Settings first.');
 ms ||= new PublicClientApplication({auth:{clientId,authority:'https://login.microsoftonline.com/common',redirectUri:new URL('./auth.html',location.href).href},cache:{cacheLocation:'memoryStorage'}});
 await ms.initialize();const r=await ms.acquireTokenPopup({scopes,prompt:'select_account'});
 const user=await json('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName',{headers:{Authorization:`Bearer ${r.accessToken}`}});
 const email=user.mail||user.userPrincipalName,key=`microsoft:${email}`;
 connections.set(key,{key,provider:'microsoft',email,token:r.accessToken,expires:r.expiresOn.getTime()});
}
export async function createDraft(key,p,recipient){
 const c=connections.get(key);if(!c||c.expires<Date.now()+30000)throw Error('Reconnect this mailbox before creating drafts.');
 const headers={Authorization:`Bearer ${c.token}`,'Content-Type':'application/json'};
 if(c.provider==='google'){
 const raw=base64UTF8(mime(p,recipient)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 return json('https://gmail.googleapis.com/gmail/v1/users/me/drafts',{method:'POST',headers,body:JSON.stringify({message:{raw}})});
 }
 return json('https://graph.microsoft.com/v1.0/me/messages',{method:'POST',headers,body:JSON.stringify({subject:subject(p),body:{contentType:'HTML',content:renderPackage(p)},toRecipients:[{emailAddress:{address:recipient}}]})});
}
