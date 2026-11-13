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
  D.items.forEach(function (i) { ITEMS[i.id] = i; });

  // ---------- Textes des curiosités, chargés à la demande ----------
  // Nom, phrase, lien et crédit photo sont rangés par paquets dans textes/<langue>/<n>.js : le jeu ne charge
  // que ceux des curiosités à afficher. Un paquet appelle GC_PAQUET en arrivant.
  var paquetsCharges = {}, paquetsAttendus = {};
  window.GC_PAQUET = function (code, n, contenu) {
    if (code !== L.code) return;
    Object.keys(contenu).forEach(function (id) {
      var x = contenu[id], i = ITEMS[id];
      if (!i) return;
      i.nom = x[0]; i.fait = x[1]; i.lien = x[2];
      i.credit = { auteur: x[3], licence: x[4], page: x[5], depot: !!x[6] };
    });
    paquetsCharges[n] = true;
  };
  function chargerPaquet(n, fini) {
    if (paquetsCharges[n]) { fini(false); return; }
    if (paquetsAttendus[n]) { paquetsAttendus[n].push(fini); return; }
    paquetsAttendus[n] = [fini];
    var script = document.createElement('script');
    var terminer = function () {
      var attente = paquetsAttendus[n] || [];
      delete paquetsAttendus[n]; // en cas d'échec, un prochain affichage réessaiera
      script.remove();
      attente.forEach(function (f) { f(!paquetsCharges[n]); });
    };
    script.onload = terminer;
    script.onerror = terminer;
    script.src = (window.GC_PAGE && window.GC_PAGE.racine || '') + 'textes/' + L.code + '/' + n + '.js';
    document.head.appendChild(script);
  }
  // Appelle fini(erreur) quand les textes de toutes ces curiosités sont là (tout de suite s'ils y sont déjà).
  function textes(ids, fini) {
    var besoins = {};
    ids.forEach(function (id) { if (ITEMS[id] && ITEMS[id].nom === undefined) besoins[C.paquetDe(id, D.paquets)] = true; });
    var liste = Object.keys(besoins), reste = liste.length, erreur = false;
    if (!reste) { fini(false); return; }
    liste.forEach(function (n) {
      chargerPaquet(Number(n), function (echec) { if (echec) erreur = true; if (--reste === 0) fini(erreur); });
    });
  }
  function idsDuDefi(defi) {
    var e = defi.epreuves;
    return [e[0].item].concat(e[1].cartes, e[2].items);
  }
  var CLE = 'globecurios_etat_v1';
  var CLE_COPIE = 'globecurios_code_copie';
  var CLE_LANGUE = 'globecurios_langue';
  var CLE_INSTALL = 'miradunia_installation_refusee';
  var CLE_CONTINENT = 'miradunia_continent_entrainement';
  // Installation sur l'écran d'accueil : proposée seulement à partir du 3e jour joué, sur l'écran de résultat.
  var invitationInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); invitationInstall = e; });
  function dejaInstalle() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
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
  // Bonne réponse : le pays de la curiosité, ou un autre pays qui la partage (item.aussi).
  function accepte(item, code) { return code === item.pays || (item.aussi || []).indexOf(code) >= 0; }
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
  // Défi lancé par un ami : « ?ami=210&n=12 » (son score, le numéro du défi). Un défi passé se rejoue hors série.
  var AMI = (function () {
    var p = new URLSearchParams(location.search), s = p.get('ami'), n = p.get('n');
    if (!s || !n || !/^\d{1,3}$/.test(s) || !/^\d{1,6}$/.test(n)) return null;
    var score = parseInt(s, 10), jour = parseInt(n, 10) - 1;
    return score <= 300 && jour >= 0 && jour <= C.indexDuJour() ? { score: score, jour: jour } : null;
  })();
  if (ESSAI === null && AMI && AMI.jour < C.indexDuJour()) ESSAI = AMI.jour;
  var JOUR = ESSAI !== null ? ESSAI : C.indexDuJour();
  var etat = charger();
  var vue = 'accueil';
  var minuteur = null;
  var messageJoker = false;
  var messageJokerGagne = false;
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
  function image(item) { return RACINE + 'img/' + C.nomPhoto(item.id) + '.jpg'; }
  // Tant que le nom n'est pas donné, le texte de remplacement de la photo ne le donne pas non plus.
  function photo(item, rapprochee, nomCache) {
    return h('figure', { class: 'photo' + (rapprochee ? ' zoom' : '') },
      h('img', { src: image(item), alt: rapprochee ? t('commun.detail_alt') : nomCache ? t('commun.photo_alt') : item.nom, width: 560, height: 420 }));
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
      // Lien vers la page du défi dans la langue du joueur : son aperçu montre le détail du jour, et l'ami qui l'ouvre
      // voit le score à battre.
      invite: t('partage.invite', { adresse: 'https://' + D.adresse + '/' + LANGUE + '/j/' + C.numeroDuJour(jour) + '/?ami=' + total })
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
  var ANIMER = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Fait apparaître un élément (verdict, bouton suivant) s'il est sous le bord de l'écran.
  function montrer(el) {
    requestAnimationFrame(function () {
      if (el && el.isConnected) el.scrollIntoView({ block: 'nearest', behavior: ANIMER ? 'smooth' : 'auto' });
    });
  }
  // Petite animation (secousse, rebond) rejouée à chaque appel.
  function animer(el, classe) {
    if (!ANIMER || !el) return;
    el.classList.remove(classe);
    void el.offsetWidth;
    el.classList.add(classe);
  }
  function vibrer(motif) { if (navigator.vibrate) { try { navigator.vibrate(motif); } catch (e) { /* refusé */ } } }
  function precharger(ids) { ids.forEach(function (id) { var i = new Image(); i.src = image(ITEMS[id]); }); }

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
    // Textes nécessaires à la vue : on les charge d'abord (le plus souvent ils sont déjà là).
    var ids = vue === 'jeu' && !etat.jours[JOUR] ? idsDuDefi(C.construireDefi(D, JOUR))
      : vue === 'revision' ? C.aRevoir(etat, JOUR)
        : vue === 'bonus' ? C.vedettesDeLaSemaine(D, JOUR)
          : vue === 'album' ? Object.keys(etat.album)
            : vue === 'entrainement' && entrainement.serie ? entrainement.serie.map(function (q) { return q.item; }) : [];
    var monJeton = ++jeton, pret = false;
    textes(ids, function (erreur) {
      if (monJeton !== jeton) return; // le joueur est passé à autre chose entre-temps
      pret = true;
      if (erreur) {
        remplacer(app, h('section', { class: 'carte centre' }, h('p', {}, t('commun.erreur_chargement')),
          bouton(t('commun.reessayer'), function () { afficher(); })));
      } else dessinerVue();
    });
    if (!pret) remplacer(app, h('section', { class: 'carte centre', 'aria-busy': 'true' }, h('p', { class: 'doux' }, t('commun.chargement'))));
  }
  var jeton = 0;
  function dessinerVue() {
    var contenu = { accueil: vueAccueil, jeu: vueJeu, bonus: vueBonus, entrainement: vueEntrainement, atlas: vueAtlas, album: vueAlbum, revision: vueRevision, regles: vueRegles }[vue]();
    remplacer(app, contenu);
    // Pendant le défi, la barre du bas disparaît : toute la hauteur de l'écran sert au jeu.
    document.body.classList.toggle('en-jeu', vue === 'jeu');
    document.querySelectorAll('.barre button').forEach(function (b) {
      var actif = b.getAttribute('data-vue') === (vue === 'jeu' || vue === 'bonus' || vue === 'entrainement' ? 'accueil' : vue);
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
      messageJokerGagne ? h('p', { class: 'petit' }, t('joker.gagne')) : null,
      AMI && AMI.jour === jour ? h('p', { class: 'verdict ' + (fait.total > AMI.score ? 'bon' : fait.total < AMI.score ? 'mauvais' : 'moyen') },
        t(fait.total > AMI.score ? 'ami.gagne' : fait.total < AMI.score ? 'ami.perdu' : 'ami.egal', { vous: fait.total, ami: AMI.score })) : null,
      decouverte, bPartage, bCopie,
      avecCompte ? h('p', { class: 'doux', style: 'margin:14px 0 0' }, riche('resultat.prochain', { duree: compte })) : null,
      avecCompte ? h('p', { class: 'petit doux', style: 'margin:4px 0 0' }, t('resultat.demain', { niveau: t('niveau.' + C.niveauDuJour(JOUR + 1)) })) : null);
  }
  function proposerInstallation() {
    if (ESSAI !== null || dejaInstalle() || lire(CLE_INSTALL) === '1' || C.statistiques(etat).parties < 3) return null;
    var iPhone = /iphone|ipad|ipod/i.test(navigator.userAgent) && !invitationInstall;
    if (!invitationInstall && !iPhone) return null;
    var carte = h('section', { class: 'carte centre' });
    var refuser = bouton(t('installer.plus_tard'), function () { ecrire(CLE_INSTALL, '1'); carte.remove(); }, 'secondaire');
    if (iPhone) remplacer(carte, h('p', {}, t('installer.ios')), refuser);
    else {
      remplacer(carte, bouton(t('installer.bouton'), function () {
        var e = invitationInstall;
        invitationInstall = null;
        e.prompt();
        (e.userChoice || Promise.resolve()).then(function () { carte.remove(); });
      }), refuser);
    }
    return carte;
  }
  // Rappel quotidien sans serveur : un rendez-vous répété chaque jour dans l'agenda du joueur.
  var CLE_RAPPEL = 'miradunia_rappel_ajoute';
  function deuxChiffres(n) { return (n < 10 ? '0' : '') + n; }
  function dateAgenda(d) { return d.getFullYear() + deuxChiffres(d.getMonth() + 1) + deuxChiffres(d.getDate()); }
  function carteRappel(fermable) {
    var lien = 'https://' + D.adresse + '/' + LANGUE + '/';
    var titre = t('rappel.evenement', { marque: MARQUE });
    var heure = h('input', { type: 'time', value: '08:00', 'aria-label': t('rappel.heure'), class: 'heure-rappel' });
    function debut() {
      var hm = (heure.value || '08:00').split(':');
      var d = new Date(); d.setDate(d.getDate() + 1);
      return { jour: dateAgenda(d), h: deuxChiffres(parseInt(hm[0], 10) || 0), m: deuxChiffres(parseInt(hm[1], 10) || 0) };
    }
    function fait() { ecrire(CLE_RAPPEL, '1'); }
    var bIcs = bouton(t('rappel.ics'), function () {
      var x = debut(), maintenant = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Miradunia//FR', 'BEGIN:VEVENT', 'UID:rappel-quotidien@' + D.adresse,
        'DTSTAMP:' + maintenant, 'DTSTART:' + x.jour + 'T' + x.h + x.m + '00', 'DURATION:PT5M', 'RRULE:FREQ=DAILY',
        'SUMMARY:' + titre, 'URL:' + lien, 'DESCRIPTION:' + lien,
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', 'DESCRIPTION:' + titre, 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      var a = h('a', { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: 'miradunia.ics' });
      document.body.appendChild(a); a.click(); a.remove();
      fait();
    }, 'secondaire');
    var bGoogle = h('a', { class: 'bouton secondaire', target: '_blank', rel: 'noopener', href: '#', onclick: function () {
      var x = debut(), fin = new Date(2000, 0, 1, parseInt(x.h, 10), parseInt(x.m, 10) + 5);
      bGoogle.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(titre) +
        '&dates=' + x.jour + 'T' + x.h + x.m + '00/' + x.jour + 'T' + deuxChiffres(fin.getHours()) + deuxChiffres(fin.getMinutes()) + '00' +
        '&recur=' + encodeURIComponent('RRULE:FREQ=DAILY') + '&details=' + encodeURIComponent(lien);
      fait();
    } }, t('rappel.google'));
    return h('section', { class: 'carte' }, h('h2', {}, t('rappel.titre')), h('p', { class: 'doux' }, t('rappel.texte')),
      h('p', { class: 'ligne-heure' }, h('label', {}, t('rappel.heure') + ' '), heure), bIcs, bGoogle,
      fermable ? bouton(t('installer.plus_tard'), function (e) { fait(); e.target.closest('section').remove(); }, 'secondaire') : null);
  }
  // Bonus du dimanche : une fois le défi fait, retrouver le pays des vedettes de la semaine.
  function carteBonus() {
    if (ESSAI !== null || !C.estDimanche(JOUR) || !etat.jours[JOUR]) return null;
    var total = C.vedettesDeLaSemaine(D, JOUR).length;
    if (!total) return null;
    if (etat.bonus[JOUR] !== undefined) return h('p', { class: 'petit doux centre' }, t('bonus.fait', { n: etat.bonus[JOUR], total: total }));
    return h('section', { class: 'carte' }, h('h2', {}, t('bonus.titre')), h('p', { class: 'doux' }, t('bonus.texte')),
      bouton(t('bonus.jouer'), function () { afficher('bonus'); }));
  }
  function vueBonus() {
    var liste = C.vedettesDeLaSemaine(D, JOUR);
    if (ESSAI !== null || !C.estDimanche(JOUR) || !etat.jours[JOUR] || etat.bonus[JOUR] !== undefined || !liste.length) {
      vue = 'accueil'; return vueAccueil();
    }
    var position = 0, justes = 0, cadre = h('div', {});
    function suivante() {
      if (position >= liste.length) {
        etat.bonus[JOUR] = justes;
        sauver();
        remplacer(cadre, h('section', { class: 'carte centre' }, h('h1', {}, t('bonus.titre')),
          h('p', {}, t('bonus.fait', { n: justes, total: liste.length })),
          bouton(t('revision.voir_atlas'), function () { afficher('atlas'); }, 'secondaire'),
          bouton(t('nav.accueil'), function () { afficher('accueil'); })));
        return;
      }
      var item = ITEMS[liste[position]];
      remplacer(cadre, h('p', { class: 'petit doux' }, t('bonus.position', { n: position + 1, total: liste.length })),
        questionSimple(C.questionRevision(D, item, JOUR), function (juste) {
          if (juste) justes += 1;
          C.noterReponse(etat, item.id, item.pays, juste, JOUR, true);
        }, function () {
          position += 1;
          return bouton(t(position >= liste.length ? 'revision.terminer' : 'revision.suivante'), function () { suivante(); window.scrollTo(0, 0); });
        }, t('bonus.titre').split(/\s*[:：]/)[0]));
    }
    suivante();
    return [cadre];
  }
  // Entraînement par continent : le joueur choisit un continent (ou le monde entier) et enchaîne des séries de
  // questions à quatre choix. Hors défi : ni score du jour ni série, mais l'atlas et l'album progressent.
  var TAILLE_SERIE = 10;
  var entrainement = { continent: null, serie: null, vues: [], graine: 0 };
  function nouvelleSerie(continent) {
    entrainement.continent = continent;
    ecrire(CLE_CONTINENT, continent || 'monde');
    entrainement.graine += 1;
    entrainement.serie = C.questionsEntrainement(D, JOUR, continent, TAILLE_SERIE, Date.now() + '-' + entrainement.graine, entrainement.vues);
    entrainement.serie.forEach(function (q) { if (entrainement.vues.indexOf(q.item) < 0) entrainement.vues.push(q.item); });
    afficher('entrainement');
  }
  function carteEntrainement() {
    return h('section', { class: 'carte' }, h('h2', {}, t('entrainement.titre')),
      h('p', { class: 'doux' }, t('entrainement.texte')),
      bouton(t('entrainement.bouton'), function () { entrainement.serie = null; afficher('entrainement'); }, etat.jours[JOUR] ? '' : 'secondaire'));
  }
  function nomZone(continent) { return continent ? nomContinent(continent) : t('entrainement.monde'); }
  function vueEntrainement() {
    if (ESSAI !== null) { vue = 'accueil'; return vueAccueil(); }
    if (!entrainement.serie) {
      var compte = C.continentsEntrainement(D, JOUR);
      var precedent = lire(CLE_CONTINENT);
      var zones = Object.keys(compte).sort(function (a, b) { return parNom(nomContinent(a), nomContinent(b)); });
      var puce = function (continent) {
        var choisi = (continent || 'monde') === precedent;
        return h('button', { type: 'button', class: 'puce' + (choisi ? ' choisie' : ''), onclick: function () { nouvelleSerie(continent); } },
          nomZone(continent));
      };
      return [h('section', { class: 'carte' }, h('h1', {}, t('entrainement.titre')),
        h('p', { class: 'doux' }, t('entrainement.choisir')),
        h('div', { class: 'puces' }, zones.map(puce).concat([puce(null)])),
        h('p', { class: 'petit doux', style: 'margin-top:16px' }, t('entrainement.note')))];
    }
    var liste = entrainement.serie, position = 0, justes = 0, cadre = h('div', {});
    var etiquette = t('entrainement.etiquette') + ' · ' + nomZone(entrainement.continent);
    function suivante() {
      if (position >= liste.length) {
        majEntete();
        remplacer(cadre, h('section', { class: 'carte centre' }, h('h1', {}, t('entrainement.termine')),
          h('p', {}, t('entrainement.bilan', { n: justes, total: liste.length, zone: nomZone(entrainement.continent) })),
          bouton(t('entrainement.encore'), function () { nouvelleSerie(entrainement.continent); }),
          bouton(t('entrainement.changer'), function () { entrainement.serie = null; afficher('entrainement'); }, 'secondaire'),
          bouton(t('nav.accueil'), function () { afficher('accueil'); }, 'secondaire')));
        return;
      }
      var question = liste[position], item = ITEMS[question.item];
      if (position + 1 < liste.length) precharger([liste[position + 1].item]);
      remplacer(cadre, h('p', { class: 'petit doux' }, t('entrainement.position', { n: position + 1, total: liste.length })),
        questionSimple(question, function (juste) {
          if (juste) justes += 1;
          C.noterReponse(etat, item.id, item.pays, juste, JOUR, true);
          sauver();
        }, function () {
          position += 1;
          return bouton(t(position >= liste.length ? 'revision.terminer' : 'revision.suivante'), function () { suivante(); window.scrollTo(0, 0); });
        }, etiquette));
    }
    suivante();
    return [cadre];
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
      var bonus = carteBonus();
      if (bonus) blocs.push(bonus);
      if (ESSAI === null && lire(CLE_RAPPEL) !== '1') blocs.push(carteRappel(true));
      var install = proposerInstallation();
      if (install) blocs.push(install);
      var nb = C.toutesARevoir(etat, JOUR).length;
      if (nb > 0) {
        blocs.push(h('section', { class: 'carte' }, h('h2', {}, t('nav.a_revoir', { n: nb })),
          h('p', { class: 'doux' }, t('accueil.a_revoir_texte')),
          bouton(t('accueil.reviser'), function () { afficher('revision'); }, 'secondaire')));
      }
    } else {
      // Aperçu : le détail de la photo du jour, c'est-à-dire le premier indice (rien n'est dévoilé).
      var vedette = ITEMS[C.construireDefi(D, JOUR).epreuves[0].item];
      if (AMI && AMI.jour === JOUR) blocs.push(h('p', { class: 'verdict moyen centre' }, t('ami.bandeau', { score: AMI.score })));
      blocs.push(h('section', { class: 'carte' },
        h('figure', { class: 'loupe', 'aria-hidden': 'true' }, h('img', { src: image(vedette), alt: '', width: 560, height: 420 })),
        h('span', { class: 'etiquette' }, [t('defi.numero', { n: C.numeroDuJour(JOUR) }), ESSAI === null ? dateDuJour() : t('defi.hors_serie'),
          t('defi.niveau', { niveau: t('niveau.' + niveau) })].join(' · ')),
        h('h1', {}, t(C.estDimanche(JOUR) ? 'accueil.titre_dimanche' : 'accueil.titre')),
        h('p', { class: 'doux' }, t('accueil.texte')),
        bouton(t(partieEnCours() ? 'accueil.reprendre' : 'accueil.jouer'), function () { afficher('jeu'); })));
    }
    if (ESSAI !== null) return blocs;
    blocs.push(carteEntrainement());

    var stats = C.statistiques(etat);
    // Avant la première partie, des compteurs à zéro n'apprennent rien : on les montre ensuite.
    if (stats.parties > 0) {
      blocs.push(h('div', { class: 'chiffres' },
        h('div', {}, h('b', {}, serie), h('span', {}, t('chiffres.serie', { n: serie }))),
        h('div', {}, h('b', {}, etat.meilleureSerie), h('span', {}, t('chiffres.record'))),
        h('div', {}, h('b', {}, bilan.decouverts + '/' + bilan.total), h('span', {}, t('chiffres.pays')))));
    }
    if (serie >= 1) {
      var reserve = C.jokers(etat);
      blocs.push(h('p', { class: 'petit doux centre' }, reserve > 0 ? t('joker.stock', { n: reserve }) : t('joker.aucun')));
    }
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
    var etapes = h('div', { class: 'haut-jeu' },
      h('div', { class: 'etapes', role: 'img', 'aria-label': t('jeu.etape', { n: index + 1 }) },
        [0, 1, 2].map(function (n) { return h('i', { class: n < index ? 'passee' : n === index ? 'ici' : '' }); })),
      h('button', { type: 'button', class: 'quitter', 'aria-label': t('jeu.quitter'), title: t('jeu.quitter'),
        onclick: function () { afficher('accueil'); } }, '×'));
    if (index === 0) precharger(idsDuDefi(defi));

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
      if (termine) {
        var fin = C.terminerJour(etat, jourJoue, enCours.scores);
        messageJoker = fin.joker;
        messageJokerGagne = fin.jokerGagne;
      }
      sauver();
      majEntete();
      var suite = bouton(t(termine ? 'jeu.voir_resultat' : 'jeu.suivante'), function () {
        if (termine) resultatDe = jourJoue;
        afficher(termine ? 'accueil' : 'jeu');
      });
      montrer(suite);
      return suite;
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
    var dezoomer = false; // vrai juste après l'indice 1 : la photo se dévoile en reculant

    function historique() {
      if (!tentatives.length) return null;
      var demandes = tentatives.filter(function (c) { return c === null; }).length;
      var lignes = tentatives.filter(function (c) { return c !== null; }).map(function (code) {
        var proche = continent(code) === continent(item.pays);
        return h('li', { class: proche ? 'proche' : '' },
          riche(proche ? 'origine.essai_bon_continent' : 'origine.essai_autre_continent', { pays: pays(code) }));
      });
      if (demandes) lignes.push(h('li', { class: 'neutre' }, t('origine.indice_demande') + (demandes > 1 ? ' ×' + demandes : '')));
      return h('ul', { class: 'essais' }, lignes);
    }
    function proposer(code) {
      if (code !== null && accepte(item, code)) { finir(true, code); return; }
      tentatives.push(code);
      if (tentatives.length >= 4) { finir(false); return; }
      memoriser({ t: tentatives });
      dezoomer = tentatives.length === 1;
      dessiner();
      if (code !== null) { animer(cadre, 'secoue'); vibrer(40); }
      cadre.focus({ preventScroll: true });
    }
    function finir(reussi, choisi) {
      var numero = tentatives.length + (reussi ? 1 : 0);
      var score = C.pointsOrigine(numero, reussi);
      // L'atlas ne retient que les curiosités reconnues à la photo, avant que le nom soit donné.
      C.noterReponse(etat, item.id, item.pays, reussi && numero <= 2, JOUR);
      var texte = reussi && choisi !== item.pays
        ? t('origine.trouve.' + numero, { pays: pays(choisi) }) + ' ' + t('origine.aussi', { pays: pays(choisi), principal: pays(item.pays) })
        : t(reussi ? 'origine.trouve.' + numero : 'origine.rate', { pays: pays(item.pays) });
      var verdict = h('p', { class: 'verdict ' + (reussi ? (numero === 1 ? 'bon' : 'moyen') : 'mauvais') }, texte + ' ' + points(score));
      var cliche = photo(item);
      if (tentatives.length === 0) cliche.classList.add('dezoom'); // trouvé sur le détail : on recule pour voir la photo
      remplacer(cadre, h('span', { class: 'etiquette' }, t('origine.nom') + ' · ' + categorie(item)),
        cliche, h('p', { class: 'nom' }, item.nom), historique(), verdict, savoir(item), conclure(score));
      if (reussi) { animer(verdict, 'rebond'); vibrer(20); } else vibrer([30, 50, 30]);
    }
    // Recherche d'un pays : on tape quelques lettres, les pays qui correspondent s'affichent.
    // Après un essai sur le bon continent, les pays de ce continent passent en tête.
    function recherche(essayes) {
      var proche = null;
      tentatives.forEach(function (c) { if (c !== null && continent(c) === continent(item.pays)) proche = continent(c); });
      var reduire = function (s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
      var candidats = Object.keys(D.pays).filter(function (c) { return essayes.indexOf(c) < 0; })
        .map(function (c) { return { code: c, nom: pays(c), cle: reduire(pays(c)) }; });
      var champ = h('input', { type: 'search', class: 'champ-pays', placeholder: t('origine.recherche'), 'aria-label': t('origine.select_label'),
        autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'go' });
      var resultats = h('div', { class: 'choix resultats', 'aria-live': 'polite' });
      function filtrer() {
        var q = reduire(champ.value.trim());
        if (!q) { remplacer(resultats); return; }
        var trouves = candidats.filter(function (c) {
          return c.cle.indexOf(q) === 0 || c.cle.split(/[\s'’-]+/).some(function (mot) { return mot.indexOf(q) === 0; });
        }).sort(function (a, b) {
          var pa = proche && continent(a.code) === proche ? 0 : 1, pb = proche && continent(b.code) === proche ? 0 : 1;
          return pa - pb || (a.cle.indexOf(q) === 0 ? 0 : 1) - (b.cle.indexOf(q) === 0 ? 0 : 1) || parNom(a.nom, b.nom);
        }).slice(0, 6);
        remplacer(resultats, trouves.length ? trouves.map(function (c) {
          return h('button', { type: 'button', onclick: function () { proposer(c.code); } }, c.nom);
        }) : h('p', { class: 'petit doux' }, t('origine.aucun')));
      }
      champ.addEventListener('input', filtrer);
      champ.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        var premier = resultats.querySelector('button');
        if (premier) { e.preventDefault(); premier.click(); }
      });
      return [champ, resultats];
    }
    function dessiner() {
      var etape = tentatives.length;
      var essayes = tentatives.filter(function (c) { return c !== null; });
      var saisie;
      if (etape < 3) {
        saisie = recherche(essayes).concat([bouton(t('origine.indice_suivant'), function () { proposer(null); }, 'secondaire')]);
      } else {
        saisie = h('div', { class: 'choix' }, epreuve.options.map(function (code) {
          var b = h('button', { type: 'button', onclick: function () { proposer(code); } }, pays(code));
          if (essayes.indexOf(code) >= 0) { b.disabled = true; b.classList.add('fausse'); }
          return b;
        }));
      }
      var cliche = photo(item, etape === 0, etape < 2);
      if (dezoomer) cliche.classList.add('dezoom');
      dezoomer = false;
      remplacer(cadre,
        h('span', { class: 'etiquette' }, t('origine.etiquette', { n: etape + 1, points: C.POINTS_ORIGINE[etape] })),
        cliche,
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
  function questionSimple(question, noter, suivant, etiquette) {
    var item = ITEMS[question.item];
    var fini = false;
    var suite = h('div', { 'aria-live': 'polite' });
    var boutons = question.options.map(function (code) {
      var b = h('button', { type: 'button', onclick: function () {
        if (fini) return;
        fini = true;
        var juste = accepte(item, code);
        boutons.forEach(function (autre, n) {
          autre.disabled = true;
          if (accepte(item, question.options[n])) autre.classList.add('juste');
        });
        if (!juste) b.classList.add('fausse');
        noter(juste);
        // Le nom n'apparaît qu'après la réponse : on se souvient de la photo, pas de l'étiquette.
        nom.textContent = item.nom;
        nom.hidden = false;
        var verdict = h('p', { class: 'verdict ' + (juste ? 'bon' : 'mauvais') },
          t(juste ? 'revision.exact' : 'origine.rate', { pays: pays(item.pays) }));
        remplacer(suite, verdict, savoir(item), suivant());
        if (juste) animer(verdict, 'rebond'); else animer(b, 'secoue');
        montrer(suite.lastChild);
      } }, pays(code));
      return b;
    });
    var nom = h('p', { class: 'nom', hidden: true });
    return h('section', { class: 'carte' }, h('span', { class: 'etiquette' }, (etiquette || t('revision.titre')) + ' · ' + categorie(item)),
      photo(item, false, true), nom,
      h('p', { class: 'consigne' }, t('origine.consigne')),
      h('div', { class: 'choix' }, boutons), suite);
  }

  // Épreuve 2 : trois curiosités d'un pays, une intruse.
  function epreuveIntrus(epreuve, partiel, memoriser, conclure) {
    var faux = partiel && Array.isArray(partiel.faux) ? partiel.faux.slice() : [];
    var fini = false;
    var suite = h('div', { 'aria-live': 'polite' });
    // Après une erreur, on dit d'où vient la carte touchée : le second essai devient un raisonnement.
    var encore = function () { return h('p', { class: 'verdict moyen' }, t('intrus.encore_pays', { pays: pays(epreuve.paysTrio) })); };
    // Les noms ne s'affichent qu'une fois l'épreuve tranchée : on juge sur les photos.
    var cartes = epreuve.cartes.map(function (id) {
      var item = ITEMS[id];
      var carte = h('button', { type: 'button', class: 'vignette', 'aria-label': t('commun.photo_alt'), onclick: function () {
        if (fini || carte.disabled) return;
        var juste = id === epreuve.intrus;
        if (!juste) {
          faux.push(id);
          carte.classList.add('fausse');
          carte.disabled = true;
          animer(carte, 'secoue'); vibrer(40);
          if (faux.length < 2) { memoriser({ faux: faux }); remplacer(suite, encore()); return; }
        }
        fini = true;
        var essais = faux.length + (juste ? 1 : 0);
        cartes.forEach(function (autre, n) {
          var autreItem = ITEMS[epreuve.cartes[n]];
          autre.disabled = true;
          autre.removeAttribute('aria-label');
          if (autreItem.id === epreuve.intrus) autre.classList.add('juste');
          autre.appendChild(h('span', {}, autreItem.nom));
          autre.appendChild(h('small', {}, pays(autreItem.pays)));
          // Les trois cartes du même pays entrent aussi dans l'album : on les a vues.
          if (ESSAI === null && etat.album[autreItem.id] === undefined) etat.album[autreItem.id] = JOUR;
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
        if (juste) { animer(cartes[epreuve.cartes.indexOf(epreuve.intrus)], 'rebond'); vibrer(20); }
      } }, h('img', { src: image(item), alt: '', width: 280, height: 210 }));
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
        var juste = accepte(item, choix[id]);
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
      var verdict = h('p', { class: 'verdict ' + (justes === 4 ? 'bon' : justes > 0 ? 'moyen' : 'mauvais') },
        [justes === 4 ? t('liens.tout_juste') : t('liens.partiel', { n: justes }),
          t('liens.en_trop', { pays: pays(epreuve.paysEnTrop) }), points(score)].join(' '));
      remplacer(suite, verdict,
        epreuve.items.map(function (id) {
          return h('p', { class: 'fait petit' },
            h('b', {}, t('liens.titre_fait', { nom: ITEMS[id].nom, pays: pays(ITEMS[id].pays) }) + ' '), ITEMS[id].fait);
        }),
        // Crédits des quatre photos, repliés pour ne pas noyer la fin de l'épreuve.
        h('details', { class: 'credit' }, h('summary', {}, t('liens.photos').replace(/\s*[:：]\s*$/, '')),
          epreuve.items.map(function (id, n) {
            return [n ? ' · ' : '', h('a', { href: ITEMS[id].credit.page, target: '_blank', rel: 'noopener' },
              auteur(ITEMS[id]) + ' (' + ITEMS[id].credit.licence + ')')];
          })),
        conclure(score));
      if (justes === 4) { animer(verdict, 'rebond'); vibrer(20); } else if (justes === 0) vibrer([30, 50, 30]);
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
    // Par continent : d'abord les pays rencontrés, du mieux connu au moins connu ; les autres sont repliés.
    Object.keys(continents).sort(function (a, b) { return parNom(nomContinent(a), nomContinent(b)); }).forEach(function (cle) {
      var codes = continents[cle].sort(function (a, b) {
        return C.niveau(etat.atlas[b]) - C.niveau(etat.atlas[a]) || parNom(pays(a), pays(b));
      });
      var ligne = function (code) {
        var fiche = etat.atlas[code];
        var n = C.niveau(fiche);
        return h('div', { class: 'pays' },
          h('span', {}, h('b', {}, pays(code)), fiche ? h('span', { class: 'petit doux' }, '  ' + t('atlas.score', fiche)) : null),
          h('span', { class: 'niveau n' + n }, t('atlas.niveau.' + n)));
      };
      var connus = codes.filter(function (c) { return C.niveau(etat.atlas[c]) > 0; });
      var autres = codes.filter(function (c) { return C.niveau(etat.atlas[c]) === 0; });
      blocs.push(h('section', { class: 'carte' }, h('h2', {}, nomContinent(cle) + ' · ' + connus.length + '/' + codes.length),
        connus.map(ligne),
        autres.length ? h('details', { class: 'a-decouvrir' }, h('summary', {}, t('atlas.a_decouvrir', { n: autres.length })), autres.map(ligne)) : null));
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
          // Défi du jour pas encore joué : c'est la suite naturelle.
          !etat.jours[JOUR] && ESSAI === null ? bouton(t('accueil.jouer'), function () { afficher('jeu'); }) : null,
          reste > 0 ? bouton(t('revision.continuer', { n: reste }), function () { afficher('revision'); }, etat.jours[JOUR] ? '' : 'secondaire') : null,
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
      if (!credits.open || credits.querySelector('ul, .attente')) return;
      var echec = credits.querySelector('.echec');
      if (echec) echec.remove();
      var attente = h('p', { class: 'petit doux attente', 'aria-busy': 'true' }, t('commun.chargement'));
      credits.appendChild(attente);
      textes(D.items.map(function (i) { return i.id; }), function (erreur) {
        attente.remove();
        if (erreur) { credits.appendChild(h('p', { class: 'petit echec' }, t('commun.erreur_chargement'))); return; }
        credits.appendChild(h('ul', { class: 'credits-liste' }, D.items.map(function (item) {
          return h('li', {}, riche('sources.credit_ligne', { nom: item.nom, auteur: auteur(item), licence: item.credit.licence },
            { href: item.credit.page, target: '_blank', rel: 'noopener' }));
        })));
      });
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
      carteRappel(false),
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
  // Les textes du défi du jour arrivent pendant que le joueur lit l'accueil : « Jouer » s'ouvre aussitôt.
  if (!etat.jours[JOUR]) textes(idsDuDefi(C.construireDefi(D, JOUR)), function () {});
})();
