import { usePreferences } from '../preferences';
export default function GameCanvas({style,ref,...props}){
 const {gameScale,gameMaxWidth}=usePreferences();
 return <canvas {...props} ref={ref} style={{...style,width:gameScale+'%',maxWidth:gameMaxWidth||style?.maxWidth,marginInline:'auto'}}/>;
}
