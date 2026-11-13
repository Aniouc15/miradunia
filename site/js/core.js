/* Règles du jeu, sans affichage ni texte : les mêmes dans toutes les langues. Utilisable dans le navigateur et dans Node (tests). */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.GCCore = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LANCEMENT = [2026, 10, 11]; // 11 novembre 2026 (mois compté à partir de 0) = défi n° 1
  var DELAIS_REVISION = [1, 3, 7]; // jours avant de revoir une curiosité ratée, selon sa boîte
  var MAX_REVISION = 5;
  var POINTS_ORIGINE = [100, 70, 40, 20]; // selon le nombre d'indices utilisés
  var POINTS_LIENS = [0, 20, 45, 70, 100]; // selon le nombre de liens justes sur 4
  var NIVEAU_PAR_JOUR = [3, 1, 1, 2, 2, 2, 3]; // dimanche, lundi … samedi (1 facile, 2 moyen, 3 difficile)

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
  // Les défis sont construits par blocs de 14 jours : dans un bloc, aucune curiosité ne revient deux fois.
  var BLOC = 14;
  // Niveaux des curiosités admises dans « L'intruse » et « Les liens », selon le niveau du jour :
  // en semaine, rien de difficile ; le week-end, rien de facile.
  var NIVEAUX_ADMIS = { 1: [1, 2], 2: [1, 2], 3: [2, 3] };

  // Les curiosités arrivent par vagues (« versions ») : une vague n'entre dans les défis qu'au début d'un bloc
  // postérieur à sa mise en ligne. Ainsi un ajout ne change ni le défi du jour ni les anciens défis.
  // donnees.versions = [[premier jour, numéro], …] ; item.v = numéro de sa vague (0 si absent).
  function versionDuJour(donnees, jour) {
    var debut = Math.floor(jour / BLOC) * BLOC, v = 0;
    (donnees.versions || []).forEach(function (p) { if (p[0] <= debut && p[1] > v) v = p[1]; });
    return v;
  }
  var vues = { source: null, parVersion: {} };
  function donneesDuJour(donnees, jour) {
    if (!donnees.versions || !donnees.versions.length) return donnees;
    if (vues.source !== donnees) vues = { source: donnees, parVersion: {} };
    var v = versionDuJour(donnees, jour);
    if (!vues.parVersion[v]) {
      vues.parVersion[v] = { pays: donnees.pays, items: donnees.items.filter(function (i) { return (i.v || 0) <= v; }) };
    }
    return vues.parVersion[v];
  }
  // Index par pays et bassins par niveau, calculés une seule fois par jeu de données.
  var PREP = typeof Symbol === 'function' ? Symbol('preparation') : '__preparation';
  function preparer(donnees) {
    if (!donnees[PREP]) {
      var index = {};
      var bassins = { 1: [], 2: [], 3: [] };
      donnees.items.forEach(function (item) {
        (index[item.pays] = index[item.pays] || []).push(item);
        if (bassins[item.niv]) bassins[item.niv].push(item);
      });
      [1, 2, 3].forEach(function (n) {
        bassins[n].sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
      });
      Object.defineProperty(donnees, PREP, { value: { index: index, codes: Object.keys(index), bassins: bassins, ordres: {}, bloc: null } });
    }
    return donnees[PREP];
  }
  // Pays proposés à tort : de préférence sur le même continent, pour que la question reste intéressante.
  function fauxPays(donnees, bonPays, combien, hasard, exclus) {
    var interdits = (exclus || []).concat([bonPays]);
    var codes = preparer(donnees).codes.filter(function (c) { return interdits.indexOf(c) < 0; });
    var continent = donnees.pays[bonPays].continent;
    var proches = melanger(codes.filter(function (c) { return donnees.pays[c].continent === continent; }), hasard);
    var lointains = melanger(codes.filter(function (c) { return donnees.pays[c].continent !== continent; }), hasard);
    return proches.concat(lointains).slice(0, combien);
  }
  // Ordre de passage des vedettes d'un niveau pour un cycle (un cycle = toutes les curiosités du niveau).
  // Les dernières vedettes d'un cycle ne rouvrent pas le suivant : pas de répétition à la jointure.
  function ordreDuCycle(prep, niveau, cycle) {
    var bassin = prep.bassins[niveau];
    var cle = function (c) { return niveau + '-' + c; };
    var simple = function (c) { return melanger(bassin, generateur('globecurios-vedette-' + cle(c))); };
    if (prep.ordres[cle(cycle)]) return prep.ordres[cle(cycle)];
    if (cycle <= 0 || cycle > 500 || bassin.length < 3 * BLOC) return (prep.ordres[cle(cycle)] = simple(cycle));
    var premier = cycle;
    while (premier > 0 && !prep.ordres[cle(premier - 1)]) premier -= 1;
    for (var c = premier; c <= cycle; c++) {
      var ordre = simple(c);
      if (c > 0) {
        var fin = prep.ordres[cle(c - 1)].slice(-BLOC);
        var recentes = ordre.filter(function (i) { return fin.indexOf(i) >= 0; });
        var autres = ordre.filter(function (i) { return fin.indexOf(i) < 0; });
        ordre = autres.slice(0, BLOC).concat(recentes, autres.slice(BLOC));
      }
      prep.ordres[cle(c)] = ordre;
    }
    return prep.ordres[cle(cycle)];
  }
  // Curiosité vedette : tirée parmi celles du niveau du jour, sans répétition avant d'avoir épuisé le niveau.
  function vedetteDuJour(donnees, jour) {
    var prep = preparer(donnees);
    var niveau = niveauDuJour(jour);
    var taille = prep.bassins[niveau].length;
    var rang = rangDansNiveau(jour);
    return ordreDuCycle(prep, niveau, Math.floor(rang / taille))[((rang % taille) + taille) % taille];
  }
  function quatreChoix(donnees, item, hasard) {
    return melanger([item.pays].concat(fauxPays(donnees, item.pays, 3, hasard)), hasard);
  }
  // Question de révision : toujours les mêmes choix pour une curiosité un jour donné (recharger n'apprend rien).
  function questionRevision(donnees, item, jour) {
    donnees = donneesDuJour(donnees, jour);
    return { item: item.id, options: quatreChoix(donnees, item, generateur('globecurios-revision-' + item.id + '-' + jour)) };
  }
  // Défi d'un jour. Les jours d'un bloc se construisent dans l'ordre, chacun évitant les curiosités des précédents ;
  // le bloc en cours est gardé en mémoire pour ne pas tout recalculer à chaque appel.
  function construireDefi(donnees, jour) {
    donnees = donneesDuJour(donnees, jour);
    var prep = preparer(donnees);
    var debut = Math.floor(jour / BLOC) * BLOC;
    if (!prep.bloc || prep.bloc.debut !== debut) {
      var reservees = {}; // vedettes du bloc : elles ne servent pas dans les autres épreuves
      for (var v = debut; v < debut + BLOC; v++) reservees[vedetteDuJour(donnees, v).id] = true;
      prep.bloc = { debut: debut, reservees: reservees, vues: {}, defis: [] };
    }
    var bloc = prep.bloc;
    var neuve = function (item) { return !bloc.vues[item.id] && !bloc.reservees[item.id]; };
    while (bloc.defis.length <= jour - debut) {
      var defi = construireUnDefi(donnees, debut + bloc.defis.length, neuve);
      defi.epreuves[1].cartes.concat(defi.epreuves[2].items).forEach(function (id) { bloc.vues[id] = true; });
      bloc.defis.push(defi);
    }
    return JSON.parse(JSON.stringify(bloc.defis[jour - debut])); // copie : l'appelant peut la modifier sans risque
  }
  function construireUnDefi(donnees, jour, neuve) {
    var hasard = generateur('globecurios-jour-' + jour);
    var prep = preparer(donnees);
    var index = prep.index;
    var codes = prep.codes;
    var niveau = niveauDuJour(jour);
    var bornes = NIVEAUX_ADMIS[niveau];
    var duNiveau = function (item) { return item.niv >= bornes[0] && item.niv <= bornes[1]; };
    var continent = function (code) { return donnees.pays[code].continent; };
    var memeContinent = function (a, b) { return continent(a) === continent(b); };

    // Épreuve 1 : la vedette, à retrouver avec le moins d'indices possible.
    var vedette = vedetteDuJour(donnees, jour);
    var origine = { type: 'origine', item: vedette.id, options: quatreChoix(donnees, vedette, hasard) };

    // Pour chaque pays : ses curiosités pas encore vues dans le bloc et du niveau du jour (« ideales »),
    // ses curiosités pas encore vues (« neuves »), et toutes.
    var choix = {};
    codes.forEach(function (c) {
      var neuves = index[c].filter(neuve);
      choix[c] = { ideales: neuves.filter(duNiveau), neuves: neuves, toutes: index[c] };
    });
    // On préfère sortir du niveau du jour plutôt que répéter une curiosité, et répéter plutôt que bloquer.
    var meilleures = function (c, minimum) {
      var k = choix[c];
      return k.ideales.length >= minimum ? k.ideales : k.neuves.length >= minimum ? k.neuves : k.toutes;
    };
    // Nombre de pays par continent (hors pays de la vedette) qui ont au moins une curiosité de la sorte demandée.
    var parContinent = function (sorte) {
      var compte = {};
      codes.forEach(function (c) {
        if (c !== vedette.pays && choix[c][sorte].length >= 1) compte[continent(c)] = (compte[continent(c)] || 0) + 1;
      });
      return compte;
    };
    var aUnVoisin = function (c, sorte, compte) {
      return (compte[continent(c)] || 0) - (choix[c][sorte].length >= 1 ? 1 : 0) >= 1;
    };
    var premierNonVide = function (listes) {
      for (var n = 0; n < listes.length; n++) if (listes[n].length) return listes[n];
      return [];
    };

    // Épreuve 2 : trois curiosités du même pays et une intruse venue d'un pays du même continent.
    var possibles = codes.filter(function (c) { return c !== vedette.pays && index[c].length >= 3; });
    var voisinsIdeaux = parContinent('ideales');
    var voisinsNeufs = parContinent('neuves');
    var paysTrio = tirer(premierNonVide([
      possibles.filter(function (c) { return choix[c].ideales.length >= 3 && aUnVoisin(c, 'ideales', voisinsIdeaux); }),
      possibles.filter(function (c) { return choix[c].neuves.length >= 3 && aUnVoisin(c, 'neuves', voisinsNeufs); }),
      possibles.filter(function (c) { return choix[c].neuves.length >= 3; }),
      possibles
    ]), hasard);
    var trio = melanger(meilleures(paysTrio, 3), hasard).slice(0, 3);
    var voisins = fauxPays(donnees, paysTrio, codes.length, hasard, [vedette.pays]);
    var proches = voisins.filter(function (c) { return memeContinent(c, paysTrio); });
    var bassinIntrus = proches.length ? proches : voisins;
    var paysIntrus = premierNonVide([
      bassinIntrus.filter(function (c) { return choix[c].ideales.length >= 1; }),
      bassinIntrus.filter(function (c) { return choix[c].neuves.length >= 1; }),
      bassinIntrus
    ])[0];
    var intrus = tirer(meilleures(paysIntrus, 1), hasard);
    var cartes = melanger(trio.concat([intrus]), hasard).map(function (i) { return i.id; });

    // Épreuve 3 : quatre curiosités pour cinq pays (un pays en trop), sur deux continents.
    var pris = [vedette.pays, paysTrio, paysIntrus];
    var horsPris = codes.filter(function (c) { return pris.indexOf(c) < 0; });
    var avecIdeales = horsPris.filter(function (c) { return choix[c].ideales.length >= 1; });
    var avecNeuves = horsPris.filter(function (c) { return choix[c].neuves.length >= 1; });
    var libres = melanger(avecIdeales.length >= 12 ? avecIdeales : avecNeuves.length >= 12 ? avecNeuves : horsPris, hasard);
    var premier = libres[0];
    var groupeA = [premier].concat(libres.filter(function (c) { return c !== premier && memeContinent(c, premier); }).slice(0, 2));
    var ailleurs = libres.filter(function (c) { return !memeContinent(c, premier); });
    var groupeB = ailleurs.length ? [ailleurs[0]].concat(ailleurs.filter(function (c) {
      return c !== ailleurs[0] && memeContinent(c, ailleurs[0]);
    }).slice(0, 1)) : [];
    var cinq = groupeA.concat(groupeB);
    libres.forEach(function (c) { if (cinq.length < 5 && cinq.indexOf(c) < 0) cinq.push(c); });
    cinq = melanger(cinq, hasard);
    var paysEnTrop = cinq[0];
    var aRelier = cinq.slice(1).map(function (c) { return tirer(meilleures(c, 1), hasard).id; });

    return {
      jour: jour,
      niveau: niveau,
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
      jokerLe: null, jokers: 1, atlas: {}, revision: {}, album: {}, bonus: {} };
  }
  function estObjet(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function estEntier(x) { return typeof x === 'number' && isFinite(x) && Math.floor(x) === x; }
  // Vérifie un état lu dans le navigateur ou dans un code de sauvegarde, et complète les champs récents.
  function etatValide(e) {
    if (!estObjet(e) || e.v !== 1) return null;
    if (!estObjet(e.jours) || !estObjet(e.atlas) || !estObjet(e.revision)) return null;
    if (e.album === undefined) e.album = {};
    if (!estObjet(e.album)) return null;
    if (e.bonus === undefined) e.bonus = {};
    if (!estObjet(e.bonus)) return null;
    if (e.jokers !== undefined && (!estEntier(e.jokers) || e.jokers < 0 || e.jokers > JOKERS_MAX)) return null;
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
  // Jokers : un jour manqué est pardonné par joker. On en gagne un à chaque série de 7 jours, au plus 2 en réserve.
  // (Ancienne règle : un joker tous les 7 jours, noté par jokerLe ; un état ancien reçoit 1 joker.)
  var JOKERS_MAX = 2;
  function jokers(etat) { return estEntier(etat.jokers) ? etat.jokers : 1; }
  function jokerDisponible(etat) { return jokers(etat) > 0; }
  // Clôt le défi du jour et met la série à jour.
  function terminerJour(etat, jour, scores) {
    if (etat.jours[jour]) return { dejaFait: true, joker: false, jokerGagne: false };
    var joker = false, gagne = false;
    etat.jokers = jokers(etat);
    etat.jours[jour] = { scores: scores.slice(), total: scores.reduce(function (a, b) { return a + b; }, 0) };
    etat.enCours = null;
    // Un jour antérieur au dernier jour joué (horloge reculée, voyage, ancien défi) est enregistré sans toucher à la série.
    if (etat.dernierJour !== null && jour <= etat.dernierJour) return { dejaFait: false, joker: false, jokerGagne: false };
    var manques = etat.dernierJour === null ? Infinity : jour - etat.dernierJour - 1;
    if (manques === 0) {
      etat.serie += 1;
    } else if (manques <= etat.jokers && etat.serie >= 1) {
      etat.serie += 1;
      etat.jokers -= manques;
      etat.jokerLe = jour;
      joker = true;
    } else {
      etat.serie = 1;
    }
    if (etat.serie % 7 === 0 && etat.jokers < JOKERS_MAX) {
      etat.jokers += 1;
      gagne = true;
    }
    etat.dernierJour = jour;
    etat.meilleureSerie = Math.max(etat.meilleureSerie, etat.serie);
    return { dejaFait: false, joker: joker, jokerGagne: gagne };
  }
  // Série affichée : elle tient tant que les jours manqués peuvent encore être couverts par les jokers.
  function serieActuelle(etat, jour) {
    if (etat.dernierJour === null) return 0;
    var manques = jour - etat.dernierJour - 1;
    if (manques <= 0) return etat.serie;
    if (manques <= jokers(etat) && etat.serie >= 1) return etat.serie;
    return 0;
  }
  // Bonus du dimanche : les vedettes des six jours précédents (lundi à samedi), à rattacher à leur pays.
  function vedettesDeLaSemaine(donnees, jour) {
    var liste = [];
    for (var j = jour - 6; j < jour; j++) if (j >= 0) liste.push(construireDefi(donnees, j).epreuves[0].item);
    return liste;
  }

  // ---------- Entraînement par continent ----------
  // Questions à quatre choix sur les curiosités d'un continent (null : le monde entier), prises parmi celles déjà
  // entrées dans les défis. Les curiosités des défis d'aujourd'hui et des 13 jours suivants sont écartées : l'entraînement
  // ne dévoile rien d'avance. « dejaVues » évite de reposer les mêmes dans une séance, tant qu'il en reste d'autres.
  var JOURS_PROTEGES = BLOC;
  var proteges = { source: null, jour: null, ids: null };
  function curiositesProtegees(donnees, jour) {
    if (proteges.source !== donnees || proteges.jour !== jour) {
      var ids = {};
      for (var j = jour; j < jour + JOURS_PROTEGES; j++) {
        var d = construireDefi(donnees, j);
        [d.epreuves[0].item].concat(d.epreuves[1].cartes, d.epreuves[2].items).forEach(function (id) { ids[id] = true; });
      }
      construireDefi(donnees, jour); // remet en mémoire le bloc du jour
      proteges = { source: donnees, jour: jour, ids: ids };
    }
    return proteges.ids;
  }
  function continentsEntrainement(donnees, jour) {
    var dj = donneesDuJour(donnees, jour), compte = {};
    dj.items.forEach(function (i) { var c = dj.pays[i.pays].continent; compte[c] = (compte[c] || 0) + 1; });
    return compte;
  }
  function questionsEntrainement(donnees, jour, continent, combien, graine, dejaVues) {
    var dj = donneesDuJour(donnees, jour);
    var exclus = curiositesProtegees(donnees, jour);
    var hasard = generateur('globecurios-entrainement-' + graine);
    var bassin = dj.items.filter(function (i) {
      return !exclus[i.id] && (!continent || dj.pays[i.pays].continent === continent);
    }).sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    var vues = dejaVues || [];
    var neuves = bassin.filter(function (i) { return vues.indexOf(i.id) < 0; });
    var choisies = melanger(neuves.length >= combien ? neuves : bassin, hasard).slice(0, combien);
    return choisies.map(function (item) { return { item: item.id, options: quatreChoix(dj, item, hasard) }; });
  }

  // ---------- Atlas, statistiques, anciens défis ----------
  // Niveau d'un pays dans l'atlas : 0 inconnu, 1 découvert, 2 connu, 3 maîtrisé.
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
  // Le parcours de chaque épreuve, déduit de son score : une case par essai (épreuves 1 et 2) ou par lien (épreuve 3).
  // ⬛ raté, 🟩 trouvé ; pas de rouge, que les daltoniens confondent avec le vert.
  function repeter(c, n) { var s = ''; for (var i = 0; i < n; i++) s += c; return s; }
  function parcours(score, epreuve) {
    if (epreuve === 0) {
      var essai = POINTS_ORIGINE.indexOf(score);
      return essai < 0 ? repeter('⬛', POINTS_ORIGINE.length) : repeter('⬛', essai) + '🟩';
    }
    if (epreuve === 1) return score >= 100 ? '🟩' : score > 0 ? '⬛🟩' : '⬛⬛';
    var justes = Math.max(0, POINTS_LIENS.indexOf(score));
    return repeter('🟩', justes) + repeter('⬛', 4 - justes);
  }
  function carres(scores) {
    return scores.map(parcours).join(' ');
  }
  // Date du défi, à minuit UTC : l'affichage la met en forme dans la langue du joueur (fuseau UTC).
  function dateDuDefi(jour) {
    return new Date(Date.UTC(LANCEMENT[0], LANCEMENT[1], LANCEMENT[2]) + jour * 86400000);
  }
  // Une ligne par épreuve, sans rien révéler des réponses : lisible même sans connaître le jeu.
  // Les textes (entête, noms des épreuves, série, invitation) sont fournis dans la langue du joueur.
  function texteDePartage(scores, textes) {
    return [textes.entete].concat(scores.map(function (s, n) {
      return parcours(s, n) + ' ' + textes.epreuves[n] + ' ' + s;
    }), textes.serie ? [textes.serie] : [], [textes.invite]).join('\n');
  }
  function coderSauvegarde(etat, versBase64) { return 'GC1.' + versBase64(JSON.stringify(etat)); }
  function decoderSauvegarde(code, depuisBase64) {
    var texte = String(code || '').trim();
    if (texte.indexOf('GC1.') !== 0) return null;
    try { return etatValide(JSON.parse(depuisBase64(texte.slice(4)))); } catch (e) { return null; }
  }

  // Les textes des curiosités sont rangés en paquets (un fichier par paquet et par langue) : le jeu ne charge
  // que ceux dont il a besoin. Même calcul dans outils/construire_site.py.
  function paquetDe(id, nombre) { return hacher('paquet-' + id) % nombre; }
  // Nom neutre de la photo d'une curiosité (img/<nom>.jpg) : un appui long sur l'image ne doit pas trahir la réponse.
  function nomPhoto(id) {
    var a = hacher('photo-a-' + id).toString(16), b = (hacher('photo-b-' + id) >>> 16).toString(16);
    return ('00000000' + a).slice(-8) + ('0000' + b).slice(-4);
  }

  return {
    versionDuJour: versionDuJour, donneesDuJour: donneesDuJour, paquetDe: paquetDe, nomPhoto: nomPhoto,
    DELAIS_REVISION: DELAIS_REVISION, MAX_REVISION: MAX_REVISION,
    POINTS_ORIGINE: POINTS_ORIGINE, POINTS_LIENS: POINTS_LIENS,
    generateur: generateur, melanger: melanger, indexDuJour: indexDuJour, numeroDuJour: numeroDuJour,
    dateDuDefi: dateDuDefi, secondesAvantDemain: secondesAvantDemain, BLOC: BLOC,
    niveauDuJour: niveauDuJour, estDimanche: estDimanche,
    construireDefi: construireDefi, questionRevision: questionRevision,
    pointsOrigine: pointsOrigine, pointsParEssais: pointsParEssais, pointsLiens: pointsLiens,
    nouvelEtat: nouvelEtat, etatValide: etatValide, noterReponse: noterReponse,
    aRevoir: aRevoir, toutesARevoir: toutesARevoir, jokerDisponible: jokerDisponible,
    terminerJour: terminerJour, serieActuelle: serieActuelle, jokers: jokers, JOKERS_MAX: JOKERS_MAX,
    vedettesDeLaSemaine: vedettesDeLaSemaine, niveau: niveau, bilanAtlas: bilanAtlas,
    continentsEntrainement: continentsEntrainement, questionsEntrainement: questionsEntrainement,
    statistiques: statistiques, joursRejouables: joursRejouables,
    carres: carres, texteDePartage: texteDePartage,
    coderSauvegarde: coderSauvegarde, decoderSauvegarde: decoderSauvegarde
  };
});
