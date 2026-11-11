/* GlobeCurios — affichage. Les règles sont dans core.js, les curiosités dans data/data.js. */
(function () {
  'use strict';
  var C = window.GCCore, D = window.GC_DATA;
  var app = document.getElementById('app');
  var ITEMS = {};
  D.items.forEach(function (i) { ITEMS[i.id] = i; });
  var CLE = 'globecurios_etat_v1';
  var CATEGORIES = ['monument', 'lieu', 'plat', 'boisson', 'fête', 'tradition', 'instrument', 'objet'];
  var PLURIELS = { monument: 'Monuments', lieu: 'Lieux', plat: 'Plats', boisson: 'Boissons', 'fête': 'Fêtes',
    tradition: 'Traditions', instrument: 'Instruments', objet: 'Objets' };

  // Ancien défi : « ?essai=12 » rejoue le défi n° 12 hors série, sans rien enregistrer.
  // Le défi du jour et les suivants ne s'ouvrent ainsi que sur le poste du développeur.
  var parametre = new URLSearchParams(location.search).get('essai');
  var surPosteLocal = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var ESSAI = parametre !== null && /^\d+$/.test(parametre) ? parseInt(parametre, 10) - 1 : null;
  if (ESSAI !== null && ESSAI >= C.indexDuJour() && !surPosteLocal) ESSAI = null;
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
  function pays(code) { return D.pays[code].nom; }
  function continent(code) { return D.pays[code].continent; }
  function charger() {
    if (ESSAI !== null) return C.nouvelEtat();
    try {
      var lu = C.etatValide(JSON.parse(localStorage.getItem(CLE)));
      if (lu) return lu;
    } catch (e) { /* stockage indisponible : on joue quand même, sans mémoire */ }
    return C.nouvelEtat();
  }
  function sauver() {
    if (ESSAI !== null) return;
    try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) { /* idem */ }
  }
  var CLE_COPIE = 'globecurios_code_copie';
  function codeDejaCopie() { try { return localStorage.getItem(CLE_COPIE) === '1'; } catch (e) { return false; } }
  function noterCodeCopie() { try { localStorage.setItem(CLE_COPIE, '1'); } catch (e) { /* sans importance */ } }
  function versBase64(t) { return btoa(unescape(encodeURIComponent(t))); }
  function depuisBase64(t) { return decodeURIComponent(escape(atob(t))); }
  function duree(secondes) {
    function deux(n) { return (n < 10 ? '0' : '') + n; }
    return deux(Math.floor(secondes / 3600)) + ':' + deux(Math.floor(secondes / 60) % 60) + ':' + deux(secondes % 60);
  }
  function dateDuJour() {
    return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function pluriel(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }
  function bouton(texte, action, classe) {
    return h('button', { type: 'button', class: 'bouton' + (classe ? ' ' + classe : ''), onclick: action }, texte);
  }
  function photo(item, rapprochee) {
    return h('figure', { class: 'photo' + (rapprochee ? ' zoom' : '') },
      h('img', { src: item.img, alt: rapprochee ? 'Détail de la curiosité à deviner' : item.nom, width: 560, height: 420 }));
  }
  function credit(item) {
    return h('p', { class: 'credit' }, 'Photo : ' + item.credit.auteur + ', ' + item.credit.licence + ', ',
      h('a', { href: item.credit.page, target: '_blank', rel: 'noopener' }, 'Wikimedia Commons'));
  }
  // Adresse qui reçoit les signalements d'erreur. Vide : le lien « Signaler une erreur » n'est pas affiché.
  var CONTACT = '';
  function signaler(item) {
    if (!CONTACT) return null;
    var sujet = 'GlobeCurios — erreur' + (item ? ' sur « ' + item.nom + ' » (' + item.id + ')' : '');
    var corps = 'Bonjour,\n\nVoici ce qui me semble faux ou ambigu :\n\n';
    return h('a', { href: 'mailto:' + CONTACT + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps) },
      'Signaler une erreur');
  }
  function savoir(item) {
    var lien = signaler(item);
    return [h('p', { class: 'fait' }, item.fait),
      h('p', { class: 'petit' }, h('a', { href: item.lien, target: '_blank', rel: 'noopener' }, 'En savoir plus sur Wikipédia'),
        lien ? ' · ' : null, lien),
      credit(item)];
  }
  function partager(texte, source, copieSeule) {
    function copie() { source.textContent = 'Résultat copié, il reste à le coller'; }
    function secours() {
      if (source.nextSibling && source.nextSibling.tagName === 'TEXTAREA') return;
      var zone = h('textarea', { rows: 4, readonly: true, 'aria-label': 'Résultat à copier' }, texte);
      source.parentNode.insertBefore(zone, source.nextSibling);
      zone.focus(); zone.select();
    }
    function presse() {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(copie, secours);
      else secours();
    }
    // La feuille de partage du système n'est utile que sur téléphone ; ailleurs on copie.
    var tactile = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (navigator.share && tactile && !copieSeule) {
      navigator.share({ text: texte }).catch(function (e) { if (!e || e.name !== 'AbortError') presse(); });
    } else presse();
  }

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
    document.getElementById('serie-entete').textContent = serie > 0 ? 'Série : ' + pluriel(serie, 'jour', 'jours') : '';
    var nb = C.toutesARevoir(etat, JOUR).length;
    var pastille = document.getElementById('pastille-revision');
    pastille.hidden = nb === 0;
    pastille.textContent = nb;
    pastille.setAttribute('aria-label', pluriel(nb, 'curiosité à revoir', 'curiosités à revoir'));
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
    var bPartage = bouton('Partager mon résultat', function () {
      partager(C.texteDePartage(jour, fait.scores, serie), bPartage);
    });
    // Sur téléphone, « Partager » ouvre la feuille du système : on propose aussi la simple copie.
    var tactile = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var bCopie = navigator.share && tactile ? bouton('Copier mon résultat', function () {
      partager(C.texteDePartage(jour, fait.scores, serie), bCopie, true);
    }, 'secondaire') : null;
    // Ce que la partie a apporté : les curiosités entrées dans l'album ce jour-là.
    var nouvelles = Object.keys(etat.album).filter(function (id) { return etat.album[id] === jour; }).length;
    var sansFaute = fait.total === 300;
    var decouverte = ESSAI !== null ? null : h('p', { class: 'petit' },
      (sansFaute ? 'Sans-faute. ' : '') + (nouvelles > 0
        ? (nouvelles > 1 ? nouvelles + ' nouvelles curiosités sont entrées' : 'Une nouvelle curiosité est entrée') + ' dans votre album.'
        : 'Vous aviez déjà rencontré toutes les curiosités de ce défi.'));
    return h('section', { class: 'carte centre' },
      h('span', { class: 'etiquette' }, 'Défi n° ' + C.numeroDuJour(jour) + (ESSAI !== null ? ' · hors série' : '')),
      h('p', { class: 'score' }, fait.total + ' / 300'),
      h('p', { class: 'carres', role: 'img', 'aria-label': 'Résultat : ' + C.carresEnMots(fait.scores) }, C.carres(fait.scores)),
      messageJoker ? h('p', { class: 'petit' }, 'Vous aviez manqué un jour : votre joker a sauvé votre série.') : null,
      decouverte, bPartage, bCopie,
      avecCompte ? h('p', { class: 'doux', style: 'margin:14px 0 0' }, 'Prochain défi dans ', compte) : null);
  }
  function vueAccueil() {
    var fait = etat.jours[JOUR];
    var bilan = C.bilanAtlas(etat, D);
    var serie = C.serieActuelle(etat, JOUR);
    var niveau = C.niveauDuJour(JOUR);
    var blocs = [];
    if (resultatDe !== null && resultatDe !== JOUR && etat.jours[resultatDe]) {
      blocs.push(carteResultat(resultatDe, false),
        h('p', { class: 'petit doux centre' }, 'Minuit est passé pendant votre partie : un nouveau défi vous attend.'));
    }
    if (fait) {
      blocs.push(carteResultat(JOUR, ESSAI === null));
      var nb = C.toutesARevoir(etat, JOUR).length;
      if (nb > 0) {
        blocs.push(h('section', { class: 'carte' }, h('h2', {}, pluriel(nb, 'curiosité à revoir', 'curiosités à revoir')),
          h('p', { class: 'doux' }, 'Celles que vous avez manquées reviennent ici pour que vous les reteniez.'),
          bouton('Réviser', function () { afficher('revision'); }, 'secondaire')));
      }
    } else {
      var titre = C.estDimanche(JOUR) ? 'Grand défi du dimanche' : 'Trois énigmes en images, une découverte du monde';
      blocs.push(h('section', { class: 'carte' },
        h('span', { class: 'etiquette' }, 'Défi n° ' + C.numeroDuJour(JOUR) + (ESSAI === null ? ' · ' + dateDuJour() : ' · hors série') +
          ' · niveau ' + C.NOMS_NIVEAUX[niveau]),
        h('h1', {}, titre),
        h('p', { class: 'doux' }, 'Un plat, un monument, une fête, un instrument… À quel pays les rattacher ? Quelques minutes par jour, et chaque réponse vous apprend quelque chose.'),
        bouton(partieEnCours() ? 'Reprendre ma partie' : 'Jouer le défi du jour', function () { afficher('jeu'); })));
    }
    if (ESSAI !== null) return blocs;

    blocs.push(h('div', { class: 'chiffres' },
      h('div', {}, h('b', {}, serie), h('span', {}, serie > 1 ? 'jours d\'affilée' : 'jour d\'affilée')),
      h('div', {}, h('b', {}, etat.meilleureSerie), h('span', {}, 'record')),
      h('div', {}, h('b', {}, bilan.decouverts + '/' + bilan.total), h('span', {}, 'pays découverts'))));
    if (serie >= 2) {
      var attente = etat.jokerLe === null ? 0 : Math.max(0, 7 - (JOUR - etat.jokerLe));
      blocs.push(h('p', { class: 'petit doux centre' }, attente === 0
        ? 'Joker disponible : un jour manqué ne cassera pas votre série.'
        : 'Joker utilisé : il revient dans ' + pluriel(attente, 'jour', 'jours') + '.'));
    }
    var stats = C.statistiques(etat);
    if (stats.parties > 0) {
      var maxi = Math.max.apply(null, stats.repartition) || 1;
      var libelles = ['moins de 100', '100 à 199', '200 à 299', '300'];
      blocs.push(h('section', { class: 'carte' }, h('h2', {}, 'Mes statistiques'),
        h('p', {}, pluriel(stats.parties, 'défi joué', 'défis joués') + ' · moyenne ' + stats.moyenne + ' · meilleur score ' + stats.meilleur +
          (stats.parties > 7 ? ' · moyenne des 7 derniers : ' + stats.moyenne7 : '')),
        h('div', { class: 'barres' }, stats.repartition.map(function (n, k) {
          return h('div', { class: 'barre-ligne' }, h('span', {}, libelles[k]),
            h('i', { style: 'width:' + Math.max(4, Math.round(100 * n / maxi)) + '%' + (n === 0 ? ';opacity:.25' : '') }), h('b', {}, n));
        }))));
    }
    var anciens = C.joursRejouables(etat, JOUR, 7);
    if (fait && anciens.length > 0) {
      blocs.push(h('section', { class: 'carte' }, h('h2', {}, 'Défis manqués'),
        h('p', { class: 'doux' }, 'Vous pouvez les rejouer hors série : le score n\'est pas enregistré.'),
        h('div', { class: 'anciens' }, anciens.map(function (j) {
          return h('a', { class: 'puce', href: '?essai=' + C.numeroDuJour(j) }, 'n° ' + C.numeroDuJour(j));
        }))));
    }
    if (stats.parties >= 7 && !codeDejaCopie()) {
      blocs.push(h('p', { class: 'petit doux centre' }, 'Votre progression n\'existe que sur cet appareil. ',
        h('a', { href: '#', 'data-vue': 'regles' }, 'Gardez votre code de sauvegarde'), ' pour ne pas la perdre.'));
    }
    if (!fait && stats.parties === 0) {
      // Première visite un jour difficile : on propose d'abord un ancien défi facile, hors série.
      var facile = null;
      for (var j = JOUR - 1; j >= 0 && facile === null; j--) if (C.niveauDuJour(j) === 1) facile = j;
      if (niveau > 1 && facile !== null) {
        blocs.push(h('p', { class: 'petit centre' }, 'Première visite ? ',
          h('a', { href: '?essai=' + C.numeroDuJour(facile) }, 'Essayez d\'abord un défi facile'), ', sans enjeu.'));
      }
      blocs.push(h('p', { class: 'petit doux centre' }, 'Gratuit, sans compte. Votre progression reste sur cet appareil.'));
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
    var etapes = h('div', { class: 'etapes', role: 'img', 'aria-label': 'Épreuve ' + (index + 1) + ' sur 3' },
      [0, 1, 2].map(function (n) { return h('i', { class: n < index ? 'passee' : n === index ? 'ici' : '' }); }));

    // Mémorise un essai manqué : recharger la page ne rend pas les essais.
    function memoriser(partiel) {
      enCours.partiel = partiel;
      etat.enCours = enCours;
      sauver();
    }
    // Appelé dès que l'épreuve est tranchée : le score est enregistré tout de suite, on ne peut pas la rejouer.
    function valider(points) {
      var jourJoue = JOUR;
      enCours.scores.push(points);
      enCours.index += 1;
      enCours.partiel = null;
      etat.enCours = enCours;
      var termine = enCours.index >= 3;
      if (termine) messageJoker = C.terminerJour(etat, jourJoue, enCours.scores).joker;
      sauver();
      majEntete();
      return bouton(termine ? 'Voir mon résultat' : 'Épreuve suivante', function () {
        if (termine) resultatDe = jourJoue;
        afficher(termine ? 'accueil' : 'jeu');
      });
    }
    var corps = epreuve.type === 'origine' ? epreuveOrigine(epreuve, enCours.partiel, memoriser, valider)
      : epreuve.type === 'intrus' ? epreuveIntrus(epreuve, enCours.partiel, memoriser, valider)
        : epreuveLiens(epreuve, valider);
    return [etapes, corps];
  }

  // Épreuve 1 — « D'où ça vient ? » : quatre indices, de la photo rapprochée aux quatre pays proposés.
  function epreuveOrigine(epreuve, partiel, memoriser, conclure) {
    var item = ITEMS[epreuve.item];
    var tentatives = partiel && Array.isArray(partiel.t) ? partiel.t.slice() : []; // code de pays, ou null si indice demandé
    var cadre = h('section', { class: 'carte' });
    var INDICES = ['Voici un détail de la photo. Chaque erreur débloque un indice, mais coûte des points.',
      'Voici la photo entière.', 'Voici son nom.', 'Dernière chance : c\'est l\'un de ces quatre pays.'];

    function historique() {
      if (!tentatives.length) return null;
      return h('ul', { class: 'essais' }, tentatives.map(function (code) {
        if (code === null) return h('li', {}, 'Indice demandé');
        return h('li', {}, h('b', {}, '✗ ' + pays(code)), continent(code) === continent(item.pays) ? ' — bon continent' : ' — autre continent');
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
      var points = C.pointsOrigine(numero, reussi);
      // L'atlas ne retient que les curiosités reconnues à la photo, avant que le nom soit donné.
      C.noterReponse(etat, item.id, item.pays, reussi && numero <= 2, JOUR);
      var texte = reussi
        ? ['Du premier coup, sur un simple détail : ', 'Trouvé avec la photo entière : ', 'Trouvé grâce au nom : ', 'Trouvé parmi les quatre pays : '][numero - 1] + pays(item.pays) + '.'
        : 'La réponse était : ' + pays(item.pays) + '.';
      remplacer(cadre, h('span', { class: 'etiquette' }, 'D\'où ça vient ? · ' + item.cat),
        photo(item), h('p', { class: 'nom' }, item.nom), historique(),
        h('p', { class: 'verdict ' + (reussi ? (numero === 1 ? 'bon' : 'moyen') : 'mauvais') }, texte + ' +' + points + ' points'),
        savoir(item), conclure(points));
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
        var liste = h('select', { 'aria-label': 'Pays proposé' }, h('option', { value: '' }, 'Choisir un pays…'),
          Object.keys(groupes).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).map(function (nom) {
            return h('optgroup', { label: nom }, groupes[nom].sort(function (a, b) { return pays(a).localeCompare(pays(b), 'fr'); })
              .map(function (code) { return h('option', { value: code }, pays(code)); }));
          }));
        var bValider = bouton('Valider', function () { if (liste.value) proposer(liste.value); });
        bValider.disabled = true;
        liste.addEventListener('change', function () { bValider.disabled = !liste.value; });
        saisie = [liste, bValider, bouton('Je ne sais pas : indice suivant', function () { proposer(null); }, 'secondaire')];
      } else {
        saisie = h('div', { class: 'choix' }, epreuve.options.map(function (code) {
          var b = h('button', { type: 'button', onclick: function () { proposer(code); } }, pays(code));
          if (essayes.indexOf(code) >= 0) { b.disabled = true; b.classList.add('fausse'); }
          return b;
        }));
      }
      remplacer(cadre,
        h('span', { class: 'etiquette' }, 'D\'où ça vient ? · indice ' + (etape + 1) + ' sur 4 · ' + C.POINTS_ORIGINE[etape] + ' points'),
        photo(item, etape === 0),
        etape >= 2 ? h('p', { class: 'nom' }, item.nom, h('span', { class: 'categorie' }, ' · ' + item.cat)) : null,
        h('p', { class: 'consigne' }, 'À quel pays cette curiosité est-elle rattachée ?'),
        h('p', { class: 'petit doux', 'aria-live': 'polite' }, INDICES[etape]),
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
          juste ? 'Exact : ' + pays(item.pays) + '.' : 'La réponse était : ' + pays(item.pays) + '.'), savoir(item), suivant());
      } }, pays(code));
      return b;
    });
    return h('section', { class: 'carte' }, h('span', { class: 'etiquette' }, 'Révision · ' + item.cat),
      photo(item), h('p', { class: 'nom' }, item.nom),
      h('p', { class: 'consigne' }, 'À quel pays cette curiosité est-elle rattachée ?'),
      h('div', { class: 'choix' }, boutons), suite);
  }

  // Épreuve 2 — « L'intruse ».
  function epreuveIntrus(epreuve, partiel, memoriser, conclure) {
    var faux = partiel && Array.isArray(partiel.faux) ? partiel.faux.slice() : [];
    var fini = false;
    var suite = h('div', { 'aria-live': 'polite' });
    var encore = function () {
      return h('p', { class: 'verdict moyen' }, 'Non, celle-ci vient bien du même pays que deux autres. Encore un essai.');
    };
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
        var points = C.pointsParEssais(essais, juste);
        var intrus = ITEMS[epreuve.intrus];
        remplacer(suite,
          h('p', { class: 'verdict ' + (juste ? (essais === 1 ? 'bon' : 'moyen') : 'mauvais') },
            (juste ? (essais === 1 ? 'Du premier coup. ' : 'Trouvé au deuxième essai. ') : 'Manqué. ') +
            'L\'intruse était « ' + intrus.nom + ' » (' + pays(epreuve.paysIntrus) + ') ; les trois autres viennent de : ' +
            pays(epreuve.paysTrio) + '. +' + points + ' points'),
          savoir(intrus), conclure(points));
      } }, h('img', { src: item.img, alt: '', width: 280, height: 210 }), h('span', {}, item.nom));
      if (faux.indexOf(id) >= 0) { carte.classList.add('fausse'); carte.disabled = true; }
      return carte;
    });
    if (faux.length) remplacer(suite, encore());
    return h('section', { class: 'carte' },
      h('span', { class: 'etiquette' }, 'L\'intruse'),
      h('p', { class: 'consigne' }, 'Trois de ces curiosités viennent du même pays. Laquelle vient d\'ailleurs ?'),
      h('div', { class: 'grille' }, cartes), suite);
  }

  // Épreuve 3 — « Les liens » : quatre curiosités, cinq pays, donc un pays en trop.
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
        ligne.attribue.textContent = choix[id] ? pays(choix[id]) : 'Pays à choisir';
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
    var bValider = bouton('Valider', function () {
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
        ligne.attribue.textContent = juste ? '✓ ' + pays(item.pays) : '✗ ' + pays(choix[id]) + ' → ' + pays(item.pays);
      });
      epreuve.pays.forEach(function (code) { puces[code].disabled = true; });
      var points = C.pointsLiens(justes);
      bValider.remove();
      rafraichir();
      remplacer(suite,
        h('p', { class: 'verdict ' + (justes === 4 ? 'bon' : justes > 0 ? 'moyen' : 'mauvais') },
          (justes === 4 ? 'Tout juste. ' : justes + ' sur 4. ') + 'Le pays en trop était : ' + pays(epreuve.paysEnTrop) + '. +' + points + ' points'),
        epreuve.items.map(function (id) {
          return h('p', { class: 'fait petit' }, h('b', {}, ITEMS[id].nom + ' (' + pays(ITEMS[id].pays) + ') : '), ITEMS[id].fait);
        }),
        h('p', { class: 'credit' }, 'Photos : ', epreuve.items.map(function (id, n) {
          return [n ? ' · ' : '', h('a', { href: ITEMS[id].credit.page, target: '_blank', rel: 'noopener' },
            ITEMS[id].credit.auteur + ' (' + ITEMS[id].credit.licence + ')')];
        })),
        conclure(points));
    });
    var rangs = epreuve.items.map(function (id) {
      var item = ITEMS[id];
      var attribue = h('span', { class: 'attribue vide' }, 'Pays à choisir');
      var b = h('button', { type: 'button', class: 'lien', 'aria-pressed': 'false', onclick: function () {
        if (fini) return;
        actif = id;
        rafraichir();
      } }, h('img', { src: item.img, alt: '', width: 72, height: 72 }), h('span', { class: 'lien-texte' }, h('b', {}, item.nom), attribue));
      lignes[id] = { bouton: b, attribue: attribue };
      return b;
    });
    var listePays = h('div', { class: 'puces', role: 'group', 'aria-label': 'Pays à attribuer à la curiosité sélectionnée' },
      epreuve.pays.map(function (code) {
        return (puces[code] = h('button', { type: 'button', class: 'puce', onclick: function () { attribuer(code); } }, pays(code)));
      }));
    rafraichir();
    return h('section', { class: 'carte' },
      h('span', { class: 'etiquette' }, 'Les liens'),
      h('p', { class: 'consigne' }, 'Donnez son pays à chaque curiosité. Attention : il y a un pays en trop.'),
      rangs, h('p', { class: 'petit doux', style: 'margin:12px 0 6px' }, 'Touchez une curiosité, puis son pays.'), listePays, bValider, suite);
  }

  // ---------- Atlas ----------
  function vueAtlas() {
    var bilan = C.bilanAtlas(etat, D);
    var continents = {};
    Object.keys(D.pays).forEach(function (code) { (continents[continent(code)] = continents[continent(code)] || []).push(code); });
    var blocs = [h('section', { class: 'carte' }, h('h1', {}, 'Mon atlas'),
      h('p', {}, bilan.decouverts + ' pays découverts sur ' + bilan.total + ', dont ' + bilan.connus + ' connus et ' + bilan.maitrises + ' maîtrisés.'),
      h('div', { class: 'jauge', role: 'img', 'aria-label': bilan.decouverts + ' pays sur ' + bilan.total },
        h('i', { style: 'width:' + Math.round(100 * bilan.decouverts / bilan.total) + '%' })),
      h('p', { class: 'petit doux' }, 'Découvert : 1 bonne réponse. Connu : 3, sur au moins 2 curiosités différentes. Maîtrisé : 6, sur au moins 3 curiosités différentes, avec au moins 3 bonnes réponses sur 4. Une réponse compte quand elle est trouvée sans aide : avant que le nom soit donné, ou du premier coup.'))];
    Object.keys(continents).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).forEach(function (nom) {
      var codes = continents[nom].sort(function (a, b) { return pays(a).localeCompare(pays(b), 'fr'); });
      blocs.push(h('section', { class: 'carte' }, h('h2', {}, nom), codes.map(function (code) {
        var fiche = etat.atlas[code];
        var n = C.niveau(fiche);
        return h('div', { class: 'pays' },
          h('span', {}, h('b', {}, pays(code)), fiche ? h('span', { class: 'petit doux' }, '  ' + fiche.ok + ' sur ' + fiche.vu) : null),
          h('span', { class: 'niveau n' + n }, C.NIVEAUX[n]));
      })));
    });
    return blocs;
  }

  // ---------- Album ----------
  function vueAlbum() {
    var obtenues = D.items.filter(function (i) { return etat.album[i.id] !== undefined; }).length;
    var fiche = h('div', { 'aria-live': 'polite' });
    function ouvrir(item) {
      remplacer(fiche, h('section', { class: 'carte' }, h('span', { class: 'etiquette' }, item.cat + ' · ' + pays(item.pays)),
        photo(item), h('p', { class: 'nom' }, item.nom), savoir(item),
        bouton('Fermer la fiche', function () { remplacer(fiche); }, 'secondaire')));
      window.scrollTo(0, 0);
    }
    var blocs = [h('section', { class: 'carte' }, h('h1', {}, 'Mon album'),
      h('p', {}, obtenues + ' curiosités sur ' + D.items.length + '.'),
      h('div', { class: 'jauge', role: 'img', 'aria-label': obtenues + ' curiosités sur ' + D.items.length },
        h('i', { style: 'width:' + Math.round(100 * obtenues / D.items.length) + '%' })),
      h('p', { class: 'petit doux' }, 'Chaque curiosité rencontrée dans un défi entre dans votre album, avec sa fiche. Touchez-en une pour la relire.')), fiche];
    CATEGORIES.forEach(function (cat) {
      var liste = D.items.filter(function (i) { return i.cat === cat; });
      if (!liste.length) return;
      var eues = liste.filter(function (i) { return etat.album[i.id] !== undefined; })
        .sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
      var manquantes = liste.length - eues.length;
      blocs.push(h('section', { class: 'carte' }, h('h2', {}, PLURIELS[cat] + ' · ' + eues.length + ' sur ' + liste.length),
        h('div', { class: 'album' },
          eues.map(function (item) {
            return h('button', { type: 'button', class: 'case', onclick: function () { ouvrir(item); } },
              h('img', { src: item.img, alt: '', loading: 'lazy', width: 120, height: 90 }), h('span', {}, item.nom));
          }),
          manquantes > 0 ? h('div', { class: 'case vide' }, h('b', {}, '?'), h('span', {}, pluriel(manquantes, 'à découvrir', 'à découvrir'))) : null)));
    });
    return blocs;
  }

  // ---------- Révision ----------
  function vueRevision() {
    var toutes = C.toutesARevoir(etat, JOUR);
    var liste = C.aRevoir(etat, JOUR);
    var enAttente = Object.keys(etat.revision).length;
    if (liste.length === 0) {
      return [h('section', { class: 'carte' }, h('h1', {}, 'Révision'),
        h('p', {}, 'Rien à revoir aujourd\'hui.'),
        h('p', { class: 'doux' }, enAttente > 0
          ? (enAttente > 1 ? enAttente + ' curiosités manquées reviendront' : 'Une curiosité manquée reviendra') + ' dans les prochains jours.'
          : 'Les curiosités que vous manquez dans le défi reviennent ici le lendemain, puis 3 jours et 7 jours après, jusqu\'à ce que vous les connaissiez.'),
        h('p', { class: 'petit doux' }, 'La révision ne change pas votre score du jour, mais elle fait progresser votre atlas.'))];
    }
    var position = 0;
    var justes = 0;
    var cadre = h('div', {});
    function suivante() {
      if (position >= liste.length) {
        majEntete();
        var reste = C.toutesARevoir(etat, JOUR).length;
        remplacer(cadre, h('section', { class: 'carte centre' }, h('h1', {}, 'Révision terminée'),
          h('p', {}, justes + ' sur ' + liste.length + (justes === liste.length ? ', tout est revenu.' : '. Les autres reviendront demain.')),
          reste > 0 ? bouton('Continuer (' + reste + ' de plus)', function () { afficher('revision'); }) : null,
          bouton('Voir mon atlas', function () { afficher('atlas'); }, 'secondaire')));
        return;
      }
      var item = ITEMS[liste[position]];
      remplacer(cadre, h('p', { class: 'petit doux' }, 'Révision ' + (position + 1) + ' sur ' + liste.length +
          (toutes.length > liste.length ? ' (' + (toutes.length - liste.length) + ' autres ensuite)' : '')),
        questionSimple(C.questionRevision(D, item, JOUR), function (juste) {
          if (juste) justes += 1;
          C.noterReponse(etat, item.id, item.pays, juste, JOUR);
          sauver();
        }, function () {
          position += 1;
          return bouton(position >= liste.length ? 'Terminer' : 'Suivante', function () { suivante(); window.scrollTo(0, 0); });
        }));
    }
    suivante();
    return [cadre];
  }

  // ---------- Règles, sauvegarde, crédits ----------
  function restaurer(lu) {
    // Ce qui a été joué aujourd'hui sur cet appareil est conservé : restaurer un code ne permet pas de rejouer.
    var duJour = etat.jours[JOUR];
    if (duJour && !lu.jours[JOUR]) C.terminerJour(lu, JOUR, duJour.scores);
    else if (!lu.jours[JOUR] && etat.enCours && etat.enCours.jour === JOUR) lu.enCours = etat.enCours;
    etat = lu;
    sauver();
  }
  function vueRegles() {
    var code = h('textarea', { rows: 3, readonly: true, 'aria-label': 'Code de sauvegarde' }, C.coderSauvegarde(etat, versBase64));
    var saisie = h('input', { type: 'text', placeholder: 'Collez ici un code de sauvegarde', 'aria-label': 'Code à restaurer' });
    var retour = h('p', { class: 'petit', 'aria-live': 'polite' });
    var bCopier = bouton('Copier mon code', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code.value).then(function () { bCopier.textContent = 'Code copié'; noterCodeCopie(); }, function () { code.select(); });
      } else code.select();
    }, 'secondaire');
    var credits = h('details', {}, h('summary', {}, 'Crédits des ' + D.items.length + ' photos'));
    credits.addEventListener('toggle', function () {
      if (!credits.open || credits.querySelector('ul')) return;
      credits.appendChild(h('ul', { class: 'credits-liste' }, D.items.map(function (item) {
        return h('li', {}, item.nom + ' : ' + item.credit.auteur + ', ' + item.credit.licence + ', ',
          h('a', { href: item.credit.page, target: '_blank', rel: 'noopener' }, 'source'));
      })));
    });
    return [
      h('section', { class: 'carte' }, h('h1', {}, 'Règles'),
        h('ul', { class: 'regles' },
          h('li', {}, 'Un défi par jour, le même pour tout le monde. Il change à minuit, heure de votre appareil.'),
          h('li', {}, 'La semaine monte en difficulté : facile le lundi et le mardi, difficile le samedi, grand défi le dimanche.'),
          h('li', {}, h('b', {}, 'D\'où ça vient ? '), 'Quatre indices pour retrouver le pays : un détail de la photo (100 points), la photo entière (70), le nom (40), puis quatre pays au choix (20). Après chaque erreur, le jeu vous dit si vous êtes sur le bon continent.'),
          h('li', {}, h('b', {}, 'L\'intruse. '), 'Trois curiosités viennent du même pays, la quatrième d\'un pays du même continent. 100 points du premier coup, 50 au deuxième essai.'),
          h('li', {}, h('b', {}, 'Les liens. '), 'Quatre curiosités, cinq pays, donc un pays en trop. 100 points pour quatre liens justes, 70 pour trois, 45 pour deux, 20 pour un.'),
          h('li', {}, 'Jouer chaque jour allonge votre série. À partir de deux jours d\'affilée, un jour manqué est pardonné, une fois tous les sept jours.'),
          h('li', {}, 'Une curiosité est rattachée au pays où elle est née ou auquel elle est le plus associée. La réponse attendue est celle de l\'article Wikipédia indiqué après chaque épreuve.')),
        h('p', { class: 'petit doux' }, 'Le jeu couvre ' + Object.keys(D.pays).length + ' pays et ' + D.items.length + ' curiosités. Une erreur ? Chaque réponse renvoie à sa source. ', signaler(null))),
      h('section', { class: 'carte' }, h('h2', {}, 'Sauvegarde'),
        h('p', { class: 'doux' }, 'Aucun compte : votre série, votre atlas et votre album restent sur cet appareil. Pour changer de téléphone ou éviter de les perdre, gardez ce code.'),
        code, bCopier,
        h('p', { style: 'margin-top:16px' }, saisie),
        bouton('Restaurer ce code', function () {
          var lu = C.decoderSauvegarde(saisie.value, depuisBase64);
          if (!lu) { retour.textContent = 'Ce code n\'est pas valide.'; return; }
          if (!window.confirm('Remplacer la progression de cet appareil par celle du code ?')) return;
          restaurer(lu);
          afficher('accueil');
        }, 'secondaire'), retour),
      h('section', { class: 'carte' }, h('h2', {}, 'Sources et vie privée'),
        h('p', {}, 'Les textes renvoient aux articles de Wikipédia en français. Les photos viennent de Wikimedia Commons, sous licence libre.'),
        h('p', {}, 'Le jeu ne demande aucun compte : votre progression reste dans votre navigateur.'),
        credits)
    ];
  }

  if (ESSAI !== null) {
    document.body.insertBefore(h('div', { class: 'essai' }, 'Ancien défi n° ' + (ESSAI + 1) + ', hors série : rien n\'est enregistré. ',
      h('a', { href: location.pathname }, 'Revenir au défi du jour')), document.body.firstChild);
    document.querySelector('.barre').hidden = true;
  }
  afficher('accueil');
})();
