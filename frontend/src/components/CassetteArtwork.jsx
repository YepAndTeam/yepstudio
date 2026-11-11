// Static pixel cover art shared by wall thumbnails, inspection and the player.
export default function CassetteArtwork({theme}){
 if(!["nyan","tetris","poop","neon"].includes(theme))return null;
 return <svg className={`tape-front-art art-${theme}`} viewBox="0 0 80 64" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
  {theme==="neon"&&<>
   <path fill="#0b132a" d="M0 0h80v64H0z"/><path fill="#27506b" d="M3 3h14v37H3zm61 4h12v34H64z"/><path fill="#6ae7ee" d="M5 9h8v2H5zm0 7h5v2H5zm63-3h5v2h-5zM0 57h80v2H0z"/><path fill="#f174c7" d="M2 33h17v3H2zm59-9h18v3H61z"/>
   <path fill="#101b30" d="M5 45h70v12H5zM17 34h47v18H17z"/><path fill="#8ebddb" d="M9 43h62v9H9zM22 33h35v10H22zM15 39h49v6H15z"/><path fill="#d6e7ef" d="M13 43h53v3H13zM25 33h29v2H25z"/><path fill="#20344f" d="M25 36h27v7H25zM9 53h11v7H9zm49 0h11v7H58z"/>
   <path fill="#ff6899" d="M12 47h4v4h-4zm6 0h4v4h-4zm39 0h4v4h-4zm6 0h4v4h-4z"/><path fill="#e8f8ff" d="M34 48h11v4H34z"/><path fill="#081022" d="M6 38h69v3H6z"/><path fill="#72e5e7" d="M29 60h20v2H29z"/>
  </>}
  {theme==="nyan"&&<>
   <path fill="#fff5fb" d="M6 6h2v6H6zm-2 2h6v2H4zm61 0h2v6h-2zm-2 2h6v2h-6zM14 52h2v6h-2zm-2 2h6v2h-6z"/>
   {["#ff5454","#ffb33f","#ffec58","#6cde7c","#66b9ff","#c285ed"].map((fill,i)=><path key={fill} fill={fill} d={`M0 ${23+i*3}h26v3H0z`}/>)}
   <path fill="#252a49" d="M24 15h28v4h5v8h6v-8h5v5h5v19h-5v5H26v-4h-5V19h3zM25 44h7v7h-7zm17 0h7v7h-7zm16-1h7v7h-7zM14 29h9v7h-9z"/>
   <path fill="#e9bb83" d="M26 18h23v26H26z"/><path fill="#ff9bbf" d="M29 21h17v20H29z"/>
   <path fill="#d35790" d="M32 24h3v3h-3zm8 3h3v3h-3zm-8 8h3v3h-3z"/>
   <path fill="#aeb9c7" d="M48 26h6v6h9v-8h3v5h4v12h-4v4H50v-4h-5V30h3zM17 30h6v3h-6zm10 15h3v4h-3zm17 0h3v4h-3zm16-1h3v4h-3z"/>
   <path fill="#292b42" d="M51 33h3v3h-3zm11 0h3v3h-3zm-7 6h7v2h-7z"/><path fill="#f6a1b9" d="M48 37h3v3h-3zm17 0h3v3h-3z"/>
  </>}
  {theme==="tetris"&&<>
   <path fill="#ffffff12" d="M0 59h80v2H0zM5 0h1v60H5zm12 0h1v60h-1zm12 0h1v60h-1zm12 0h1v60h-1zm12 0h1v60h-1zm12 0h1v60h-1z"/>
   {[[5,47,"#5bd5dc"],[17,47,"#5bd5dc"],[29,47,"#5bd5dc"],[41,47,"#5bd5dc"],[53,47,"#e5bf57"],[65,47,"#e5bf57"],[53,35,"#e5bf57"],[65,35,"#e5bf57"],[17,23,"#b48bea"],[5,35,"#b48bea"],[17,35,"#b48bea"],[29,35,"#b48bea"],[42,5,"#f08a54"],[42,17,"#f08a54"],[54,17,"#f08a54"],[66,17,"#f08a54"]].map(([x,y,fill],i)=><g key={i}><rect x={x} y={y} width="11" height="11" fill={fill}/><path d={`M${x+2} ${y+8}V${y+2}h7`} stroke="#ffffff70" fill="none" strokeWidth="1"/><path d={`M${x+3} ${y+9}h6v-6`} stroke="#0003" fill="none" strokeWidth="1"/></g>)}
  </>}
  {theme==="poop"&&<>
   <path fill="#afc9ad" d="M0 57h80v2H0zM7 59h2v5H7zm18 0h2v5h-2zm18 0h2v5h-2zm18 0h2v5h-2z"/>
   <path fill="#3f3b31" d="M7 23h19v24H7zm11 13h37v14h-5v6h-7v6H28v-6h-6v-7h-4z"/>
   <path fill="#f3f1dc" d="M9 25h15v19H9zm12 13h31v10h-5v6H31v5h9v-4h-12v-6h-7z"/>
   <path fill="#b9d4ca" d="M11 29h5v3h-5zm13 13h26v4H24z"/>
   <path fill="#4a2d20" d="M35 7h8v5h5v5h4v6h4v10h-4v4H27v-4h-4V23h4v-5h4v-6h4z"/>
   <path fill="#94613b" d="M36 10h5v6h5v5h4v5h3v6H27v-7h4v-5h4v-5h1z"/>
   <path fill="#b78550" d="M36 18h8v3h-8zm-7 9h22v3H29z"/>
   <path fill="#fff4de" d="M31 24h5v6h-5zm12 0h5v6h-5z"/><path fill="#33251e" d="M33 26h2v3h-2zm12 0h2v3h-2zm-8 5h6v2h-6z"/>
   <path fill="#684a2b" d="M65 14h4v36h-4z"/><path fill="#cda46a" d="M66 15h2v31h-2z"/>
   <path fill="#623329" d="M61 46h12v5h4v7H57v-7h4z"/><path fill="#c46648" d="M63 48h8v4h4v3H59v-3h4z"/>
  </>}
 </svg>;
}
