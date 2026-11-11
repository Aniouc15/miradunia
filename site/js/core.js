/* GlobeCurios — règles du jeu, sans affichage. Utilisable dans le navigateur et dans Node (tests). */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.GCCore = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LANCEMENT = [2026, 10, 11]; // 11 novembre 2026 (mois compté à partir de 0) = défi n° 1
  var DELAIS_REVISION = [1, 3, 7]; // jours avant de revoir une curiosité ratée, selon sa boîte
  var MAX_REVISION = 5;
  var JOKER_TOUS_LES = 7;
  var POINTS_ORIGINE = [100, 70, 40, 20]; // selon le nombre d'indices utilisés
  var POINTS_LIENS = [0, 20, 45, 70, 100]; // selon le nombre de liens justes sur 4
  var NIVEAU_PAR_JOUR = [3, 1, 1, 2, 2, 2, 3]; // dimanche, lundi … samedi
  var NOMS_NIVEAUX = ['', 'facile', 'moyen', 'difficile'];

  // ---------- Hasard reproductible : le même jour donne le même défi à tout le monde ----------
  function hacher(texte) {
    var h = 2166136261;
    for (var i = 0; i < texte.length; i++) {
      h ^= texte.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function generateur(graine) {
    var a = hacher(String(graine));
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function melanger(liste, hasard) {
    var copie = liste.slice();
    for (var i = copie.length - 1; i > 0; i--) {
      var j = Math.floor(hasard() * (i + 1));
      var tmp = copie[i]; copie[i] = copie[j]; copie[j] = tmp;
    }
    return copie;
  }
  function tirer(liste, hasard) { return liste[Math.floor(hasard() * liste.length)]; }

  // ---------- Calendrier ----------
  function indexDuJour(date) {
    var d = date || new Date();
    var aujourdHui = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    var debut = Date.UTC(LANCEMENT[0], LANCEMENT[1], LANCEMENT[2]);
    return Math.round((aujourdHui - debut) / 86400000);
  }
  function numeroDuJour(jour) { return jour + 1; }
  function secondesAvantDemain(date) {
    var d = date || new Date();
    var demain = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return Math.max(0, Math.round((demain - d) / 1000));
  }
  function jourDeSemaine(jour) {
    return new Date(Date.UTC(LANCEMENT[0], LANCEMENT[1], LANCEMENT[2]) + jour * 86400000).getUTCDay();
  }
  // La semaine monte en difficulté : lundi et mardi faciles, puis moyen, samedi et dimanche difficiles.
  function niveauDuJour(jour) { return NIVEAU_PAR_JOUR[jourDeSemaine(jour)]; }
  function estDimanche(jour) { return jourDeSemaine(jour) === 0; }
  // Combien de jours du même niveau ont précédé celui-ci depuis le lancement.
  function rangDansNiveau(jour) {
    var niveau = niveauDuJour(jour);
    var parSemaine = NIVEAU_PAR_JOUR.filter(function (n) { return n === niveau; }).length;
    var semaines = Math.floor(jour / 7);
    var rang = semaines * parSemaine;
    for (var j = semaines * 7; j < jour; j++) if (niveauDuJour(j) === niveau) rang += 1;
    return rang;
  }

  // ---------- Construction du défi ----------
  function parPays(donnees) {
    var index = {};
    donnees.items.forEach(function (item) { (index[item.pays] = index[item.pays] || []).push(item); });
    return index;
  }
  // Pays proposés à tort : de préférence sur le même continent, pour que la question reste intéressante.
  function fauxPays(donnees, bonPays, combien, hasard, exclus) {
    var interdits = (exclus || []).concat([bonPays]);
    var codes = Object.keys(donnees.pays).filter(function (c) { return interdits.indexOf(c) < 0; });
    var continent = donnees.pays[bonPays].continent;
    var proches = melanger(codes.filter(function (c) { return donnees.pays[c].continent === continent; }), hasard);
    var lointains = melanger(codes.filter(function (c) { return donnees.pays[c].continent !== continent; }), hasard);
    return proches.concat(lointains).slice(0, combien);
  }
  // Curiosité vedette : tirée parmi celles du niveau du jour, sans répétition avant d'avoir épuisé le niveau.
  function vedetteDuJour(donnees, jour) {
    var niveau = niveauDuJour(jour);
    var bassin = donnees.items.filter(function (i) { return i.niv === niveau; })
      .sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    var rang = rangDansNiveau(jour);
    var cycle = Math.floor(rang / bassin.length);
    var ordre = melanger(bassin, generateur('globecurios-vedette-' + niveau + '-' + cycle));
    return ordre[((rang % bassin.length) + bassin.length) % bassin.length];
  }
  function quatreChoix(donnees, item, hasard) {
    return melanger([item.pays].concat(fauxPays(donnees, item.pays, 3, hasard)), hasard);
  }
  // Question de révision : toujours les mêmes choix pour une curiosité un jour donné (recharger n'apprend rien).
  function questionRevision(donnees, item, jour) {
    return { item: item.id, options: quatreChoix(donnees, item, generateur('globecurios-revision-' + item.id + '-' + jour)) };
  }
  // Les défis sont construits par blocs de 14 jours : dans un bloc, aucune curiosité ne revient deux fois.
  var BLOC = 14;
  function construireDefi(donnees, jour) {
    var debut = Math.floor(jour / BLOC) * BLOC;
    var reservees = {}; // vedettes du bloc : elles ne servent pas dans les autres épreuves
    for (var v = debut; v < debut + BLOC; v++) reservees[vedetteDuJour(donnees, v).id] = true;
    var vues = {};
    var defi = null;
    for (var j = debut; j <= jour; j++) {
      defi = construireUnDefi(donnees, j, function (item) { return !vues[item.id] && !reservees[item.id]; });
      defi.epreuves[1].cartes.concat(defi.epreuves[2].items).forEach(function (id) { vues[id] = true; });
    }
    return defi;
  }
  function construireUnDefi(donnees, jour, neuve) {
    var hasard = generateur('globecurios-jour-' + jour);
    var index = parPays(donnees);
    // Curiosités d'un pays pas encore vues dans le bloc ; à défaut, toutes celles du pays.
    var neuves = function (code, minimum) {
      var liste = index[code].filter(neuve);
      return liste.length >= minimum ? liste : index[code];
    };
    var aDuNeuf = function (code, minimum) { return index[code].filter(neuve).length >= minimum; };
    var dePreference = function (codes, minimum) {
      var bons = codes.filter(function (c) { return aDuNeuf(c, minimum); });
      return bons.length ? bons : codes;
    };

    // Épreuve 1 : la vedette, à retrouver avec le moins d'indices possible.
    var vedette = vedetteDuJour(donnees, jour);
    var origine = { type: 'origine', item: vedette.id, options: quatreChoix(donnees, vedette, hasard) };

    // Épreuve 2 : trois curiosités du même pays et une intruse venue d'un pays du même continent.
    var memeContinent = function (a, b) { return donnees.pays[a].continent === donnees.pays[b].continent; };
    var possibles = Object.keys(index).filter(function (c) { return c !== vedette.pays && index[c].length >= 3; });
    // De préférence un pays qui a trois curiosités neuves et un voisin de continent qui en a une.
    var ideaux = possibles.filter(function (c) {
      return aDuNeuf(c, 3) && Object.keys(index).some(function (v) {
        return v !== c && v !== vedette.pays && memeContinent(v, c) && aDuNeuf(v, 1);
      });
    });
    var paysTrio = tirer(ideaux.length ? ideaux : dePreference(possibles, 3), hasard);
    var trio = melanger(neuves(paysTrio, 3), hasard).slice(0, 3);
    var voisins = fauxPays(donnees, paysTrio, 1000, hasard, [vedette.pays]);
    var voisinsProches = voisins.filter(function (c) { return memeContinent(c, paysTrio); });
    var paysIntrus = dePreference(voisinsProches.length ? voisinsProches : voisins, 1)[0];
    var intrus = tirer(neuves(paysIntrus, 1), hasard);
    var cartes = melanger(trio.concat([intrus]), hasard).map(function (i) { return i.id; });

    // Épreuve 3 : quatre curiosités pour cinq pays (un pays en trop), sur deux continents.
    var pris = [vedette.pays, paysTrio, paysIntrus];
    var horsPris = Object.keys(index).filter(function (c) { return pris.indexOf(c) < 0; });
    var avecDuNeuf = horsPris.filter(function (c) { return aDuNeuf(c, 1); });
    var libres = melanger(avecDuNeuf.length >= 12 ? avecDuNeuf : horsPris, hasard);
    var premier = libres[0];
    var groupeA =[premier].concat(libres.filter(function (c) { return c !== premier && memeContinent(c, premier); }).slice(0, 2));
    var ailleurs = libres.filter(function (c) { return !memeContinent(c, premier); });
    var groupeB = ailleurs.length ? [ailleurs[0]].concat(ailleurs.filter(function (c) {
      return c !== ailleurs[0] && memeContinent(c, ailleurs[0]);
    }).slice(0, 1)) : [];
    var cinq = groupeA.concat(groupeB);
    libres.forEach(function (c) { if (cinq.length < 5 && cinq.indexOf(c) < 0) cinq.push(c); });
    cinq = melanger(cinq, hasard);
    var paysEnTrop = cinq[0];
    var aRelier = cinq.slice(1).map(function (c) { return tirer(neuves(c, 1), hasard).id; });

    return {
      jour: jour,
      niveau: niveauDuJour(jour),
      epreuves: [
        origine,
        { type: 'intrus', cartes: cartes, intrus: intrus.id, paysTrio: paysTrio, paysIntrus: paysIntrus },
        { type: 'liens', items: melanger(aRelier, hasard), pays: melanger(cinq, hasard), paysEnTrop: paysEnTrop }
      ]
    };
  }

  // ---------- Points ----------
  function pointsOrigine(tentative, reussi) {
    return reussi ? (POINTS_ORIGINE[tentative - 1] || 0) : 0;
  }
  function pointsParEssais(essais, reussi) {
    if (!reussi) return 0;
    return essais === 1 ? 100 : 50;
  }
  function pointsLiens(nbJustes) { return POINTS_LIENS[Math.max(0, Math.min(4, nbJustes))]; }

  // ---------- État du joueur ----------
  function nouvelEtat() {
    return { v: 1, jours: {}, enCours: null, serie: 0, meilleureSerie: 0, dernierJour: null,
      jokerLe: null, atlas: {}, revision: {}, album: {} };
  }
  function estObjet(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function estEntier(x) { return typeof x === 'number' && isFinite(x) && Math.floor(x) === x; }
  // Vérifie un état lu dans le navigateur ou dans un code de sauvegarde, et complète les champs récents.
  function etatValide(e) {
    if (!estObjet(e) || e.v !== 1) return null;
    if (!estObjet(e.jours) || !estObjet(e.atlas) || !estObjet(e.revision)) return null;
    if (e.album === undefined) e.album = {};
    if (!estObjet(e.album)) return null;
    if (!estEntier(e.serie) || e.serie < 0 || !estEntier(e.meilleureSerie) || e.meilleureSerie < e.serie) return null;
    if (e.dernierJour !== null && !estEntier(e.dernierJour)) return null;
    if (e.jokerLe !== null && !estEntier(e.jokerLe)) return null;
    if (e.serie > Object.keys(e.jours).length + 60) return null;
    var correct = Object.keys(e.jours).every(function (j) {
      var d = e.jours[j];
      return estObjet(d) && Array.isArray(d.scores) && d.scores.length === 3 && estEntier(d.total) &&
        d.scores.every(function (s) { return estEntier(s) && s >= 0 && s <= 100; });
    }) && Object.keys(e.atlas).every(function (c) {
      var f = e.atlas[c];
      return estObjet(f) && estEntier(f.vu) && estEntier(f.ok) && f.ok >= 0 && f.ok <= f.vu &&
        (f.d === undefined || (Array.isArray(f.d) && f.d.length <= f.ok));
    }) && Object.keys(e.revision).every(function (id) {
      var r = e.revision[id];
      return estObjet(r) && estEntier(r.boite) && estEntier(r.le);
    });
    if (!correct) return null;
    if (e.enCours !== null && e.enCours !== undefined) {
      var c = e.enCours;
      if (!estObjet(c) || !estEntier(c.jour) || !estEntier(c.index) || !Array.isArray(c.scores)) return null;
    } else {
      e.enCours = null;
    }
    return e;
  }
  // Enregistre une réponse : atlas, album, et liste de révision si la curiosité a été ratée.
  function noterReponse(etat, itemId, pays, juste, jour, sansRevision) {
    var fiche = etat.atlas[pays] || (etat.atlas[pays] = { vu: 0, ok: 0 });
    fiche.vu += 1;
    if (juste) {
      fiche.ok += 1;
      // Curiosités différentes reconnues : revoir dix fois la même ne suffit pas à connaître un pays.
      if (!fiche.d) fiche.d = [];
      if (fiche.d.indexOf(itemId) < 0) fiche.d.push(itemId);
    }
    if (etat.album[itemId] === undefined) etat.album[itemId] = jour;
    if (sansRevision) return;
    var suivi = etat.revision[itemId];
    if (!juste) {
      etat.revision[itemId] = { boite: 0, le: jour + DELAIS_REVISION[0] };
    } else if (suivi) {
      var boite = suivi.boite + 1;
      if (boite >= DELAIS_REVISION.length) delete etat.revision[itemId];
      else etat.revision[itemId] = { boite: boite, le: jour + DELAIS_REVISION[boite] };
    }
  }
  function toutesARevoir(etat, jour) {
    return Object.keys(etat.revision)
      .filter(function (id) { return etat.revision[id].le <= jour; })
      .sort(function (a, b) { return etat.revision[a].le - etat.revision[b].le || (a < b ? -1 : 1); });
  }
  function aRevoir(etat, jour) { return toutesARevoir(etat, jour).slice(0, MAX_REVISION); }
  function jokerDisponible(etat, jour) {
    return etat.jokerLe === null || jour - etat.jokerLe >= JOKER_TOUS_LES;
  }
  // Clôt le défi du jour et met la série à jour. Un jour manqué est pardonné une fois tous les 7 jours (joker).
  function terminerJour(etat, jour, scores) {
    if (etat.jours[jour]) return { dejaFait: true, joker: false };
    var joker = false;
    etat.jours[jour] = { scores: scores.slice(), total: scores.reduce(function (a, b) { return a + b; }, 0) };
    etat.enCours = null;
    // Un jour antérieur au dernier jour joué (horloge reculée, voyage) est enregistré sans toucher à la série.
    if (etat.dernierJour !== null && jour <= etat.dernierJour) return { dejaFait: false, joker: false };
    if (etat.dernierJour === jour - 1) {
      etat.serie += 1;
    } else if (etat.dernierJour === jour - 2 && etat.serie >= 2 && jokerDisponible(etat, jour)) {
      etat.serie += 1;
      etat.jokerLe = jour;
      joker = true;
    } else {
      etat.serie = 1;
    }
    etat.dernierJour = jour;
    etat.meilleureSerie = Math.max(etat.meilleureSerie, etat.serie);
    return { dejaFait: false, joker: joker };
  }
  // Série affichée : elle retombe à zéro si le joueur a laissé passer trop de jours.
  function serieActuelle(etat, jour) {
    if (etat.dernierJour === null) return 0;
    var ecart = jour - etat.dernierJour;
    if (ecart <= 1) return etat.serie;
    if (ecart === 2 && etat.serie >= 2 && jokerDisponible(etat, jour)) return etat.serie;
    return 0;
  }

  // ---------- Atlas, statistiques, anciens défis ----------
  var NIVEAUX = ['Inconnu', 'Découvert', 'Connu', 'Maîtrisé'];
  function niveau(fiche) {
    if (!fiche || fiche.ok < 1) return 0;
    var differentes = (fiche.d || []).length;
    if (fiche.ok >= 6 && fiche.ok / fiche.vu >= 0.75 && differentes >= 3) return 3;
    if (fiche.ok >= 3 && differentes >= 2) return 2;
    return 1;
  }
  function bilanAtlas(etat, donnees) {
    var bilan = { total: Object.keys(donnees.pays).length, decouverts: 0, connus: 0, maitrises: 0 };
    Object.keys(donnees.pays).forEach(function (code) {
      var n = niveau(etat.atlas[code]);
      if (n >= 1) bilan.decouverts += 1;
      if (n >= 2) bilan.connus += 1;
      if (n >= 3) bilan.maitrises += 1;
    });
    return bilan;
  }
  function statistiques(etat) {
    var jours = Object.keys(etat.jours).map(Number).sort(function (a, b) { return b - a; });
    var totaux = jours.map(function (j) { return etat.jours[j].total; });
    var moyenne = function (liste) {
      return liste.length ? Math.round(liste.reduce(function (a, b) { return a + b; }, 0) / liste.length) : 0;
    };
    var repartition = [0, 0, 0, 0]; // moins de 100, 100 à 199, 200 à 299, 300
    totaux.forEach(function (t) { repartition[t >= 300 ? 3 : t >= 200 ? 2 : t >= 100 ? 1 : 0] += 1; });
    return { parties: totaux.length, moyenne: moyenne(totaux), moyenne7: moyenne(totaux.slice(0, 7)),
      meilleur: totaux.length ? Math.max.apply(null, totaux) : 0, repartition: repartition };
  }
  // Défis passés que le joueur n'a pas faits : il peut les rejouer hors série.
  function joursRejouables(etat, jour, combien) {
    var liste = [];
    for (var j = jour - 1; j >= 0 && liste.length < combien; j--) if (!etat.jours[j]) liste.push(j);
    return liste;
  }

  // ---------- Partage et sauvegarde ----------
  function carres(scores) {
    return scores.map(function (s) { return s >= 100 ? '🟩' : s > 0 ? '🟨' : '🟥'; }).join('');
  }
  function carresEnMots(scores) {
    return scores.map(function (s, n) {
      return 'épreuve ' + (n + 1) + ' : ' + (s >= 100 ? 'réussie' : s > 0 ? 'en partie réussie' : 'manquée');
    }).join(', ');
  }
  var NOMS_EPREUVES = ['D\'où ça vient ?', 'L\'intruse', 'Les liens'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function dateDuDefi(jour) {
    var d = new Date(Date.UTC(LANCEMENT[0], LANCEMENT[1], LANCEMENT[2]) + jour * 86400000);
    return (d.getUTCDate() === 1 ? '1er' : d.getUTCDate()) + ' ' + MOIS[d.getUTCMonth()];
  }
  // Une ligne par épreuve, sans rien révéler des réponses : lisible même sans connaître le jeu.
  function texteDePartage(jour, scores, serie) {
    var total = scores.reduce(function (a, b) { return a + b; }, 0);
    return 'GlobeCurios n° ' + numeroDuJour(jour) + ' · ' + dateDuDefi(jour) + ' — ' + total + '/300\n' +
      scores.map(function (s, n) { return carres([s]) + ' ' + NOMS_EPREUVES[n] + ' ' + s; }).join('\n') +
      (serie > 1 ? '\nSérie : ' + serie + ' jours' : '') + '\nÀ vous de jouer : globecurious.com';
  }
  function coderSauvegarde(etat, versBase64) { return 'GC1.' + versBase64(JSON.stringify(etat)); }
  function decoderSauvegarde(code, depuisBase64) {
    var texte = String(code || '').trim();
    if (texte.indexOf('GC1.') !== 0) return null;
    try { return etatValide(JSON.parse(depuisBase64(texte.slice(4)))); } catch (e) { return null; }
  }

  return {
    DELAIS_REVISION: DELAIS_REVISION, MAX_REVISION: MAX_REVISION, NIVEAUX: NIVEAUX, NOMS_NIVEAUX: NOMS_NIVEAUX,
    POINTS_ORIGINE: POINTS_ORIGINE, POINTS_LIENS: POINTS_LIENS,
    generateur: generateur, melanger: melanger, indexDuJour: indexDuJour, numeroDuJour: numeroDuJour,
    secondesAvantDemain: secondesAvantDemain, BLOC: BLOC, niveauDuJour: niveauDuJour, estDimanche: estDimanche,
    construireDefi: construireDefi, questionRevision: questionRevision,
    pointsOrigine: pointsOrigine, pointsParEssais: pointsParEssais, pointsLiens: pointsLiens,
    nouvelEtat: nouvelEtat, etatValide: etatValide, noterReponse: noterReponse,
    aRevoir: aRevoir, toutesARevoir: toutesARevoir, jokerDisponible: jokerDisponible,
    terminerJour: terminerJour, serieActuelle: serieActuelle, niveau: niveau, bilanAtlas: bilanAtlas,
    statistiques: statistiques, joursRejouables: joursRejouables,
    carres: carres, carresEnMots: carresEnMots, texteDePartage: texteDePartage,
    coderSauvegarde: coderSauvegarde, decoderSauvegarde: decoderSauvegarde
  };
});
