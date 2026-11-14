import catalog from '../../bekovich_catalog.json' with {type:'json'};
export const BADGE_WORDS=catalog.words;

export function sampleBadgeTitle(random = Math.random) {
 const pick = list => list[Math.floor(random() * list.length)];
 const noun = pick(BADGE_WORDS.nouns);
 const linked = BADGE_WORDS.adjectives.filter(a => a.tags.some(t => noun.tags.includes(t)));
 const adjective = pick(linked.length ? linked : BADGE_WORDS.adjectives);
 return {prefix: adjective[noun.gender], title: noun.word};
}
