// One switch restores the old global theme. This never changes ownership.
export function resolveTheme({selected='dark',base='dark',mode='global',area='shell',includeGamesMenu=false}){
 if(mode==='global')return selected;
 return area==='play'||area==='yaabik'||area==='preview'||(includeGamesMenu&&area==='games')?selected:base;
}
