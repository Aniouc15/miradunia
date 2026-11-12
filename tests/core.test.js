// Tests des règles du jeu, des données et des textes de chaque langue. Lancer : node tests/core.test.js
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../site/js/core.js');

const SITE = path.join(__dirname, '../site');
function charger(fichier, nom) {
  const bac = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(SITE, fichier), 'utf8'), bac);
  return bac.window[nom];
}
const D = charger('data/data.js', 'GC_DATA');
const LANGUES = Object.fromEntries(D.langues.map((l) => [l.code, charger('lang/' + l.code + '.js', 'GC_LANGUE')]));
// Textes des curiosités, rangés par paquets : textes/<langue>/<n>.js appelle GC_PAQUET(langue, n, {id: [nom, fait, lien, auteur, licence, page, depot]}).
const TEXTES = {};
for (const code of Object.keys(LANGUES)) {
  TEXTES[code] = {};
  for (let n = 0; n < D.paquets; n++) {
    vm.runInNewContext(fs.readFileSync(path.join(SITE, 'textes', code, n + '.js'), 'utf8'), {
      GC_PAQUET: (langue, numero, contenu) => {
        assert.strictEqual(langue, code);
        assert.strictEqual(numero, n);
        for (const [id, x] of Object.entries(contenu)) {
          assert.strictEqual(C.paquetDe(id, D.paquets), n, 'curiosité dans le mauvais paquet : ' + id);
          TEXTES[code][id] = x;
        }
      }
    });
  }
}
const FR = LANGUES.fr;
const parId = Object.fromEntries(D.items.map((i) => [i.id, i]));
const simple = (t) => t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const reperes = (t) => (String(t).match(/\{\w+\}|<\/?[ab]>/g) || []).sort();
const versB64 = (t) => Buffer.from(t, 'utf8').toString('base64');
const depuisB64 = (t) => Buffer.from(t, 'base64').toString('utf8');
let nb = 0;
function test(nom, f) { f(); nb += 1; console.log('ok  ' + nom); }

test('données : au moins 100 pays et 1 000 curiosités, 4 curiosités ou plus par pays, photo et niveau partout', () => {
  assert.ok(Object.keys(D.pays).length >= 100, 'pays : ' + Object.keys(D.pays).length);
  assert.ok(D.items.length >= 1000, 'curiosités : ' + D.items.length);
  assert.strictEqual(new Set(D.items.map((i) => i.id)).size, D.items.length, 'identifiants en double');
  assert.strictEqual(new Set(D.items.map((i) => C.nomPhoto(i.id))).size, D.items.length, 'deux curiosités pour un même nom de photo');
  for (const [code, p] of Object.entries(D.pays)) assert.ok(['Europe', 'Asie', 'Afrique', 'Amériques', 'Océanie'].includes(p.continent), code);
  const compte = {};
  for (const i of D.items) {
    compte[i.pays] = (compte[i.pays] || 0) + 1;
    assert.ok(D.pays[i.pays], i.id);
    assert.ok([1, 2, 3].includes(i.niv), i.id);
    assert.ok(['monument', 'lieu', 'plat', 'boisson', 'fête', 'tradition', 'instrument', 'objet'].includes(i.cat), i.id);
    assert.ok(!('nom' in i) && !('fait' in i) && !('credit' in i), 'texte dans les données communes : ' + i.id);
    assert.ok(fs.existsSync(path.join(SITE, 'img', C.nomPhoto(i.id) + '.jpg')), 'photo absente : ' + i.id);
    assert.ok(i.aussi === undefined || (i.aussi.length > 0 && i.aussi.every((c) => D.pays[c] && c !== i.pays)), 'pays acceptés : ' + i.id);
    assert.ok(i.v === undefined || (Number.isInteger(i.v) && i.v > 0 && D.versions.some((p) => p[1] === i.v)), 'vague inconnue : ' + i.id);
  }
  for (const code of Object.keys(D.pays)) assert.ok(compte[code] >= 4, code);
  for (const niv of [1, 2, 3]) assert.ok(D.items.filter((i) => i.niv === niv).length >= 100, 'niveau ' + niv);
});

test('les photos portent un nom neutre, et aucune n\'est orpheline dans site/img', () => {
  // Photos des curiosités en jeu, et de celles qui attendent leur traduction (outils/cache/donnees.json).
  const connues = JSON.parse(fs.readFileSync(path.join(__dirname, '../outils/cache/donnees.json'), 'utf8')).items.map((i) => i.id);
  const attendues = new Set(D.items.map((i) => i.id).concat(connues).map((id) => C.nomPhoto(id) + '.jpg'));
  for (const f of fs.readdirSync(path.join(SITE, 'img'))) assert.ok(attendues.has(f), f);
  assert.ok(/^[0-9a-f]{12}$/.test(C.nomPhoto('sushi')));
});

test('chaque langue publiée a sa page, le nom de chaque pays et le nom, la phrase, le lien et le crédit de chaque curiosité', () => {
  assert.ok(FR, 'le français est publié');
  for (const [code, L] of Object.entries(LANGUES)) {
    assert.strictEqual(L.code, code);
    assert.ok(['ltr', 'rtl'].includes(L.dir), code);
    assert.ok(!('items' in L), code + ' : les textes des curiosités sont dans les paquets');
    assert.ok(fs.existsSync(path.join(SITE, code, 'index.html')) && fs.existsSync(path.join(SITE, code, 'manifest.webmanifest')), code);
    for (const pays of Object.keys(D.pays)) assert.ok(L.pays[pays], code + ' : pays ' + pays);
    assert.strictEqual(Object.keys(TEXTES[code]).length, D.items.length, code);
    for (const i of D.items) {
      const [nom, fait, lien, auteur, licence, page, depot] = TEXTES[code][i.id] || [];
      assert.ok(nom && fait, code + ' : ' + i.id);
      assert.ok(/^https:\/\/[a-z]{2,3}\.wikipedia\.org\/wiki\/./.test(lien), code + ' : lien de ' + i.id);
      assert.ok(auteur && licence && page.startsWith('https://commons.wikimedia.org/') && (depot === 0 || depot === 1), code + ' : crédit de ' + i.id);
    }
  }
  assert.ok(!fs.readdirSync(path.join(SITE, 'textes')).some((code) => !LANGUES[code]), 'paquets d\'une langue non publiée');
});

test('dans chaque langue, le nom affiché ne contient pas le nom du pays à deviner', () => {
  for (const [code, L] of Object.entries(LANGUES)) {
    for (const i of D.items) {
      assert.ok(!simple(TEXTES[code][i.id][0]).includes(simple(L.pays[i.pays])), code + ' : ' + i.id + ' (' + TEXTES[code][i.id][0] + ')');
    }
  }
});

test('les textes de l\'interface existent dans chaque langue, avec les mêmes repères qu\'en français', () => {
  for (const [code, L] of Object.entries(LANGUES)) {
    for (const [cle, francais] of Object.entries(FR.ui)) {
      const traduit = L.ui[cle];
      assert.ok(traduit !== undefined, code + ' : ' + cle);
      if (typeof francais === 'string') {
        assert.deepStrictEqual(reperes(traduit), reperes(francais), code + ' : ' + cle);
      } else {
        assert.ok(typeof traduit.other === 'string', code + ' : ' + cle + ' sans forme « other »');
        const permis = new Set(Object.values(francais).flatMap(reperes));
        for (const forme of Object.values(traduit)) for (const r of reperes(forme)) assert.ok(permis.has(r), code + ' : ' + cle);
      }
    }
    // Les règles de pluriel de la langue existent (sinon le jeu prendrait la forme « other »).
    assert.ok(new Intl.PluralRules(L.locale).select(1), code);
  }
});

test('le défi du jour est identique pour tout le monde et change chaque jour', () => {
  const douze = C.construireDefi(D, 12);
  assert.deepStrictEqual(C.construireDefi(D, 12), douze);
  assert.notDeepStrictEqual(C.construireDefi(D, 13), douze);
  C.construireDefi(D, 100); // passage par un autre bloc : le défi se reconstruit à l'identique
  assert.deepStrictEqual(C.construireDefi(D, 12), douze);
  douze.epreuves[0].options.length = 0; // modifier une copie ne change pas le défi
  assert.strictEqual(C.construireDefi(D, 12).epreuves[0].options.length, 4);
});

test('800 jours de défis sont tous jouables et sans ambiguïté', () => {
  for (let jour = 0; jour < 800; jour++) {
    const defi = C.construireDefi(D, jour);
    const [a, b, c] = defi.epreuves;
    // Épreuve 1
    assert.strictEqual(parId[a.item].niv, defi.niveau);
    assert.strictEqual(new Set(a.options).size, 4);
    assert.ok(a.options.includes(parId[a.item].pays));
    // Épreuve 2
    assert.strictEqual(new Set(b.cartes).size, 4);
    assert.ok(b.cartes.includes(b.intrus));
    assert.strictEqual(parId[b.intrus].pays, b.paysIntrus);
    assert.notStrictEqual(b.paysIntrus, b.paysTrio);
    assert.strictEqual(D.pays[b.paysIntrus].continent, D.pays[b.paysTrio].continent, 'intruse venue d\'un autre continent, jour ' + jour);
    assert.strictEqual(b.cartes.filter((id) => parId[id].pays === b.paysTrio).length, 3);
    // Épreuve 3 : 4 curiosités, 5 pays, un seul pays sans curiosité
    assert.strictEqual(c.items.length, 4);
    assert.strictEqual(new Set(c.pays).size, 5);
    const paysDesItems = c.items.map((id) => parId[id].pays);
    assert.strictEqual(new Set(paysDesItems).size, 4);
    assert.ok(paysDesItems.every((p) => c.pays.includes(p)));
    assert.ok(c.pays.includes(c.paysEnTrop) && !paysDesItems.includes(c.paysEnTrop));
    // Aucune curiosité ni aucun pays en double dans la journée
    const ids = [a.item, ...b.cartes, ...c.items];
    assert.strictEqual(new Set(ids).size, ids.length, 'jour ' + jour);
    assert.ok(![parId[a.item].pays, b.paysTrio, b.paysIntrus].some((p) => c.pays.includes(p)));
  }
});

test('aucune curiosité ne revient deux fois dans un bloc de 14 jours', () => {
  for (let bloc = 0; bloc < 60; bloc++) {
    const vues = new Set();
    for (let jour = bloc * C.BLOC; jour < (bloc + 1) * C.BLOC; jour++) {
      const [a, b, c] = C.construireDefi(D, jour).epreuves;
      for (const id of [a.item, ...b.cartes, ...c.items]) {
        assert.ok(!vues.has(id), 'bloc ' + bloc + ', jour ' + jour + ' : ' + id);
        vues.add(id);
      }
    }
  }
});

test('en semaine rien de difficile, le week-end rien de facile, dans « L\'intruse » et « Les liens »', () => {
  const admis = { 1: [1, 2], 2: [1, 2], 3: [2, 3] };
  for (let jour = 0; jour < 800; jour++) {
    const defi = C.construireDefi(D, jour);
    const [mini, maxi] = admis[defi.niveau];
    for (const id of [...defi.epreuves[1].cartes, ...defi.epreuves[2].items]) {
      assert.ok(parId[id].niv >= mini && parId[id].niv <= maxi, 'jour ' + jour + ' (niveau ' + defi.niveau + ') : ' + id);
    }
  }
});

test('niveau du jour : facile lundi et mardi, moyen ensuite, difficile le week-end', () => {
  // Le 11/11/2026 (jour 0) est un mercredi.
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6].map(C.niveauDuJour), [2, 2, 2, 3, 3, 1, 1]);
  assert.strictEqual(C.estDimanche(4), true);
  assert.strictEqual(C.estDimanche(3), false);
});

test('la vedette ne se répète pas avant que son niveau soit épuisé', () => {
  for (const niv of [1, 2, 3]) {
    const taille = D.items.filter((i) => i.niv === niv).length;
    const vues = [];
    for (let jour = 0; vues.length < taille; jour++) {
      if (C.niveauDuJour(jour) === niv) vues.push(C.construireDefi(D, jour).epreuves[0].item);
    }
    assert.strictEqual(new Set(vues).size, taille, 'niveau ' + niv);
  }
});

test('à la jointure de deux cycles, les dernières vedettes ne reviennent pas tout de suite', () => {
  for (const niv of [1, 2, 3]) {
    const taille = D.items.filter((i) => i.niv === niv).length;
    const vues = [];
    for (let jour = 0; vues.length < taille + C.BLOC; jour++) {
      if (C.niveauDuJour(jour) === niv) vues.push(C.construireDefi(D, jour).epreuves[0].item);
    }
    const autour = vues.slice(taille - C.BLOC);
    assert.strictEqual(new Set(autour).size, autour.length, 'niveau ' + niv);
  }
});

test('vagues : des curiosités ajoutées n\'entrent dans les défis qu\'à leur date, sans changer les jours d\'avant', () => {
  const base = { pays: D.pays, items: D.items.filter((i) => !i.v), versions: [[0, 0]] };
  const jours = [0, 5, 13, 20, 27];
  const avant = jours.map((j) => C.construireDefi(base, j));
  const ajout = base.items.slice(0, 300).map((i) => Object.assign({}, i, { id: i.id + '-bis', v: 1 }));
  const avec = { pays: D.pays, items: base.items.concat(ajout), versions: [[0, 0], [28, 1]] };
  assert.deepStrictEqual(jours.map((j) => C.construireDefi(avec, j)), avant);
  assert.deepStrictEqual(C.questionRevision(avec, parId.sushi, 20), C.questionRevision(base, parId.sushi, 20));
  assert.strictEqual(C.versionDuJour(avec, 27), 0);
  assert.strictEqual(C.versionDuJour(avec, 28), 1);
  assert.strictEqual(C.versionDuJour(avec, 33), 1);
  let nouvelles = 0;
  for (let j = 28; j < 28 + 56; j++) {
    const [a, b, c] = C.construireDefi(avec, j).epreuves;
    nouvelles += [a.item, ...b.cartes, ...c.items].filter((id) => id.endsWith('-bis')).length;
  }
  assert.ok(nouvelles > 0, 'les nouvelles curiosités finissent par sortir');
  // Retour en arrière après être passé à la vague suivante : toujours les mêmes défis.
  assert.deepStrictEqual(C.construireDefi(avec, 13), avant[2]);
});

test('points', () => {
  assert.deepStrictEqual([1, 2, 3, 4].map((t) => C.pointsOrigine(t, true)), [100, 70, 40, 20]);
  assert.strictEqual(C.pointsOrigine(4, false), 0);
  assert.strictEqual(C.pointsParEssais(1, true), 100);
  assert.strictEqual(C.pointsParEssais(2, true), 50);
  assert.strictEqual(C.pointsParEssais(2, false), 0);
  assert.deepStrictEqual([0, 1, 2, 3, 4].map(C.pointsLiens), [0, 20, 45, 70, 100]);
});

test('série : jours consécutifs, joker après deux jours au moins et une fois par semaine', () => {
  const e = C.nouvelEtat();
  C.terminerJour(e, 0, [100, 100, 100]);
  assert.strictEqual(C.terminerJour(e, 2, [100, 100, 100]).joker, false); // un seul jour joué : pas de joker
  assert.strictEqual(e.serie, 1);
  C.terminerJour(e, 3, [100, 0, 20]);
  assert.strictEqual(e.serie, 2);
  assert.strictEqual(e.jours[3].total, 120);
  assert.strictEqual(C.terminerJour(e, 3, [0, 0, 0]).dejaFait, true); // on ne rejoue pas un jour
  assert.strictEqual(e.jours[3].total, 120);
  assert.strictEqual(C.serieActuelle(e, 5), 2); // joker encore disponible
  assert.strictEqual(C.terminerJour(e, 5, [100, 100, 100]).joker, true); // jour 4 manqué, pardonné
  assert.strictEqual(e.serie, 3);
  assert.strictEqual(C.jokerDisponible(e, 6), false);
  assert.strictEqual(C.terminerJour(e, 7, [100, 100, 100]).joker, false); // second oubli la même semaine
  assert.strictEqual(e.serie, 1);
  assert.strictEqual(e.meilleureSerie, 3);
  assert.strictEqual(C.serieActuelle(e, 8), 1);
  assert.strictEqual(C.serieActuelle(e, 11), 0);
});

test('un jour antérieur au dernier jour joué ne casse pas la série', () => {
  const e = C.nouvelEtat();
  C.terminerJour(e, 10, [100, 100, 100]);
  C.terminerJour(e, 11, [100, 100, 100]);
  C.terminerJour(e, 5, [100, 100, 100]);
  assert.strictEqual(e.serie, 2);
  assert.strictEqual(e.dernierJour, 11);
  assert.ok(e.jours[5]);
});

test('révision : une curiosité ratée revient à 1, 3 puis 7 jours, puis sort de la liste', () => {
  const e = C.nouvelEtat();
  C.noterReponse(e, 'sushi', 'JP', false, 10);
  assert.deepStrictEqual(C.aRevoir(e, 10), []);
  assert.deepStrictEqual(C.aRevoir(e, 11), ['sushi']);
  C.noterReponse(e, 'sushi', 'JP', true, 11);
  assert.strictEqual(e.revision.sushi.le, 14);
  C.noterReponse(e, 'sushi', 'JP', true, 14);
  assert.strictEqual(e.revision.sushi.le, 21);
  C.noterReponse(e, 'sushi', 'JP', true, 21);
  assert.strictEqual(e.revision.sushi, undefined);
  assert.deepStrictEqual(e.atlas.JP, { vu: 4, ok: 3, d: ['sushi'] });
  assert.strictEqual(e.album.sushi, 10); // entrée dans l'album à la première rencontre
  C.noterReponse(e, 'kimchi', 'KR', true, 21);
  assert.strictEqual(e.revision.kimchi, undefined);
  for (let n = 0; n < 8; n++) C.noterReponse(e, 'x' + n, 'FR', false, 30);
  assert.strictEqual(C.aRevoir(e, 31).length, 5);
  assert.strictEqual(C.toutesARevoir(e, 31).length, 8);
});

test('question de révision : mêmes choix si on recharge la page le même jour', () => {
  const q = C.questionRevision(D, parId.sushi, 4);
  assert.deepStrictEqual(q, C.questionRevision(D, parId.sushi, 4));
  assert.ok(q.options.includes('JP') && new Set(q.options).size === 4);
});

test('niveaux de l’atlas', () => {
  assert.strictEqual(C.niveau(undefined), 0);
  assert.strictEqual(C.niveau({ vu: 3, ok: 0 }), 0);
  assert.strictEqual(C.niveau({ vu: 1, ok: 1 }), 1);
  assert.strictEqual(C.niveau({ vu: 5, ok: 3, d: ['a', 'b'] }), 2);
  assert.strictEqual(C.niveau({ vu: 5, ok: 3, d: ['a'] }), 1); // toujours la même curiosité : pas encore connu
  assert.strictEqual(C.niveau({ vu: 5, ok: 3 }), 1); // ancienne sauvegarde, sans le détail
  assert.strictEqual(C.niveau({ vu: 12, ok: 6, d: ['a', 'b', 'c'] }), 2); // trop d'erreurs pour être maîtrisé
  assert.strictEqual(C.niveau({ vu: 7, ok: 6, d: ['a', 'b'] }), 2); // pas assez de curiosités différentes
  assert.strictEqual(C.niveau({ vu: 7, ok: 6, d: ['a', 'b', 'c'] }), 3);
});

test('statistiques et anciens défis', () => {
  const e = C.nouvelEtat();
  assert.deepStrictEqual(C.statistiques(e), { parties: 0, moyenne: 0, moyenne7: 0, meilleur: 0, repartition: [0, 0, 0, 0] });
  C.terminerJour(e, 0, [100, 100, 100]);
  C.terminerJour(e, 1, [20, 0, 45]);
  C.terminerJour(e, 4, [100, 50, 70]);
  assert.deepStrictEqual(C.statistiques(e), { parties: 3, moyenne: 195, moyenne7: 195, meilleur: 300, repartition: [1, 0, 1, 1] });
  assert.deepStrictEqual(C.joursRejouables(e, 5, 7), [3, 2]);
  assert.deepStrictEqual(C.joursRejouables(e, 0, 7), []);
});

test('partage : une ligne par épreuve, sans réponse, dans la langue fournie', () => {
  assert.strictEqual(C.texteDePartage([100, 50, 0], { entete: 'Défi n° 5', epreuves: ['A', 'B', 'C'], serie: 'Série : 3 jours', invite: 'À vous' }),
    'Défi n° 5\n🟩 A 100\n⬛🟩 B 50\n⬛⬛⬛⬛ C 0\nSérie : 3 jours\nÀ vous');
  assert.strictEqual(C.texteDePartage([0, 0, 20], { entete: 'X', epreuves: ['A', 'B', 'C'], serie: '', invite: 'Y' }),
    'X\n⬛⬛⬛⬛ A 0\n⬛⬛ B 0\n🟩⬛⬛⬛ C 20\nY');
  assert.strictEqual(C.carres([40, 100, 70]), '⬛⬛🟩 🟩 🟩🟩🟩⬛');
  assert.ok(!/🟥|🟨/u.test(C.carres([20, 50, 45])), 'ni rouge ni jaune');
  assert.strictEqual(C.dateDuDefi(4).toISOString().slice(0, 10), '2026-11-15');
});

test('sauvegarde : aller-retour, et refus des codes abîmés ou fabriqués', () => {
  const e = C.nouvelEtat();
  C.terminerJour(e, 0, [100, 100, 100]);
  C.noterReponse(e, 'sushi', 'JP', false, 0);
  assert.deepStrictEqual(C.decoderSauvegarde(C.coderSauvegarde(e, versB64), depuisB64), e);
  assert.strictEqual(C.decoderSauvegarde('n importe quoi', depuisB64), null);
  assert.strictEqual(C.decoderSauvegarde('GC1.pasdubase64', depuisB64), null);
  const fabrique = (modif) => C.decoderSauvegarde('GC1.' + versB64(JSON.stringify(Object.assign(JSON.parse(JSON.stringify(e)), modif))), depuisB64);
  assert.strictEqual(fabrique({ jours: null }), null);
  assert.strictEqual(fabrique({ atlas: null }), null);
  assert.strictEqual(fabrique({ revision: null }), null);
  assert.strictEqual(fabrique({ serie: 'abc' }), null);
  assert.strictEqual(fabrique({ serie: 9999, meilleureSerie: 9999 }), null);
  assert.strictEqual(fabrique({ atlas: { JP: { vu: 1, ok: 5 } } }), null);
  const ancien = JSON.parse(JSON.stringify(e)); delete ancien.album; // état d'avant l'album
  assert.deepStrictEqual(C.etatValide(ancien).album, {});
});

test('calendrier : le 11/11/2026 est le défi n° 1', () => {
  assert.strictEqual(C.numeroDuJour(C.indexDuJour(new Date(2026, 10, 11, 23, 59))), 1);
  assert.strictEqual(C.numeroDuJour(C.indexDuJour(new Date(2026, 10, 12, 0, 1))), 2);
  assert.strictEqual(C.secondesAvantDemain(new Date(2026, 10, 10, 23, 59, 0)), 60);
});

console.log(nb + ' tests réussis');
