// Étape 5 — Synthèse : trois scénarios, indicateurs et accès à la fiche PDF.
import { h, picto, format } from './dom.js';
import { lien } from '../router.js';
import { LIBELLES_VERDICT } from './etape.js';

const euros = (v) => (v == null ? '—' : format.euros(v));
const pct = (v) => (v == null ? '—' : format.pourcent(v));
const SCENARIOS = [['optimiste', 'Optimiste'], ['central', 'Central'], ['pessimiste', 'Pessimiste']];

/** Texte calculé mis à jour en direct (au cas où l'estimation change pendant l'affichage). */
function texte(ctx, fn, attrs = {}) {
  const el = h('span', attrs);
  ctx.lier((r) => { el.textContent = fn(r); });
  return el;
}

function pastille(ctx, fn) {
  const el = h('span');
  ctx.lier((r) => {
    const v = fn(r);
    el.className = `pastille pastille--${v === 'incomplet' ? 'neutre' : v}`;
    el.textContent = LIBELLES_VERDICT[v];
  });
  return el;
}

function tableauScenarios(ctx) {
  const rangee = (libelle, fn, cls = '') => h('tr', { class: cls },
    h('th', { scope: 'row' }, libelle),
    ...SCENARIOS.map(([n]) => h('td', { class: n === 'central' ? 'central' : '' }, texte(ctx, (r) => fn(r.scenarios[n])))));

  return h('div', { class: 'tableau-defilant', tabindex: '0', role: 'region', 'aria-label': 'Tableau des trois scénarios' },
    h('table', { class: 'tableau' },
      h('thead', {}, h('tr', {}, h('th', {}, h('span', { class: 'visuellement-cache' }, 'Indicateur')),
        ...SCENARIOS.map(([n, l]) => h('th', { scope: 'col', class: n === 'central' ? 'central' : '' }, l)))),
      h('tbody', {},
        rangee('Travaux', (s) => ({ bas: 'Bas', moyen: 'Moyen', haut: 'Haut' })[s.fourchette]),
        rangee('Portage', (s) => `${s.dureeMois} mois`),
        rangee('Coût de revient', (s) => euros(s.coutRevient)),
        rangee('Revente', (s) => euros(s.prixRevente)),
        rangee('Marge brute', (s) => euros(s.margeBrute)),
        rangee('Marge nette', (s) => euros(s.margeNette), 'fort'),
        rangee('% du coût', (s) => pct(s.pctCoutRevient), 'fort'),
        rangee('% revente', (s) => pct(s.pctRevente)),
      ),
      h('tfoot', {}, h('tr', {}, h('th', { scope: 'row' }, 'Verdict'),
        ...SCENARIOS.map(([n]) => h('td', { class: n === 'central' ? 'central' : '' }, pastille(ctx, (r) => r.scenarios[n].verdict))))),
    ),
  );
}

function indicateur(libelle, valeur, detail) {
  return h('div', { class: 'indicateur' },
    h('span', { class: 'indicateur__libelle' }, libelle),
    h('strong', { class: 'indicateur__valeur chiffre' }, valeur),
    detail ? h('span', { class: 'indicateur__detail' }, detail) : null,
  );
}

function decomposition(ctx) {
  const lignes = [
    ['Prix d’achat', (d) => d.prixAchat],
    ['Frais d’acquisition', (d) => d.fraisAcquisition],
    ['Agence acquéreur', (d) => d.fraisAgenceAcquereur],
    ['Travaux (avec aléas)', (d) => d.travaux],
    ['Dommages-ouvrage', (d) => d.dommagesOuvrage],
    ['Financement', (d) => d.financement.total],
    ['Portage', (d) => d.portage.total],
  ];
  const dl = h('dl', { class: 'decomposition' });
  ctx.lier((r) => {
    const c = r.scenarios.central;
    dl.replaceChildren(...lignes.filter(([, f]) => f(c.detail) > 0).flatMap(([l, f]) => [h('dt', {}, l), h('dd', { class: 'chiffre' }, euros(f(c.detail)))]),
      h('dt', { class: 'decomposition__total' }, 'Coût de revient'), h('dd', { class: 'chiffre decomposition__total' }, euros(c.coutRevient)));
  });
  return dl;
}

export function ecranSynthese(ctx) {
  const e = ctx.estimation;
  const r0 = ctx.resultats;

  return [
    h('h1', {}, 'Synthèse'),

    r0.complet ? null : h('p', { class: 'rappel rappel--attention' }, picto('info'),
      h('span', {}, 'Renseignez au moins le prix d’achat visé (« Le bien ») et le prix de revente (« Financement & revente ») pour obtenir un verdict.')),

    h('section', { class: 'carte resultat' },
      h('p', { class: 'resultat__libelle' }, 'Marge nette · scénario central'),
      texte(ctx, (r) => (r.complet ? euros(r.scenarios.central.margeNette) : '— €'), { class: 'resultat__valeur chiffre' }),
      h('p', { class: 'resultat__ligne' },
        pastille(ctx, (r) => r.scenarios.central.verdict),
        texte(ctx, (r) => (r.complet ? `${pct(r.scenarios.central.pctCoutRevient)} du coût de revient · objectif ${pct(e.reglages.objectifs.margeCible)}` : ''))),
      h('p', { class: 'champ__aide' }, 'Exonération de plus-value conditionnée à une résidence principale réelle.'),
    ),

    h('section', { class: 'carte' },
      h('h2', { class: 'carte__titre' }, 'Trois scénarios'),
      tableauScenarios(ctx),
      h('p', { class: 'champ__aide' },
        `Pessimiste : travaux en fourchette haute, revente −${pct(e.reglages.scenarios.abattementRevente)}, portage +${e.reglages.scenarios.moisSupplementaires} mois.`),
    ),

    h('section', { class: 'carte' },
      h('h2', { class: 'carte__titre' }, 'Indicateurs (central)'),
      (() => {
        const grille = h('div', { class: 'indicateurs' });
        ctx.lier((r) => {
          const c = r.scenarios.central;
          const vise = e.bien.prixAchat;
          grille.replaceChildren(
            indicateur('Prix d’achat maximum', euros(r.prixAchatMax),
              r.prixAchatMax != null && vise ? `${r.prixAchatMax >= vise ? 'Marge de négociation' : 'Au-dessus de'} : ${euros(Math.abs(r.prixAchatMax - vise))}` : `Pour ${pct(e.reglages.objectifs.margeCible)} de marge`),
            indicateur('Rendement sur apport', pct(c.rendementApport), c.rendementApport == null ? 'Apport non renseigné' : c.rendementAnnualise != null ? `${pct(c.rendementAnnualise)} annualisé` : null),
            indicateur('Marge nette / revente', pct(c.pctRevente)),
            indicateur('Rémunération horaire', r.remunerationHoraire != null ? `${euros(r.remunerationHoraire)}/h` : '—',
              r.remunerationHoraire != null ? null : 'Heures non renseignées'),
            c.resteAFinancer > 0.5 ? indicateur('Reste à financer', euros(c.resteAFinancer), 'Apport + emprunt insuffisants') : null,
          );
        });
        return grille;
      })(),
    ),

    h('section', { class: 'carte' },
      h('h2', { class: 'carte__titre' }, 'Coût de revient (central)'),
      decomposition(ctx),
    ),

    h('a', { class: 'bouton bouton--principal bouton--large', href: lien({ ecran: 'fiche', id: e.id }) },
      picto('export'), 'Voir la fiche et exporter en PDF'),
  ];
}
