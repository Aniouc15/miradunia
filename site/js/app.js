/* Affichage du jeu. Les règles sont dans core.js, les curiosités dans data/data.js,
   les textes de la langue choisie dans lang/<code>.js (chargé par demarrage.js). */
(function () {
  'use strict';
  var C = window.GCCore, D = window.GC_DATA, L = window.GC_LANGUE;
  var PAGE = window.GC_PAGE || { langue: null, racine: '' };
  var RACINE = PAGE.racine || '';
  var UI = L.ui;
  var LANGUE = L.code;
  var LOCALE = L.locale || L.code; // pour les dates, les pluriels et l'ordre alphabétique
  var MARQUE = D.marque;
  var app = document.getElementById('app');
  var ITEMS = {};
  // Les textes de la langue (nom, phrase, lien) rejoignent les données neutres de chaque curiosité.
  D.items.forEach(function (i) {
    var textes = L.items[i.id] || [i.id, '', ''];
    i.nom = textes[0]; i.fait = textes[1]; i.lien = textes[2];
    ITEMS[i.id] = i;
  });
  var CLE = 'globecurios_etat_v1';
  var CLE_COPIE = 'globecurios_code_copie';
  var CLE_LANGUE = 'globecurios_langue';
  var CATEGORIES = ['monument', 'lieu', 'plat', 'boisson', 'fête', 'tradition', 'instrument', 'objet'];

  // ---------- Textes ----------
  var REGLES_PLURIEL;
  try { REGLES_PLURIEL = new Intl.PluralRules(LOCALE); } catch (e) { REGLES_PLURIEL = { select: function (n) { return n === 1 ? 'one' : 'other'; } }; }
  var NOMBRES;
  try { NOMBRES = new Intl.NumberFormat(LOCALE); } catch (e) { NOMBRES = { format: String }; }
  // Texte de l'interface. Une entrée peut avoir plusieurs formes selon le nombre {n} (one, few, many, other…).
  // Les nombres sont écrits à la façon de la langue (1 414, 1,414…).
  function t(cle, params) {
    var v = UI[cle];
    if (v === undefined) return cle;
    if (typeof v === 'object') {
      var forme = v[REGLES_PLURIEL.select(params && typeof params.n === 'number' ? params.n : 0)];
      v = forme === undefined ? v.other : forme;
    }
    return String(v).replace(/\{(\w+)\}/g, function (tout, nom) {
      var valeur = params ? params[nom] : undefined;
      if (typeof valeur === 'number') return NOMBRES.format(valeur);
      return valeur === undefined || valeur === null || typeof valeur === 'object' ? tout : valeur;
    });
  }
  // Même texte, avec <b>gras</b>, <a>lien</a> et éléments insérés ({nom} dont la valeur est un élément).
  function riche(cle, params, lien) {
    var noeuds = [];
    t(cle, params).split(/(<b>[\s\S]*?<\/b>|<a>[\s\S]*?<\/a>|\{\w+\})/).forEach(function (bout) {
      var m;
      if (!bout) return;
      if ((m = /^<b>([\s\S]*)<\/b>$/.exec(bout))) noeuds.push(h('b', {}, m[1]));
      else if ((m = /^<a>([\s\S]*)<\/a>$/.exec(bout))) noeuds.push(lien ? h('a', lien, m[1]) : m[1]);
      else if ((m = /^\{(\w+)\}$/.exec(bout)) && params && params[m[1]] && typeof params[m[1]] === 'object') noeuds.push(params[m[1]]);
      else noeuds.push(bout);
    });
    return noeuds;
  }
  function pays(code) { return L.pays[code] || code; }
  function continent(code) { return D.pays[code].continent; }
  function nomContinent(cle) { return t('continent.' + cle); }
  function categorie(item) { return t('categorie.' + item.cat); }
  function parNom(a, b) { return a.localeCompare(b, LOCALE); }
  function points(n) { return t('commun.points', { n: n }); }

  // Ancien défi : « ?essai=12 » rejoue le défi n° 12 hors série, sans rien enregistrer.
  // Le défi du jour et les suivants ne s'ouvrent ainsi que sur le poste du développeur.
  var parametre = new URLSearchParams(location.search).get('essai');
  var surPosteLocal = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var ESSAI = parametre !== null && /^\d{1,6}$/.test(parametre) ? parseInt(parametre, 10) - 1 : null;
  if (ESSAI !== null && (ESSAI < 0 || (ESSAI >= C.indexDuJour() && !surPosteLocal))) ESSAI = null;
  var JOUR = ESSAI !== null ? ESSAI : C.indexDuJour();
  var etat = charger();
  var vue = 'accueil';
  var minuteur = null;
  var messageJoker = false;
  var resultatDe = null; // jour dont on vient de finir le défi (utile si minuit est passé entre-temps)

  // ---------- Outils ----------
  function h(balise, attributs) {
    var el = document.createElement(balise);
    Object.keys(attributs || {}).forEach(function (cle) {
      var v = attributs[cle];
      if (v === null || v === undefined || v === false) return;
      if (cle === 'class') el.className = v;
      else if (cle.indexOf('on') === 0) el.addEventListener(cle.slice(2), v);
      else if (v === true) el.setAttribute(cle, '');
      else el.setAttribute(cle, v);
    });
    for (var i = 2; i < arguments.length; i++) ajouter(el, arguments[i]);
    return el;
  }
  function ajouter(el, enfant) {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (Array.isArray(enfant)) enfant.forEach(function (e) { ajouter(el, e); });
    else el.appendChild(typeof enfant === 'object' ? enfant : document.createTextNode(String(enfant)));
  }
  function remplacer(el) {
    el.replaceChildren();
    for (var i = 1; i < arguments.length; i++) ajouter(el, arguments[i]);
  }
  function lire(cle) { try { return localStorage.getItem(cle); } catch (e) { return null; } }
  function ecrire(cle, valeur) { try { localStorage.setItem(cle, valeur); } catch (e) { /* stockage indisponible */ } }
  function charger() {
    if (ESSAI !== null) return C.nouvelEtat();
    try {
      var lu = C.etatValide(JSON.parse(lire(CLE)));
      if (lu) return lu;
    } catch (e) { /* stockage illisible : on joue quand même, sans mémoire */ }
    return C.nouvelEtat();
  }
  function sauver() {
    if (ESSAI === null) ecrire(CLE, JSON.stringify(etat));
  }
  function versBase64(texte) { return btoa(unescape(encodeURIComponent(texte))); }
  function depuisBase64(texte) { return decodeURIComponent(escape(atob(texte))); }
  function duree(secondes) {
    function deux(n) { return (n < 10 ? '0' : '') + n; }
    return deux(Math.floor(secondes / 3600)) + ':' + deux(Math.floor(secondes / 60) % 60) + ':' + deux(secondes % 60);
  }
  function dateDuJour() {
    return new Date().toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function dateDuDefi(jour) {
    var texte = C.dateDuDefi(jour).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', timeZone: 'UTC' });
    return LANGUE === 'fr' ? texte.replace(/^1 /, '1er ') : texte;
  }
  function bouton(texte, action, classe) {
    return h('button', { type: 'button', class: 'bouton' + (classe ? ' ' + classe : ''), onclick: action }, texte);
  }
  function image(item) { return RACINE + item.img; }
  function photo(item, rapprochee) {
    return h('figure', { class: 'photo' + (rapprochee ? ' zoom' : '') },
      h('img', { src: image(item), alt: rapprochee ? t('commun.detail_alt') : item.nom, width: 560, height: 420 }));
  }
  function auteur(item) {
    return item.credit.depot ? t('credit.compte', { nom: item.credit.auteur }) : item.credit.auteur;
  }
  function credit(item) {
    return h('p', { class: 'credit' }, riche('credit.photo', { auteur: auteur(item), licence: item.credit.licence },
      { href: item.credit.page, target: '_blank', rel: 'noopener' }));
  }
  // Lien « Signaler une erreur » : affiché seulement si une adresse de contact est réglée.
  function signaler(item) {
    if (!D.contact) return null;
    var sujet = item ? t('signaler.sujet_fiche', { marque: MARQUE, nom: item.nom, id: item.id }) : t('signaler.sujet', { marque: MARQUE });
    return h('a', { href: 'mailto:' + D.contact + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(t('signaler.corps')) },
      t('signaler.lien'));
  }
  function savoir(item) {
    var lien = signaler(item);
    return [h('p', { class: 'fait' }, item.fait),
      h('p', { class: 'petit' }, h('a', { href: item.lien, target: '_blank', rel: 'noopener' }, t('commun.savoir_plus')),
        lien ? ' · ' : null, lien),
      credit(item)];
  }
  function texteDuPartage(jour, scores, serie) {
    var total = scores.reduce(function (a, b) { return a + b; }, 0);
    return C.texteDePartage(scores, {
      entete: t('partage.entete', { marque: MARQUE, n: C.numeroDuJour(jour), date: dateDuDefi(jour), total: total }),
      epreuves: [t('origine.nom'), t('intrus.nom'), t('liens.nom')],
      serie: serie > 1 ? t('partage.serie', { n: serie }) : '',
      invite: t('partage.invite', { adresse: D.adresse })
    });
  }
  function resultatEnMots(scores) {
    return scores.map(function (s, n) {
      return t(s >= 100 ? 'resultat.epreuve_reussie' : s > 0 ? 'resultat.epreuve_partielle' : 'resultat.epreuve_manquee', { n: n + 1 });
    }).join(', ');
  }
  function partager(texte, source, copieSeule) {
    function copie() { source.textContent = t('resultat.copie'); }
    function secours() {
      if (source.nextSibling && source.nextSibling.tagName === 'TEXTAREA') return;
      var zone = h('textarea', { rows: 6, readonly: true, 'aria-label': t('resultat.zone') }, texte);
      source.parentNode.insertBefore(zone, source.nextSibling);
      zone.focus(); zone.select();
    }
    function presse() {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(copie, secours);
      else secours();
    }
    // La feuille de partage du système n'est utile que sur téléphone ; ailleurs on copie.
    if (navigator.share && estTactile() && !copieSeule) {
      navigator.share({ text: texte }).catch(function (e) { if (!e || e.name !== 'AbortError') presse(); });
    } else presse();
  }
  function estTactile() { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); }

  // ---------- Navigation ----------
  function partieEnCours() {
    return !!(etat.enCours && etat.enCours.jour === JOUR && !etat.jours[JOUR] &&
      (etat.enCours.index > 0 || etat.enCours.partiel));
  }
  function afficher(nouvelle) {
    if (nouvelle) vue = nouvelle;
    clearInterval(minuteur);
    if (ESSAI === null) {
      var maintenant = C.indexDuJour();
      // Minuit est passé : on laisse finir le défi commencé, sinon on passe au nouveau jour.
      if (maintenant !== JOUR && !(vue === 'jeu' && partieEnCours())) JOUR = maintenant;
    }
    if (etat.enCours && etat.enCours.jour !== JOUR) etat.enCours = null;
    var contenu = { accueil: vueAccueil, jeu: vueJeu, atlas: vueAtlas, album: vueAlbum, revision: vueRevision, regles: vueRegles }[vue]();
    remplacer(app, contenu);
    document.querySelectorAll('.barre button').forEach(function (b) {
      var actif = b.getAttribute('data-vue') === (vue === 'jeu' ? 'accueil' : vue);
      if (actif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    majEntete();
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }
  function majEntete() {
    var serie = C.serieActuelle(etat, JOUR);
    document.getElementById('serie-entete').textContent = serie > 0 ? t('entete.serie', { n: serie }) : '';
    var nb = C.toutesARevoir(etat, JOUR).length;
    var pastille = document.getElementById('pastille-revision');
    pastille.hidden = nb === 0;
    pastille.textContent = nb;
    pastille.setAttribute('aria-label', t('nav.a_revoir', { n: nb }));
  }
  // Textes fixes de la page (menu, entête) : écrits ici pour que la même page serve toutes les langues.
  function habiller() {
    document.documentElement.lang = LANGUE;
    document.documentElement.dir = L.dir || 'ltr';
    document.title = t('meta.titre', { marque: MARQUE });
    document.querySelectorAll('.barre button').forEach(function (b) {
      b.querySelector('.libelle').textContent = t('nav.' + b.getAttribute('data-vue'));
    });
    document.querySelector('.barre').setAttribute('aria-label', t('nav.label'));
    document.querySelector('.marque').setAttribute('aria-label', t('entete.accueil', { marque: MARQUE }));
    document.querySelector('.marque span').textContent = MARQUE;
    document.getElementById('serie-entete').title = t('entete.serie_titre');
  }
  document.addEventListener('click', function (e) {
    var cible = e.target.closest('[data-vue]');
    if (!cible) return;
    e.preventDefault();
    afficher(cible.getAttribute('data-vue'));
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && ESSAI === null && C.indexDuJour() !== JOUR && vue !== 'jeu') afficher();
  });

  // ---------- Accueil ----------
  function carteResultat(jour, avecCompte) {
    var fait = etat.jours[jour];
    var serie = C.serieActuelle(etat, JOUR);
    var compte = h('span', { class: 'compte' }, duree(C.secondesAvantDemain()));
    if (avecCompte) {
      minuteur = setInterval(function () {
        var reste = C.secondesAvantDemain();
        compte.textContent = duree(reste);
        if (reste <= 0 || C.indexDuJour() !== JOUR) afficher();
      }, 1000);
    }
    var bPartage = bouton(t('resultat.partager'), function () {
      partager(texteDuPartage(jour, fait.scores, serie), bPartage);
    });
    // Sur téléphone, « Partager » ouvre la feuille du système : on propose aussi la simple copie.
    var bCopie = navigator.share && estTactile() ? bouton(t('resultat.copier'), function () {
      partager(texteDuPartage(jour, fait.scores, serie), bCopie, true);
    }, 'secondaire') : null;
    // Ce que la partie a apporté : les curiosités entrées dans l'album ce jour-là.
    var nouvelles = Object.keys(etat.album).filter(function (id) { return etat.album[id] === jour; }).length;
    var decouverte = ESSAI !== null ? null : h('p', { class: 'petit' },
      (fait.total === 300 ? t('resultat.sans_faute') + ' ' : '') +
      (nouvelles > 0 ? t('resultat.nouvelles', { n: nouvelles }) : t('resultat.aucune_nouvelle')));
    return h('section', { class: 'carte centre' },
      h('span', { class: 'etiquette' }, t('defi.numero', { n: C.numeroDuJour(jour) }) + (ESSAI !== null ? ' · ' + t('defi.hors_serie') : '')),
      h('p', { class: 'score' }, fait.total + ' / 300'),
      h('p', { class: 'carres', role: 'img', 'aria-label': t('resultat.aria', { detail: resultatEnMots(fait.scores) }) }, C.carres(fait.scores)),
      messageJoker ? h('p', { class: 'petit' }, t('resultat.joker')) : null,
      decouverte, bPartage, bCopie,
      avecCompte ? h('p', { class: 'doux', style: 'margin:14px 0 0' }, riche('resultat.prochain', { duree: compte })) : null);
  }
  function vueAccueil() {
    var fait = etat.jours[JOUR];
    var bilan = C.bilanAtlas(etat, D);
    var serie = C.serieActuelle(etat, JOUR);
    var niveau = C.niveauDuJour(JOUR);
    var blocs = [];
    if (resultatDe !== null && resultatDe !== JOUR && etat.jours[resultatDe]) {
      blocs.push(carteResultat(resultatDe, false), h('p', { class: 'petit doux centre' }, t('accueil.minuit')));
    }
    if (fait) {
      blocs.push(carteResultat(JOUR, ESSAI === null));
      var nb = C.toutesARevoir(etat, JOUR).length;
      if (nb > 0) {
        blocs.push(h('section', { class: 'carte' }, h('h2', {}, t('nav.a_revoir', { n: nb })),
          h('p', { class: 'doux' }, t('accueil.a_revoir_texte')),
          bouton(t('accueil.reviser'), function () { afficher('revision'); }, 'secondaire')));
      }
    } else {
      blocs.push(h('section', { class: 'carte' },
        h('span', { class: 'etiquette' }, [t('defi.numero', { n: C.numeroDuJour(JOUR) }), ESSAI === null ? dateDuJour() : t('defi.hors_serie'),
          t('defi.niveau', { niveau: t('niveau.' + niveau) })].join(' · ')),
        h('h1', {}, t(C.estDimanche(JOUR) ? 'accueil.titre_dimanche' : 'accueil.titre')),
        h('p', { class: 'doux' }, t('accueil.texte')),
        bouton(t(partieEnCours() ? 'accueil.reprendre' : 'accueil.jouer'), function () { afficher('jeu'); })));
    }
    if (ESSAI !== null) return blocs;

    blocs.push(h('div', { class: 'chiffres' },
      h('div', {}, h('b', {}, serie), h('span', {}, t('chiffres.serie', { n: serie }))),
      h('div', {}, h('b', {}, etat.meilleureSerie), h('span', {}, t('chiffres.record'))),
      h('div', {}, h('b', {}, bilan.decouverts + '/' + bilan.total), h('span', {}, t('chiffres.pays')))));
    if (serie >= 2) {
      var attente = etat.jokerLe === null ? 0 : Math.max(0, 7 - (JOUR - etat.jokerLe));
      blocs.push(h('p', { class: 'petit doux centre' }, attente === 0 ? t('joker.disponible') : t('joker.utilise', { n: attente })));
    }
    var stats = C.statistiques(etat);
    if (stats.parties > 0) {
      var maxi = Math.max.apply(null, stats.repartition) || 1;
      var resume = [t('stats.parties', { n: stats.parties }), t('stats.moyenne', { n: stats.moyenne }), t('stats.meilleur', { n: stats.meilleur })];
      if (stats.parties > 7) resume.push(t('stats.moyenne7', { n: stats.moyenne7 }));
      blocs.push(h('section', { class: 'carte' }, h('h2', {}, t('stats.titre')),
        h('p', {}, resume.join(' · ')),
        h('div', { class: 'barres' }, stats.repartition.map(function (n, k) {
          return h('div', { class: 'barre-ligne' }, h('span', {}, t('stats.tranche.' + k)),
            h('i', { style: 'width:' + Math.max(4, Math.round(100 * n / maxi)) + '%' + (n === 0 ? ';opacity:.25' : '') }), h('b', {}, n));
        }))));
    }
    var anciens = C.joursRejouables(etat, JOUR, 7);
    if (fait && anciens.length > 0) {
      blocs.push(h('section', { class: 'carte' }, h('h2', {}, t('manques.titre')),
        h('p', { class: 'doux' }, t('manques.texte')),
        h('div', { class: 'anciens' }, anciens.map(function (j) {
          return h('a', { class: 'puce', href: '?essai=' + C.numeroDuJour(j) }, t('manques.numero', { n: C.numeroDuJour(j) }));
        }))));
    }
    if (stats.parties >= 7 && lire(CLE_COPIE) !== '1') {
      blocs.push(h('p', { class: 'petit doux centre' }, riche('sauvegarde.rappel', null, { href: '#', 'data-vue': 'regles' })));
    }
    if (!fait && stats.parties === 0) {
      // Première visite un jour difficile : on propose d'abord un ancien défi facile, hors série.
      var facile = null;
      for (var j = JOUR - 1; j >= 0 && facile === null; j--) if (C.niveauDuJour(j) === 1) facile = j;
      if (niveau > 1 && facile !== null) {
        blocs.push(h('p', { class: 'petit centre' }, riche('accueil.premiere_visite', null, { href: '?essai=' + C.numeroDuJour(facile) })));
      }
      blocs.push(h('p', { class: 'petit doux centre' }, t('accueil.gratuit')));
    }
    return blocs;
  }

  // ---------- Défi du jour ----------
  function vueJeu() {
    if (etat.jours[JOUR]) { vue = 'accueil'; return vueAccueil(); }
    var defi = C.construireDefi(D, JOUR);
    var enCours = etat.enCours && etat.enCours.jour === JOUR ? etat.enCours : { jour: JOUR, index: 0, scores: [], partiel: null };
    var index = enCours.index;
    var epreuve = defi.epreuves[index];
    var etapes = h('div', { class: 'etapes', role: 'img', 'aria-label': t('jeu.etape', { n: index + 1 }) },
      [0, 1, 2].map(function (n) { return h('i', { class: n < index ? 'passee' : n === index ? 'ici' : '' }); }));

    // Mémorise un essai manqué : recharger la page ne rend pas les essais.
    function memoriser(partiel) {
      enCours.partiel = partiel;
      etat.enCours = enCours;
      sauver();
    }
    // Appelé dès que l'épreuve est tranchée : le score est enregistré tout de suite, on ne peut pas la rejouer.
    function valider(score) {
      var jourJoue = JOUR;
      enCours.scores.push(score);
      enCours.index += 1;
      enCours.partiel = null;
      etat.enCours = enCours;
      var termine = enCours.index >= 3;
      if (termine) messageJoker = C.terminerJour(etat, jourJoue, enCours.scores).joker;
      sauver();
      majEntete();
      return bouton(t(termine ? 'jeu.voir_resultat' : 'jeu.suivante'), function () {
        if (termine) resultatDe = jourJoue;
        afficher(termine ? 'accueil' : 'jeu');
      });
    }
    var corps = epreuve.type === 'origine' ? epreuveOrigine(epreuve, enCours.partiel, memoriser, valider)
      : epreuve.type === 'intrus' ? epreuveIntrus(epreuve, enCours.partiel, memoriser, valider)
        : epreuveLiens(epreuve, valider);
    return [etapes, corps];
  }

  // Épreuve 1 : quatre indices, de la photo rapprochée aux quatre pays proposés.
  function epreuveOrigine(epreuve, partiel, memoriser, conclure) {
    var item = ITEMS[epreuve.item];
    var tentatives = partiel && Array.isArray(partiel.t) ? partiel.t.slice() : []; // code de pays, ou null si indice demandé
    var cadre = h('section', { class: 'carte' });

    function historique() {
      if (!tentatives.length) return null;
      return h('ul', { class: 'essais' }, tentatives.map(function (code) {
        if (code === null) return h('li', {}, t('origine.indice_demande'));
        return h('li', {}, riche(continent(code) === continent(item.pays) ? 'origine.essai_bon_continent' : 'origine.essai_autre_continent',
          { pays: pays(code) }));
      }));
    }
    function proposer(code) {
      if (code === item.pays) { finir(true); return; }
      tentatives.push(code);
      if (tentatives.length >= 4) { finir(false); return; }
      memoriser({ t: tentatives });
      dessiner();
      cadre.focus({ preventScroll: true });
    }
    function finir(reussi) {
      var numero = tentatives.length + (reussi ? 1 : 0);
      var score = C.pointsOrigine(numero, reussi);
      // L'atlas ne retient que les curiosités reconnues à la photo, avant que le nom soit donné.
      C.noterReponse(etat, item.id, item.pays, reussi && numero <= 2, JOUR);
      var texte = t(reussi ? 'origine.trouve.' + numero : 'origine.rate', { pays: pays(item.pays) });
      remplacer(cadre, h('span', { class: 'etiquette' }, t('origine.nom') + ' · ' + categorie(item)),
        photo(item), h('p', { class: 'nom' }, item.nom), historique(),
        h('p', { class: 'verdict ' + (reussi ? (numero === 1 ? 'bon' : 'moyen') : 'mauvais') }, texte + ' ' + points(score)),
        savoir(item), conclure(score));
    }
    function dessiner() {
      var etape = tentatives.length;
      var essayes = tentatives.filter(function (c) { return c !== null; });
      var saisie;
      if (etape < 3) {
        var groupes = {};
        Object.keys(D.pays).forEach(function (code) {
          if (essayes.indexOf(code) < 0) (groupes[continent(code)] = groupes[continent(code)] || []).push(code);
        });
        var liste = h('select', { 'aria-label': t('origine.select_label') }, h('option', { value: '' }, t('origine.choisir')),
          Object.keys(groupes).sort(function (a, b) { return parNom(nomContinent(a), nomContinent(b)); }).map(function (cle) {
            return h('optgroup', { label: nomContinent(cle) }, groupes[cle].sort(function (a, b) { return parNom(pays(a), pays(b)); })
              .map(function (code) { return h('option', { value: code }, pays(code)); }));
          }));
        var bValider = bouton(t('commun.valider'), function () { if (liste.value) proposer(liste.value); });
        bValider.disabled = true;
        liste.addEventListener('change', function () { bValider.disabled = !liste.value; });
        saisie = [liste, bValider, bouton(t('origine.indice_suivant'), function () { proposer(null); }, 'secondaire')];
      } else {
        saisie = h('div', { class: 'choix' }, epreuve.options.map(function (code) {
          var b = h('button', { type: 'button', onclick: function () { proposer(code); } }, pays(code));
          if (essayes.indexOf(code) >= 0) { b.disabled = true; b.classList.add('fausse'); }
          return b;
        }));
      }
      remplacer(cadre,
        h('span', { class: 'etiquette' }, t('origine.etiquette', { n: etape + 1, points: C.POINTS_ORIGINE[etape] })),
        photo(item, etape === 0),
        etape >= 2 ? h('p', { class: 'nom' }, item.nom, h('span', { class: 'categorie' }, ' · ' + categorie(item))) : null,
        h('p', { class: 'consigne' }, t('origine.consigne')),
        h('p', { class: 'petit doux', 'aria-live': 'polite' }, t('origine.indice.' + (etape + 1))),
        historique(), saisie);
    }
    cadre.setAttribute('tabindex', '-1');
    dessiner();
    return cadre;
  }

  // Question simple à quatre choix, un seul essai : sert à la révision.
  function questionSimple(question, noter, suivant) {
    var item = ITEMS[question.item];
    var fini = false;
    var suite = h('div', { 'aria-live': 'polite' });
    var boutons = question.options.map(function (code) {
      var b = h('button', { type: 'button', onclick: function () {
        if (fini) return;
        fini = true;
        var juste = code === item.pays;
        boutons.forEach(function (autre, n) {
          autre.disabled = true;
          if (question.options[n] === item.pays) autre.classList.add('juste');
        });
        if (!juste) b.classList.add('fausse');
        noter(juste);
        remplacer(suite, h('p', { class: 'verdict ' + (juste ? 'bon' : 'mauvais') },
          t(juste ? 'revision.exact' : 'origine.rate', { pays: pays(item.pays) })), savoir(item), suivant());
      } }, pays(code));
      return b;
    });
    return h('section', { class: 'carte' }, h('span', { class: 'etiquette' }, t('revision.titre') + ' · ' + categorie(item)),
      photo(item), h('p', { class: 'nom' }, item.nom),
      h('p', { class: 'consigne' }, t('origine.consigne')),
      h('div', { class: 'choix' }, boutons), suite);
  }

  // Épreuve 2 : trois curiosités d'un pays, une intruse.
  function epreuveIntrus(epreuve, partiel, memoriser, conclure) {
    var faux = partiel && Array.isArray(partiel.faux) ? partiel.faux.slice() : [];
    var fini = false;
    var suite = h('div', { 'aria-live': 'polite' });
    var encore = function () { return h('p', { class: 'verdict moyen' }, t('intrus.encore')); };
    var cartes = epreuve.cartes.map(function (id) {
      var item = ITEMS[id];
      var carte = h('button', { type: 'button', class: 'vignette', onclick: function () {
        if (fini || carte.disabled) return;
        var juste = id === epreuve.intrus;
        if (!juste) {
          faux.push(id);
          carte.classList.add('fausse');
          carte.disabled = true;
          if (faux.length < 2) { memoriser({ faux: faux }); remplacer(suite, encore()); return; }
        }
        fini = true;
        var essais = faux.length + (juste ? 1 : 0);
        cartes.forEach(function (autre, n) {
          var autreItem = ITEMS[epreuve.cartes[n]];
          autre.disabled = true;
          if (autreItem.id === epreuve.intrus) autre.classList.add('juste');
          autre.appendChild(h('small', {}, pays(autreItem.pays)));
        });
        C.noterReponse(etat, epreuve.intrus, epreuve.paysIntrus, juste && essais === 1, JOUR);
        var score = C.pointsParEssais(essais, juste);
        var intrus = ITEMS[epreuve.intrus];
        remplacer(suite,
          h('p', { class: 'verdict ' + (juste ? (essais === 1 ? 'bon' : 'moyen') : 'mauvais') },
            [t(juste ? (essais === 1 ? 'intrus.premier' : 'intrus.deuxieme') : 'intrus.manque'),
              t('intrus.explication', { nom: intrus.nom, pays: pays(epreuve.paysIntrus), trio: pays(epreuve.paysTrio) }),
              points(score)].join(' ')),
          savoir(intrus), conclure(score));
      } }, h('img', { src: image(item), alt: '', width: 280, height: 210 }), h('span', {}, item.nom));
      if (faux.indexOf(id) >= 0) { carte.classList.add('fausse'); carte.disabled = true; }
      return carte;
    });
    if (faux.length) remplacer(suite, encore());
    return h('section', { class: 'carte' },
      h('span', { class: 'etiquette' }, t('intrus.nom')),
      h('p', { class: 'consigne' }, t('intrus.consigne')),
      h('div', { class: 'grille' }, cartes), suite);
  }

  // Épreuve 3 : quatre curiosités, cinq pays, donc un pays en trop.
  function epreuveLiens(epreuve, conclure) {
    var choix = {};
    var actif = epreuve.items[0];
    var fini = false;
    var lignes = {};
    var puces = {};
    var suite = h('div', { 'aria-live': 'polite' });
    function rafraichir() {
      epreuve.items.forEach(function (id) {
        var ligne = lignes[id];
        ligne.bouton.classList.toggle('active', !fini && id === actif);
        ligne.bouton.setAttribute('aria-pressed', !fini && id === actif ? 'true' : 'false');
        if (fini) return; // après validation, la ligne affiche la correction
        ligne.attribue.textContent = choix[id] ? pays(choix[id]) : t('liens.a_choisir');
        ligne.attribue.classList.toggle('vide', !choix[id]);
      });
      epreuve.pays.forEach(function (code) {
        var prise = Object.keys(choix).some(function (id) { return choix[id] === code; });
        puces[code].classList.toggle('prise', prise);
      });
      bValider.disabled = Object.keys(choix).length < epreuve.items.length;
    }
    function attribuer(code) {
      if (fini) return;
      Object.keys(choix).forEach(function (id) { if (choix[id] === code) delete choix[id]; });
      choix[actif] = code;
      var libres = epreuve.items.filter(function (id) { return !choix[id]; });
      if (libres.length) actif = libres[0];
      rafraichir();
    }
    var bValider = bouton(t('commun.valider'), function () {
      if (fini) return;
      fini = true;
      var justes = 0;
      epreuve.items.forEach(function (id) {
        var item = ITEMS[id];
        var juste = choix[id] === item.pays;
        if (juste) justes += 1;
        C.noterReponse(etat, id, item.pays, juste, JOUR);
        var ligne = lignes[id];
        ligne.bouton.disabled = true;
        ligne.bouton.classList.add(juste ? 'juste' : 'fausse');
        ligne.attribue.textContent = juste ? t('liens.juste', { pays: pays(item.pays) })
          : t('liens.faux', { faux: pays(choix[id]), juste: pays(item.pays) });
      });
      epreuve.pays.forEach(function (code) { puces[code].disabled = true; });
      var score = C.pointsLiens(justes);
      bValider.remove();
      rafraichir();
      remplacer(suite,
        h('p', { class: 'verdict ' + (justes === 4 ? 'bon' : justes > 0 ? 'moyen' : 'mauvais') },
          [justes === 4 ? t('liens.tout_juste') : t('liens.partiel', { n: justes }),
            t('liens.en_trop', { pays: pays(epreuve.paysEnTrop) }), points(score)].join(' ')),
        epreuve.items.map(function (id) {
          return h('p', { class: 'fait petit' },
            h('b', {}, t('liens.titre_fait', { nom: ITEMS[id].nom, pays: pays(ITEMS[id].pays) }) + ' '), ITEMS[id].fait);
        }),
        h('p', { class: 'credit' }, t('liens.photos') + ' ', epreuve.items.map(function (id, n) {
          return [n ? ' · ' : '', h('a', { href: ITEMS[id].credit.page, target: '_blank', rel: 'noopener' },
            auteur(ITEMS[id]) + ' (' + ITEMS[id].credit.licence + ')')];
        })),
        conclure(score));
    });
    var rangs = epreuve.items.map(function (id) {
      var item = ITEMS[id];
      var attribue = h('span', { class: 'attribue vide' }, t('liens.a_choisir'));
      var b = h('button', { type: 'button', class: 'lien', 'aria-pressed': 'false', onclick: function () {
        if (fini) return;
        actif = id;
        rafraichir();
      } }, h('img', { src: image(item), alt: '', width: 72, height: 72 }), h('span', { class: 'lien-texte' }, h('b', {}, item.nom), attribue));
      lignes[id] = { bouton: b, attribue: attribue };
      return b;
    });
    var listePays = h('div', { class: 'puces', role: 'group', 'aria-label': t('liens.groupe') },
      epreuve.pays.map(function (code) {
        return (puces[code] = h('button', { type: 'button', class: 'puce', onclick: function () { attribuer(code); } }, pays(code)));
      }));
    rafraichir();
    return h('section', { class: 'carte' },
      h('span', { class: 'etiquette' }, t('liens.nom')),
      h('p', { class: 'consigne' }, t('liens.consigne')),
      rangs, h('p', { class: 'petit doux', style: 'margin:12px 0 6px' }, t('liens.aide')), listePays, bValider, suite);
  }

  // ---------- Atlas ----------
  function vueAtlas() {
    var bilan = C.bilanAtlas(etat, D);
    var continents = {};
    Object.keys(D.pays).forEach(function (code) { (continents[continent(code)] = continents[continent(code)] || []).push(code); });
    var blocs = [h('section', { class: 'carte' }, h('h1', {}, t('atlas.titre')),
      h('p', {}, t('atlas.bilan', bilan)),
      h('div', { class: 'jauge', role: 'img', 'aria-label': t('atlas.jauge', { n: bilan.decouverts, total: bilan.total }) },
        h('i', { style: 'width:' + Math.round(100 * bilan.decouverts / bilan.total) + '%' })),
      h('p', { class: 'petit doux' }, t('atlas.regle')))];
    Object.keys(continents).sort(function (a, b) { return parNom(nomContinent(a), nomContinent(b)); }).forEach(function (cle) {
      var codes = continents[cle].sort(function (a, b) { return parNom(pays(a), pays(b)); });
      blocs.push(h('section', { class: 'carte' }, h('h2', {}, nomContinent(cle)), codes.map(function (code) {
        var fiche = etat.atlas[code];
        var n = C.niveau(fiche);
        return h('div', { class: 'pays' },
          h('span', {}, h('b', {}, pays(code)), fiche ? h('span', { class: 'petit doux' }, '  ' + t('atlas.score', fiche)) : null),
          h('span', { class: 'niveau n' + n }, t('atlas.niveau.' + n)));
      })));
    });
    return blocs;
  }

  // ---------- Album ----------
  function vueAlbum() {
    var obtenues = D.items.filter(function (i) { return etat.album[i.id] !== undefined; }).length;
    var fiche = h('div', { 'aria-live': 'polite' });
    function ouvrir(item) {
      remplacer(fiche, h('section', { class: 'carte' }, h('span', { class: 'etiquette' }, categorie(item) + ' · ' + pays(item.pays)),
        photo(item), h('p', { class: 'nom' }, item.nom), savoir(item),
        bouton(t('album.fermer'), function () { remplacer(fiche); }, 'secondaire')));
      window.scrollTo(0, 0);
    }
    var blocs = [h('section', { class: 'carte' }, h('h1', {}, t('album.titre')),
      h('p', {}, t('album.bilan', { n: obtenues, total: D.items.length })),
      h('div', { class: 'jauge', role: 'img', 'aria-label': t('album.jauge', { n: obtenues, total: D.items.length }) },
        h('i', { style: 'width:' + Math.round(100 * obtenues / D.items.length) + '%' })),
      h('p', { class: 'petit doux' }, t('album.texte'))), fiche];
    CATEGORIES.forEach(function (cat) {
      var liste = D.items.filter(function (i) { return i.cat === cat; });
      if (!liste.length) return;
      var eues = liste.filter(function (i) { return etat.album[i.id] !== undefined; })
        .sort(function (a, b) { return parNom(a.nom, b.nom); });
      var manquantes = liste.length - eues.length;
      blocs.push(h('section', { class: 'carte' },
        h('h2', {}, t('album.categorie', { categorie: t('categories.' + cat), n: eues.length, total: liste.length })),
        h('div', { class: 'album' },
          eues.map(function (item) {
            return h('button', { type: 'button', class: 'case', onclick: function () { ouvrir(item); } },
              h('img', { src: image(item), alt: '', loading: 'lazy', width: 120, height: 90 }), h('span', {}, item.nom));
          }),
          manquantes > 0 ? h('div', { class: 'case vide' }, h('b', {}, '?'), h('span', {}, t('album.a_decouvrir', { n: manquantes }))) : null)));
    });
    return blocs;
  }

  // ---------- Révision ----------
  function vueRevision() {
    var toutes = C.toutesARevoir(etat, JOUR);
    var liste = C.aRevoir(etat, JOUR);
    var enAttente = Object.keys(etat.revision).length;
    if (liste.length === 0) {
      return [h('section', { class: 'carte' }, h('h1', {}, t('revision.titre')),
        h('p', {}, t('revision.rien')),
        h('p', { class: 'doux' }, enAttente > 0 ? t('revision.attente', { n: enAttente }) : t('revision.explication')),
        h('p', { class: 'petit doux' }, t('revision.note')))];
    }
    var position = 0;
    var justes = 0;
    var cadre = h('div', {});
    function suivante() {
      if (position >= liste.length) {
        majEntete();
        var reste = C.toutesARevoir(etat, JOUR).length;
        remplacer(cadre, h('section', { class: 'carte centre' }, h('h1', {}, t('revision.terminee')),
          h('p', {}, t(justes === liste.length ? 'revision.bilan_tout' : 'revision.bilan', { n: justes, total: liste.length })),
          reste > 0 ? bouton(t('revision.continuer', { n: reste }), function () { afficher('revision'); }) : null,
          bouton(t('revision.voir_atlas'), function () { afficher('atlas'); }, 'secondaire')));
        return;
      }
      var item = ITEMS[liste[position]];
      remplacer(cadre, h('p', { class: 'petit doux' }, t('revision.position', { n: position + 1, total: liste.length }) +
          (toutes.length > liste.length ? ' ' + t('revision.ensuite', { n: toutes.length - liste.length }) : '')),
        questionSimple(C.questionRevision(D, item, JOUR), function (juste) {
          if (juste) justes += 1;
          C.noterReponse(etat, item.id, item.pays, juste, JOUR);
          sauver();
        }, function () {
          position += 1;
          return bouton(t(position >= liste.length ? 'revision.terminer' : 'revision.suivante'), function () { suivante(); window.scrollTo(0, 0); });
        }));
    }
    suivante();
    return [cadre];
  }

  // ---------- Règles, langue, sauvegarde, crédits ----------
  function restaurer(lu) {
    // Ce qui a été joué aujourd'hui sur cet appareil est conservé : restaurer un code ne permet pas de rejouer.
    var duJour = etat.jours[JOUR];
    if (duJour && !lu.jours[JOUR]) C.terminerJour(lu, JOUR, duJour.scores);
    else if (!lu.jours[JOUR] && etat.enCours && etat.enCours.jour === JOUR) lu.enCours = etat.enCours;
    etat = lu;
    sauver();
  }
  // Une page par langue : « fr/ », « en/ »… Le choix est retenu pour la page d'accueil commune.
  function choixDeLangue() {
    var fichier = location.protocol === 'file:' ? 'index.html' : '';
    return h('section', { class: 'carte' }, h('h2', {}, t('langue.titre')),
      h('p', { class: 'doux' }, t('langue.texte')),
      h('div', { class: 'puces' }, (D.langues || []).map(function (langue) {
        return h('a', { class: 'puce' + (langue.code === LANGUE ? ' choisie' : ''), href: RACINE + langue.code + '/' + fichier,
          lang: langue.code, hreflang: langue.code, 'aria-current': langue.code === LANGUE ? 'true' : null,
          onclick: function () { ecrire(CLE_LANGUE, langue.code); } }, langue.nom);
      })));
  }
  function vueRegles() {
    var code = h('textarea', { rows: 3, readonly: true, dir: 'ltr', 'aria-label': t('sauvegarde.code') }, C.coderSauvegarde(etat, versBase64));
    var saisie = h('input', { type: 'text', dir: 'ltr', placeholder: t('sauvegarde.saisie'), 'aria-label': t('sauvegarde.saisie_label') });
    var retour = h('p', { class: 'petit', 'aria-live': 'polite' });
    var bCopier = bouton(t('sauvegarde.copier'), function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code.value).then(function () { bCopier.textContent = t('sauvegarde.copie'); ecrire(CLE_COPIE, '1'); },
          function () { code.select(); });
      } else code.select();
    }, 'secondaire');
    var credits = h('details', {}, h('summary', {}, t('sources.credits', { n: D.items.length })));
    credits.addEventListener('toggle', function () {
      if (!credits.open || credits.querySelector('ul')) return;
      credits.appendChild(h('ul', { class: 'credits-liste' }, D.items.map(function (item) {
        return h('li', {}, riche('sources.credit_ligne', { nom: item.nom, auteur: auteur(item), licence: item.credit.licence },
          { href: item.credit.page, target: '_blank', rel: 'noopener' }));
      })));
    });
    var erreur = signaler(null);
    return [
      h('section', { class: 'carte' }, h('h1', {}, t('regles.titre')),
        h('ul', { class: 'regles' }, ['jour', 'semaine', 'origine', 'intrus', 'liens', 'serie', 'rattachement'].map(function (cle) {
          return h('li', {}, riche('regles.' + cle));
        })),
        h('p', { class: 'petit doux' }, t('regles.couverture', { pays: Object.keys(D.pays).length, curiosites: D.items.length }),
          erreur ? ' ' : null, erreur)),
      (D.langues || []).length > 1 ? choixDeLangue() : null,
      h('section', { class: 'carte' }, h('h2', {}, t('sauvegarde.titre')),
        h('p', { class: 'doux' }, t('sauvegarde.texte')),
        code, bCopier,
        h('p', { style: 'margin-top:16px' }, saisie),
        bouton(t('sauvegarde.restaurer'), function () {
          var lu = C.decoderSauvegarde(saisie.value, depuisBase64);
          if (!lu) { retour.textContent = t('sauvegarde.invalide'); return; }
          if (!window.confirm(t('sauvegarde.confirmer'))) return;
          restaurer(lu);
          afficher('accueil');
        }, 'secondaire'), retour),
      h('section', { class: 'carte' }, h('h2', {}, t('sources.titre')),
        h('p', {}, t('sources.textes')),
        h('p', {}, t('sources.vie_privee')),
        credits)
    ];
  }

  habiller();
  if (ESSAI !== null) {
    document.body.insertBefore(h('div', { class: 'essai' }, riche('essai.bandeau', { n: ESSAI + 1 }, { href: location.pathname })),
      document.body.firstChild);
    document.querySelector('.barre').hidden = true;
  }
  afficher('accueil');
})();
