// Écran d'accueil : historique des estimations, recherche, tri, actions, import / export.
import { h, picto, format, urlObjet } from './dom.js';
import { choix } from './composants.js';
import { lien } from '../router.js';
import * as store from '../data/store.js';
import { calculerEstimation } from '../calc/engine.js';
import { analyserImport, conflits } from '../data/io.js';
import { nouvelId } from '../data/schema.js';
import { LIBELLES_VERDICT } from './etape.js';
import { demander, confirmer, notifier } from './dialogue.js';
import { exporterEstimation, exporterTout } from './partage.js';

const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

// Préférences d'affichage conservées pendant la session.
const affichage = { tri: 'recent', archives: false, recherche: '' };

const TRIS = [
  { valeur: 'recent', libelle: 'Récentes' },
  { valeur: 'marge', libelle: 'Marge' },
  { valeur: 'adresse', libelle: 'Adresse' },
];

function trier(liste) {
  const avecRes = liste.map((e) => ({ e, r: calculerEstimation(e) }));
  if (affichage.tri === 'marge') {
    avecRes.sort((a, b) => (b.r.complet ? b.r.scenarios.central.margeNette : -Infinity)
      - (a.r.complet ? a.r.scenarios.central.margeNette : -Infinity));
  } else if (affichage.tri === 'adresse') {
    avecRes.sort((a, b) => (a.e.bien.adresse || '￿').localeCompare(b.e.bien.adresse || '￿', 'fr'));
  }
  return avecRes;
}

function carteEstimation({ e, r }, rerendre) {
  const c = r.scenarios.central;
  const v = c.verdict;
  const titre = e.bien.adresse || 'Adresse non renseignée';
  const vignette = h('span', { class: 'estimation__photo', 'aria-hidden': 'true' }, picto('maison'));

  store.photosDe(e.id).then((photos) => {
    const p = photos.find((x) => x.cible === 'bien') ?? photos[0];
    if (p) vignette.replaceChildren(h('img', { src: urlObjet(p.miniature ?? p.image), alt: '' }));
  });

  return h('li', { class: 'estimation' },
    h('a', { class: 'estimation__lien', href: lien({ ecran: 'estimation', id: e.id, etape: 'bien' }) },
      vignette,
      h('span', { class: 'estimation__corps' },
        h('span', { class: 'estimation__titre' }, titre),
        h('span', { class: 'estimation__meta' }, [e.mode === 'rapide' ? 'Rapide' : null, e.bien.commune, fmtDate.format(new Date(e.modifieLe))].filter(Boolean).join(' · ')),
        h('span', { class: 'estimation__resultat' },
          h('span', { class: 'chiffre' }, r.complet ? format.euros(c.margeNette) : '—'),
          h('span', { class: `pastille pastille--${v === 'incomplet' ? 'neutre' : v}` }, LIBELLES_VERDICT[v]),
        ),
      ),
    ),
    h('button', {
      type: 'button', class: 'bouton-icone bouton-icone--discret estimation__menu',
      'aria-label': `Actions pour ${titre}`, onclick: () => actions(e, titre, rerendre),
    }, picto('plusieurs')),
  );
}

async function actions(e, titre, rerendre) {
  const choixAction = await demander({
    titre,
    boutons: [
      { valeur: 'exporter', libelle: 'Exporter / envoyer' },
      { valeur: 'dupliquer', libelle: 'Dupliquer' },
      { valeur: 'archiver', libelle: e.archive ? 'Désarchiver' : 'Archiver' },
      { valeur: 'supprimer', libelle: 'Supprimer', style: 'bouton--danger-discret' },
    ],
  });
  switch (choixAction) {
    case 'exporter':
      await exporterEstimation(e.id);
      break;
    case 'dupliquer': {
      const copie = await store.dupliquer(e.id);
      notifier('Estimation dupliquée');
      location.hash = lien({ ecran: 'estimation', id: copie.id, etape: 'bien' });
      return;
    }
    case 'archiver':
      await store.archiver(e.id, !e.archive);
      notifier(e.archive ? 'Estimation archivée' : 'Estimation désarchivée');
      break;
    case 'supprimer':
      if (await confirmer({
        titre: 'Supprimer l’estimation ?',
        texte: `« ${titre} » et ses photos seront définitivement supprimées de ce téléphone.`,
        libelle: 'Supprimer', danger: true,
      })) {
        await store.supprimer(e.id);
        notifier('Estimation supprimée');
      }
      break;
    default:
      return;
  }
  rerendre();
}

async function importerFichier(fichier, rerendre) {
  let donnees;
  try {
    donnees = analyserImport(await fichier.text());
  } catch (err) {
    await demander({ titre: 'Import impossible', texte: err.message, boutons: [{ valeur: 'ok', libelle: 'Fermer', style: 'bouton--principal' }] });
    return;
  }

  // Doublons d'identifiant : remplacer ou dupliquer.
  const enDouble = conflits(donnees.estimations, store.ids());
  if (enDouble.length) {
    const r = await demander({
      titre: 'Estimation déjà présente',
      texte: enDouble.length === 1
        ? 'Cette estimation existe déjà sur ce téléphone.'
        : `${enDouble.length} estimations existent déjà sur ce téléphone.`,
      boutons: [
        { valeur: 'annuler', libelle: 'Annuler' },
        { valeur: 'dupliquer', libelle: 'Garder les deux' },
        { valeur: 'remplacer', libelle: 'Remplacer', style: 'bouton--principal' },
      ],
    });
    if (r !== 'remplacer' && r !== 'dupliquer') return;
    if (r === 'dupliquer') {
      for (const e of donnees.estimations.filter((x) => enDouble.includes(x.id))) {
        const nouvel = nouvelId('e');
        for (const p of donnees.photos.filter((x) => x.estimationId === e.id)) p.estimationId = nouvel;
        e.id = nouvel;
      }
    }
  }

  // Les photos reçoivent toujours de nouveaux identifiants : aucune collision possible avec l'existant.
  for (const p of donnees.photos) p.id = nouvelId('f');

  if (donnees.reglages && await confirmer({
    titre: 'Importer aussi les réglages ?',
    texte: 'Ce fichier contient une grille de prix et des réglages. Ils remplaceront les vôtres pour les prochaines estimations ; les estimations existantes ne changent pas.',
    libelle: 'Importer les réglages',
  })) {
    await store.enregistrerReglages(donnees.reglages);
    notifier('Réglages importés');
  }

  if (!donnees.estimations.length) {
    if (!donnees.reglages) notifier('Aucune estimation dans ce fichier');
    rerendre();
    return;
  }
  await store.importer(donnees.estimations, donnees.photos);
  notifier(`${donnees.estimations.length} estimation(s) importée(s)`);
  rerendre();
}

/** Choix du type d'estimation avant création. */
async function nouvelleEstimation() {
  const contenu = h('div', { class: 'choix-mode' },
    h('p', {}, h('strong', {}, 'Rapide\u00a0: '), 'une seule page. Surface, état général, prix affiché et revente : la synthèse donne le prix à viser et le budget travaux à ne pas dépasser.'),
    h('p', {}, h('strong', {}, 'Détaillée\u00a0: '), 'pièce par pièce, gros postes, prêt et portage. Pour affiner une affaire qui se confirme.'),
    h('p', { class: 'champ__aide' }, 'Vous pourrez passer de l\u2019une à l\u2019autre à tout moment.'),
  );
  const mode = await demander({
    titre: 'Nouvelle estimation', contenu,
    boutons: [
      { valeur: 'detaille', libelle: 'Détaillée' },
      { valeur: 'rapide', libelle: 'Rapide', style: 'bouton--principal' },
    ],
  });
  if (!mode) return;
  location.hash = lien({ ecran: 'estimation', id: store.creer(mode).id, etape: 'bien' });
}

export function ecranAccueil({ rerendre }) {
  const liste = h('ul', { class: 'liste-estimations' });
  const nbArchives = store.nombreArchives();

  const remplir = () => {
    const t = affichage.recherche.trim().toLocaleLowerCase('fr');
    const visibles = store.lister({ archives: affichage.archives })
      .filter((e) => `${e.bien.adresse} ${e.bien.commune}`.toLocaleLowerCase('fr').includes(t));
    liste.replaceChildren(...trier(visibles).map((x) => carteEstimation(x, rerendre)));
    if (!visibles.length) liste.append(h('li', { class: 'liste-estimations__vide' }, t ? 'Aucun résultat.' : 'Aucune estimation archivée.'));
  };

  const rappel = h('span', {}, 'Vos données restent sur ce téléphone. Exportez-les régulièrement.');
  store.dernierExport().then((d) => {
    const jours = d ? Math.floor((Date.now() - new Date(d)) / 86400000) : null;
    rappel.textContent = d
      ? `Données stockées sur ce téléphone. Dernière sauvegarde exportée ${jours === 0 ? 'aujourd’hui' : `il y a ${jours} jour${jours > 1 ? 's' : ''}`}.`
      : 'Données stockées sur ce téléphone uniquement. Pensez à faire une sauvegarde (« Tout exporter »).';
  });

  const aucune = store.lister().length === 0 && nbArchives === 0;
  if (!aucune) remplir();

  return [
    h('h1', {}, affichage.archives ? 'Archives' : 'Mes estimations'),
    h('p', { class: 'accroche' }, 'Voir sous la surface avant d’acheter.'),

    affichage.archives ? null : h('button', {
      type: 'button', class: 'bouton bouton--principal bouton--large',
      onclick: nouvelleEstimation,
    }, picto('plus'), 'Nouvelle estimation'),

    aucune
      ? h('div', { class: 'vide' },
        picto('chantier'),
        h('strong', {}, 'Aucune estimation pour l’instant'),
        h('span', {}, 'Lancez une estimation au début de votre prochaine visite, ou importez un fichier reçu de votre associé.'),
      )
      : [
        h('div', { class: 'outils-liste' },
          h('label', { class: 'visuellement-cache', for: 'recherche' }, 'Rechercher une estimation'),
          h('input', {
            id: 'recherche', class: 'champ-recherche', type: 'search', value: affichage.recherche,
            placeholder: 'Rechercher (adresse, commune…)',
            oninput: (ev) => { affichage.recherche = ev.target.value; remplir(); },
          }),
        ),
        choix({
          libelle: 'Trier par', options: TRIS, valeur: affichage.tri, compact: true, masquerLegende: true,
          onChange: (v) => { affichage.tri = v; remplir(); },
        }),
        liste,
        nbArchives || affichage.archives
          ? h('button', {
            type: 'button', class: 'bouton bouton--lien',
            onclick: () => { affichage.archives = !affichage.archives; rerendre(); },
          }, affichage.archives ? '← Retour aux estimations' : `Voir les archives (${nbArchives})`)
          : null,
      ],

    h('div', { class: 'sauvegarde' },
      h('label', { class: 'bouton bouton--secondaire' },
        h('input', {
          type: 'file', accept: '.json,application/json', class: 'visuellement-cache',
          onchange: (ev) => { const f = ev.target.files[0]; ev.target.value = ''; if (f) importerFichier(f, rerendre); },
        }),
        picto('import'), 'Importer'),
      aucune ? null : h('button', {
        type: 'button', class: 'bouton bouton--secondaire',
        onclick: async () => { await exporterTout(); rerendre(); },
      }, picto('export'), 'Tout exporter'),
    ),

    h('p', { class: 'rappel' }, picto('info'), rappel),
  ];
}
