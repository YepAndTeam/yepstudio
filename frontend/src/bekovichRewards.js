// For amounts 5..50, weights decrease linearly from 46 to 1 (total 1081).
export function rollJeraBox(randomInt) {
 let roll=randomInt(1081);
 for(let amount=5;amount<=50;amount++){roll-=51-amount;if(roll<0)return amount;}
 throw Error('Invalid reward roll');
}
export function rollUsb(randomInt) {
 const player=randomInt(100)<30?'themes':'dvd';
 if(randomInt(100)<50)return {player,opens:0};
 const roll=randomInt(100);
 return {player,opens:roll<60?1:roll<90?3:roll<99?5:10};
}
export function rollRewardDetails(kind,randomInt) {
 return kind==='coins'?{amount:rollJeraBox(randomInt)}:kind==='usb'?{usb:rollUsb(randomInt)}:{};
}
export function usbInfo(entry) {
 // Previously remembered prototype USBs used a fixed DVD ×3 reward.
 const usb=entry?.usb||{player:'dvd',opens:3};
 const player=usb.player==='themes'?'Плеер тем':'DVD';
 return {title:usb.opens?`${player} · ${usb.opens}×`:'Пустая флешка',
 description:usb.opens?`Запись расшифрована: ${player}, бесплатных открытий — ${usb.opens}.`:'На флешке нет открытий. Бекович только развёл руками.',
 detail:`USB / ${usb.player==='themes'?'THEMES':'DVD'} / ${usb.opens}×`};
}
