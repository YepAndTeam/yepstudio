import {useLayoutEffect,useRef,useState} from 'react';
export default function PartyChatLog({messages,viewerId,className,header}){
 const node=useRef(null),follow=useRef(true),previous=useRef(null),[unread,setUnread]=useState(false);
 const last=messages.at(-1),lastId=last?.id;
 const bottom=()=>{if(node.current)node.current.scrollTop=node.current.scrollHeight;};
 useLayoutEffect(()=>{const fresh=previous.current!==lastId;if(follow.current||fresh&&last?.uid===viewerId){bottom();follow.current=true;setUnread(false);}else if(fresh)setUnread(true);previous.current=lastId;},[lastId,last?.uid,viewerId,messages.length]);
 useLayoutEffect(()=>{const observer=new ResizeObserver(()=>{if(follow.current)bottom();});if(node.current)observer.observe(node.current);return()=>observer.disconnect();},[]);
 return <div ref={node} className={className} role="log" aria-live="polite" onScroll={e=>{const n=e.currentTarget;follow.current=n.scrollHeight-n.clientHeight-n.scrollTop<48;if(follow.current)setUnread(false);}}>{header}{messages.length?messages.map(message=><p key={message.id}><b>{message.name}{message.last_words?' · Последнее слово':''}</b><span>{message.text}</span></p>):<p>Пока тихо. Начни разговор.</p>}{unread&&<button type="button" className="party-chat-new" onClick={()=>{follow.current=true;bottom();setUnread(false);}}>Новые сообщения ↓</button>}</div>;
}
