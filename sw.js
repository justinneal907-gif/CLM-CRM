/* CLM CRM notification service worker · 2026-09-23 */
self.addEventListener('install',event=>{self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=(event.notification&&event.notification.data&&event.notification.data.url)||self.registration.scope;
  event.waitUntil((async()=>{
    const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of list){
      try{
        if('focus' in client){
          await client.focus();
          if('navigate' in client&&target)await client.navigate(target);
          return;
        }
      }catch(err){}
    }
    if(self.clients.openWindow)await self.clients.openWindow(target);
  })());
});
