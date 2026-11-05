// Construction de la fiche A4 imprimable (une page dans le cas standard).
// Mise en page : css/fiche.css (écran et impression). Lisible en noir et blanc :
// la couleur n'est qu'un accent, chaque verdict porte un symbole et un libellé.
import { h, format, urlObjet } from '../ui/dom.js';
import { calculerEstimation } from '../calc/engine.js';
import { TYPES_PIECES, ETATS } from '../calc/defaults.js';
import { APP_VERSION } from '../version.js';

const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const euros = (v) => (v == null ? '—' : format.euros(v));
const pct = (v) => (v == null ? '—' : format.pourcent(v));
const val = (v, suffixe = '') => (v == null || v === '' ? '—' : `${v}${suffixe}`);

export const VERDICTS = {
  ok: { symbole: '✔', libelle: 'Objectif atteint' },
  vigilance: { symbole: '!', libelle: 'À surveiller' },
  alerte: { symbole: '✖', libelle: 'Insuffisant' },
  incomplet: { symbole: '…', libelle: 'À compléter' },
};

const TYPES_BIEN = { maison: 'Maison', appartement: 'Appartement', immeuble: 'Immeuble' };
const SOURCES = { agence: 'Agence', notaire: 'Notaire / succession', particulier: 'Particulier', autre: 'Autre' };

const LOGO = `<rect x="18" y="32" width="27" height="24" rx="2" fill="#fff" stroke="#23384A" stroke-width="2"/>
  <path d="M23 50 L29.5 43.5 L33.5 47.5 L40 41 M35 39.6 L41.6 39.4 L41.4 46" fill="none" stroke="#C8553D" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11 32 L32 12.5 L53 32 L53 56" fill="none" stroke="#C8553D" stroke-width="7" stroke-linecap="square" stroke-linejoin="round"/>`;

function logo() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'f-logo');
  svg.innerHTML = LOGO;
  return svg;
}

const ligne = (libelle, valeur) => [h('dt', {}, libelle), h('dd', {}, valeur)];

function verdictEl(v) {
  const d = VERDICTS[v];
  return h('span', { class: `f-verdict f-verdict--${v}` }, h('span', { 'aria-hidden': 'true' }, d.symbole), ` ${d.libelle}`);
}

// ---------------------------------------------------------------------------

function entete(e, r) {
  const b = e.bien;
  return h('header', { class: 'f-entete' },
    h('div', { class: 'f-marque' }, logo(), h('div', {}, h('strong', {}, 'Pied-de-Biche'), h('span', {}, 'Estimation de rentabilité'))),
    h('div', { class: 'f-titre' },
      h('h1', {}, b.adresse || 'Adresse non renseignée'),
      h('p', {}, [b.commune, `estimation du ${fmtDate.format(new Date(e.modifieLe))}`].filter(Boolean).join(' · ')),
    ),
    h('div', { class: 'f-badges' }, h('span', { class: 'f-badge' }, e.mode === 'rapide' ? 'RP · estimation rapide' : 'Résidence principale'), verdictEl(r.scenarios.central.verdict)),
  );
}

function chiffresCles(e, r) {
  const c = r.scenarios.central;
  const visé = r.prixAchatRetenu;
  return h('section', { class: 'f-cles' },
    h('div', {}, h('span', {}, 'Marge nette (central)'), h('strong', {}, euros(r.complet ? c.margeNette : null))),
    h('div', {}, h('span', {}, '% du coût de revient'), h('strong', {}, pct(r.complet ? c.pctCoutRevient : null)),
      h('em', {}, `objectif ${pct(e.reglages.objectifs.margeCible)}`)),
    h('div', {}, h('span', {}, 'Prix d’achat maximum'), h('strong', {}, euros(r.prixAchatMax)),
      r.prixAchatMax != null && visé ? h('em', {}, `${r.prixAchatMax >= visé ? 'marge de négo.' : 'dépassement'} ${euros(Math.abs(r.prixAchatMax - visé))}`) : null),
  );
}

function blocPhotos(photos, niveau) {
  const choisies = photos.filter((p) => p.dansFiche).slice(0, niveau >= 1 ? 2 : 4);
  if (!choisies.length) return null;
  return h('section', { class: `f-bloc f-photos f-photos--${choisies.length}` },
    h('h2', {}, 'Photos'),
    h('div', { class: 'f-photos__grille' }, choisies.map((p) =>
      h('figure', {}, h('img', { src: urlObjet(p.image), alt: p.legende || 'Photo du bien' }), p.legende ? h('figcaption', {}, p.legende) : null),
    )),
  );
}

const classe = (c) => (!c || c === 'inconnu' ? '?' : c);

function blocBien(e) {
  const b = e.bien;
  return h('section', { class: 'f-bloc f-bien' },
    h('h2', {}, 'Le bien'),
    h('dl', { class: 'f-dl' },
      ligne('Type', TYPES_BIEN[b.type] ?? '—'),
      ligne('Surface habitable', b.surfaceHabitable ? format.surface(b.surfaceHabitable) : '—'),
      ligne('Terrain', b.surfaceTerrain ? format.surface(b.surfaceTerrain) : '—'),
      ligne('Pièces / niveaux', `${val(b.nbPieces)} / ${val(b.nbNiveaux)}`),
      ligne('DPE / GES', `${classe(b.dpe)} / ${classe(b.ges)}`),
      ligne('Année', val(b.anneeConstruction)),
      ligne('Source', SOURCES[b.source] ?? '—'),
      ligne('Prix affiché', euros(b.prixAffiche)),
      ligne('Prix négocié', euros(b.prixAchat)),
    ),
  );
}

function blocFinancement(e, r) {
  const f = e.financement;
  const c = r.scenarios.central;
  const d = c.detail;
  return h('section', { class: 'f-bloc f-financement' },
    h('h2', {}, 'Financement et portage'),
    h('dl', { class: 'f-dl' },
      ligne('Prix d’achat', euros(d.prixAchat || null)),
      ligne(`Frais d’acquisition (${pct(e.reglages.fraisAcquisition.RP)})`, euros(d.fraisAcquisition)),
      d.fraisAgenceAcquereur ? ligne('Agence acquéreur', euros(d.fraisAgenceAcquereur)) : null,
      ligne('Apport', euros(f.apport)),
      ligne('Emprunt', euros(f.emprunt)),
      f.emprunt ? ligne('Taux / assurance', `${pct(f.tauxAnnuel ?? 0)} / ${pct(f.assuranceTauxAnnuel ?? 0)}`) : null,
      ligne('Durée de portage', f.dureeMois ? `${f.dureeMois} mois` : '—'),
      ligne('Coût du crédit', euros(d.financement.total)),
      d.financement.ira ? ligne('dont IRA', euros(d.financement.ira)) : null,
      ligne('Portage', euros(d.portage.total)),
      ligne('Frais de vente', euros(d.fraisVente.total)),
      c.resteAFinancer > 0.5 ? ligne('Reste à financer', euros(c.resteAFinancer)) : null,
    ),
  );
}

function libelleGlobal(e) {
  const b = e.bien;
  return ['Rénovation globale', b.surfaceHabitable ? format.surface(b.surfaceHabitable) : null,
    ETATS.find((x) => x.id === b.etatGeneral)?.libelle, b.modeGeneral === 'nous' ? 'nous-mêmes' : 'artisan'].filter(Boolean).join(' · ');
}

/** Estimation rapide : préconisations à la place du financement. */
function blocPreconisations(e, r) {
  const c = r.scenarios.central;
  const travaux = c.detail.travaux + c.detail.dommagesOuvrage;
  const base = r.prixNegocie ? 'Prix négocié' : 'Prix affiché';
  return h('section', { class: 'f-bloc f-financement' },
    h('h2', {}, 'Préconisations'),
    h('dl', { class: 'f-dl' },
      ligne(base, euros(r.prixAchatRetenu || null)),
      ligne(`Frais d\u2019acquisition (${pct(e.reglages.fraisAcquisition.RP)})`, euros(c.detail.fraisAcquisition)),
      ligne('Travaux estimés (aléas compris)', euros(travaux)),
      ligne('Frais de vente', euros(c.detail.fraisVente.total)),
      ligne('Prix d\u2019achat à viser', euros(r.prixAchatMax)),
      ligne('Prix prudent (pessimiste)', r.prixAchatMaxPrudent != null ? euros(Math.max(0, r.prixAchatMaxPrudent)) : '—'),
      ligne('Budget travaux maximum', r.budgetTravauxMax == null ? '—' : r.budgetTravauxMax > 0 ? euros(r.budgetTravauxMax) : 'aucun'),
    ),
    h('p', { class: 'f-mention' }, 'Estimation rapide : sans prêt ni frais de portage.'),
  );
}

function libellePiece(e, ligneTravaux) {
  const p = e.pieces.find((x) => x.id === ligneTravaux.id);
  if (!p) return ligneTravaux.libelle;
  const type = TYPES_PIECES.find((t) => t.id === p.type)?.libelle;
  const etat = ETATS.find((x) => x.id === p.etat)?.libelle;
  const equip = !TYPES_PIECES.find((t) => t.id === p.type)?.equipement || p.equipement === 'aucun' ? null
    : p.equipement === 'complet' ? 'équip. complet'
      : Array.isArray(p.elements) ? `équip. partiel (${p.elements.length})` : 'équip. partiel';
  return [p.nom || type, p.surface ? format.surface(p.surface) : null, etat, equip].filter(Boolean).join(' · ');
}

function blocTravaux(e, r, niveau) {
  const t = r.travaux;
  const nousMemes = (l) => {
    const src = l.categorie === 'piece' ? e.pieces.find((p) => p.id === l.id) : e.postes.find((p) => p.cle === l.id);
    return src?.mode === 'nous';
  };
  const montants = (l) => ['bas', 'moyen', 'haut'].map((f) => h('td', { class: 'f-num' }, euros(l[f])));

  let lignes = t.lignes.filter((l) => l.moyen > 0 || l.categorie === 'poste');
  if (niveau >= 2) {
    // Mode compact : pièces regroupées par type (« Chambre ×3 · 34 m² »).
    const groupes = new Map();
    for (const l of lignes.filter((x) => x.categorie === 'piece')) {
      const p = e.pieces.find((x) => x.id === l.id);
      const cle = p?.type ?? 'autre';
      const g = groupes.get(cle) ?? { n: 0, surface: 0, bas: 0, moyen: 0, haut: 0 };
      g.n++; g.surface += Number(p?.surface) || 0;
      for (const f of ['bas', 'moyen', 'haut']) g[f] += l[f];
      groupes.set(cle, g);
    }
    lignes = [
      ...[...groupes].map(([type, g]) => ({
        libelle: [`${TYPES_PIECES.find((t) => t.id === type)?.libelle ?? 'Pièce'}${g.n > 1 ? ` ×${g.n}` : ''}`,
          g.surface ? format.surface(g.surface) : null].filter(Boolean).join(' · '),
        bas: g.bas, moyen: g.moyen, haut: g.haut, groupe: true,
      })),
      ...lignes.filter((l) => l.categorie === 'poste'),
    ];
  }

  return h('section', { class: 'f-bloc f-travaux' },
    h('h2', {}, 'Travaux', h('span', { class: 'f-sous-titre' }, ' — fourchettes en € TTC ; « nous-mêmes » : matériaux seuls')),
    h('table', { class: 'f-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Poste'),
        h('th', { class: 'f-num' }, 'Bas'), h('th', { class: 'f-num' }, 'Moyen'), h('th', { class: 'f-num' }, 'Haut'))),
      h('tbody', {}, lignes.length
        ? lignes.map((l) => h('tr', {},
          h('td', {}, l.categorie === 'global' ? libelleGlobal(e) : l.categorie === 'piece' && !l.groupe ? libellePiece(e, l) : l.libelle,
            !l.groupe && nousMemes(l) ? h('span', { class: 'f-struct' }, ' · nous-mêmes') : null,
            l.structurel ? h('span', { class: 'f-struct' }, ' · structurel') : null),
          ...montants(l)))
        : h('tr', {}, h('td', { colspan: 4 }, 'Aucun travaux saisis.'))),
      h('tfoot', {},
        h('tr', {}, h('td', {}, 'Sous-total'), ...montants(t.sousTotal)),
        h('tr', {}, h('td', {}, `Aléas (${pct(e.reglages.aleas)})`), ...montants(t.aleas)),
        t.dommagesOuvrageActive ? h('tr', {}, h('td', {}, 'Dommages-ouvrage'), ...montants(t.dommagesOuvrage)) : null,
        h('tr', { class: 'f-total' }, h('td', {}, 'Total travaux'),
          ...['bas', 'moyen', 'haut'].map((f) => h('td', { class: 'f-num' }, euros(t.total[f] + t.dommagesOuvrage[f])))),
      ),
    ),
  );
}

function blocSynthese(e, r) {
  const s = r.scenarios;
  const noms = [['optimiste', 'Optimiste'], ['central', 'Central'], ['pessimiste', 'Pessimiste']];
  const rangee = (libelle, fn, cls = '') => h('tr', { class: cls }, h('th', { scope: 'row' }, libelle),
    ...noms.map(([n]) => h('td', { class: `f-num${n === 'central' ? ' f-central' : ''}` }, fn(s[n]))));
  const c = s.central;
  const heures = r.remunerationHoraire;

  return h('section', { class: 'f-bloc f-synthese' },
    h('h2', {}, 'Synthèse : trois scénarios'),
    h('table', { class: 'f-table' },
      h('thead', {}, h('tr', {}, h('th', {}, h('span', { class: 'visuellement-cache' }, 'Indicateur')), ...noms.map(([n, l]) => h('th', { class: `f-num${n === 'central' ? ' f-central' : ''}` },
        l, h('span', { class: 'f-sous-titre' }, `travaux ${({ bas: 'bas', moyen: 'moyens', haut: 'hauts' })[s[n].fourchette]}${e.mode === 'rapide' ? '' : `, ${s[n].dureeMois} mois`}`))))),
      h('tbody', {},
        rangee('Coût de revient', (x) => euros(x.coutRevient)),
        rangee('Prix de revente', (x) => euros(x.prixRevente)),
        rangee('Marge brute', (x) => euros(x.margeBrute)),
        rangee('Marge nette', (x) => euros(x.margeNette), 'f-total'),
        rangee('% du coût de revient', (x) => pct(x.pctCoutRevient)),
        rangee('Verdict', (x) => verdictEl(x.verdict)),
      ),
    ),
    h('p', { class: 'f-indicateurs' },
      `Prix d’achat maximum pour ${pct(e.reglages.objectifs.margeCible)} de marge : ${euros(r.prixAchatMax)}`,
      c.pctRevente != null ? ` · Marge / revente : ${pct(c.pctRevente)}` : '',
      c.rendementApport != null ? ` · Rendement sur apport : ${pct(c.rendementApport)}${c.rendementAnnualise != null ? ` (${pct(c.rendementAnnualise)} annualisé)` : ''}` : '',
      heures != null ? ` · Rémunération implicite : ${euros(heures)}/h` : '',
    ),
    h('p', { class: 'f-mention' }, 'Résidence principale : plus-value exonérée, sous condition de résidence principale réelle. Marge nette = marge brute.'),
  );
}

function blocNotes(e, niveau) {
  const max = niveau >= 2 ? 250 : 400;
  const notes = (e.bien.notes || '').trim();
  if (!notes) return null;
  return h('section', { class: 'f-bloc f-notes' },
    h('h2', {}, 'Notes'),
    h('p', {}, notes.length > max ? `${notes.slice(0, max).trimEnd()}…` : notes),
  );
}

/**
 * Construit la fiche. niveau : 0 normal, 1 compact (police réduite, 2 photos), 2 très compact (pièces regroupées).
 */
export function construireFiche(e, photos = [], niveau = 0) {
  const r = calculerEstimation(e);
  return h('article', { class: `fiche fiche--niveau-${niveau}`, 'aria-label': 'Fiche de l’estimation' },
    entete(e, r),
    chiffresCles(e, r),
    (() => {
      const photosEl = blocPhotos(photos, niveau);
      const droite = e.mode === 'rapide' ? blocPreconisations(e, r) : blocFinancement(e, r);
      return h('div', { class: `f-colonnes${photosEl ? ' f-colonnes--3' : ''}` }, blocBien(e), droite, photosEl);
    })(),
    blocTravaux(e, r, niveau),
    blocSynthese(e, r),
    blocNotes(e, niveau),
    h('footer', { class: 'f-pied' },
      h('span', {}, 'Estimation indicative, ne constitue pas un conseil financier ou fiscal.'),
      h('span', {}, `Pied-de-Biche ${APP_VERSION} · ${fmtDate.format(new Date())}`),
    ),
  );
}

/** Hauteur utile d'une page A4 (297 mm − 2 × 10 mm de marge), en pixels CSS. */
export const HAUTEUR_PAGE_PX = (277 / 25.4) * 96;

/**
 * Insère la fiche dans `conteneur` au niveau le plus lisible qui tient sur une page.
 * En dernier recours, la fiche passe sur deux pages avec des sauts propres (aucun bloc coupé).
 */
export function insererFicheAjustee(conteneur, e, photos) {
  let fiche;
  for (let niveau = 0; niveau <= 2; niveau++) {
    fiche = construireFiche(e, photos, niveau);
    conteneur.replaceChildren(fiche);
    if (fiche.scrollHeight <= HAUTEUR_PAGE_PX * 0.98) return { fiche, niveau, pages: 1 };
  }
  fiche.classList.add('fiche--multipage');
  return { fiche, niveau: 2, pages: 2 };
}
