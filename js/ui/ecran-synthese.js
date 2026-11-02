// Étape 5 — Synthèse : trois scénarios, indicateurs et accès à la fiche PDF.
import { h, picto, format } from './dom.js';
import { lien } from '../router.js';
import { LIBELLES_VERDICT } from './etape.js';
import { confirmer, notifier } from './dialogue.js';
import * as store from '../data/store.js';

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

function tableauScenarios(ctx, rapide = false) {
  const rangee = (libelle, fn, cls = '') => h('tr', { class: cls },
    h('th', { scope: 'row' }, libelle),
    ...SCENARIOS.map(([n]) => h('td', { class: n === 'central' ? 'central' : '' }, texte(ctx, (r) => fn(r.scenarios[n])))));

  return h('div', { class: 'tableau-defilant', tabindex: '0', role: 'region', 'aria-label': 'Tableau des trois scénarios' },
    h('table', { class: 'tableau' },
      h('thead', {}, h('tr', {}, h('th', {}, h('span', { class: 'visuellement-cache' }, 'Indicateur')),
        ...SCENARIOS.map(([n, l]) => h('th', { scope: 'col', class: n === 'central' ? 'central' : '' }, l)))),
      h('tbody', {},
        rangee('Travaux', (s) => ({ bas: 'Bas', moyen: 'Moyen', haut: 'Haut' })[s.fourchette]),
        rapide ? null : rangee('Portage', (s) => `${s.dureeMois} mois`),
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
  const rapide = e.mode === 'rapide';

  return [
    h('h1', {}, 'Synthèse'),

    r0.complet ? null : h('p', { class: 'rappel rappel--attention' }, picto('info'),
      h('span', {}, rapide
        ? 'Renseignez le prix affiché et le prix de revente (« Le bien ») pour obtenir un verdict.'
        : 'Renseignez au moins le prix affiché (« Le bien ») et le prix de revente (« Financement & revente ») pour obtenir un verdict.')),

    h('section', { class: 'carte resultat' },
      h('p', { class: 'resultat__libelle' }, 'Marge nette · scénario central'),
      texte(ctx, (r) => (r.complet ? euros(r.scenarios.central.margeNette) : '— €'), { class: 'resultat__valeur chiffre' }),
      h('p', { class: 'resultat__ligne' },
        pastille(ctx, (r) => r.scenarios.central.verdict),
        texte(ctx, (r) => (r.complet ? `${pct(r.scenarios.central.pctCoutRevient)} du coût de revient · objectif ${pct(e.reglages.objectifs.margeCible)}` : ''))),
      texte(ctx, (r) => (r.complet ? `Calculée au prix ${r.prixNegocie ? 'négocié' : 'affiché'} de ${euros(r.prixAchatRetenu)}${rapide ? ', sans prêt ni portage' : ''}.` : ''), { class: 'champ__aide resultat__base' }),
      h('p', { class: 'champ__aide' }, 'Exonération de plus-value conditionnée à une résidence principale réelle.'),
    ),

    preconisations(ctx),

    h('section', { class: 'carte' },
      h('h2', { class: 'carte__titre' }, 'Trois scénarios'),
      tableauScenarios(ctx, rapide),
      h('p', { class: 'champ__aide' }, rapide
        ? `Pessimiste : travaux en fourchette haute, revente −${pct(e.reglages.scenarios.abattementRevente)}.`
        : `Pessimiste : travaux en fourchette haute, revente −${pct(e.reglages.scenarios.abattementRevente)}, portage +${e.reglages.scenarios.moisSupplementaires} mois.`),
    ),

    rapide ? null : h('section', { class: 'carte' },
      h('h2', { class: 'carte__titre' }, 'Indicateurs (central)'),
      (() => {
        const grille = h('div', { class: 'indicateurs' });
        ctx.lier((r) => {
          const c = r.scenarios.central;
          // filter(Boolean) : un null passé à replaceChildren s'afficherait « null ».
          grille.replaceChildren(...[
            indicateur('Marge nette / revente', pct(c.pctRevente)),
            rapide ? null : indicateur('Rendement sur apport', pct(c.rendementApport),
              c.rendementApport == null ? 'Apport non renseigné' : c.rendementAnnualise != null ? `${pct(c.rendementAnnualise)} annualisé` : null),
            rapide ? null : indicateur('Rémunération horaire', r.remunerationHoraire != null ? `${euros(r.remunerationHoraire)}/h` : '—',
              r.remunerationHoraire != null ? null : 'Heures non renseignées'),
            !rapide && c.resteAFinancer > 0.5 ? indicateur('Reste à financer', euros(c.resteAFinancer), 'Apport + emprunt insuffisants') : null,
          ].filter(Boolean));
        });
        return grille;
      })(),
    ),

    h('section', { class: 'carte' },
      h('h2', { class: 'carte__titre' }, 'Coût de revient (central)'),
      decomposition(ctx),
    ),

    blocReglages(ctx),

    h('a', { class: 'bouton bouton--principal bouton--large', href: lien({ ecran: 'fiche', id: e.id }) },
      picto('export'), 'Voir la fiche et exporter en PDF'),
  ];
}

/** Les réglages de l'estimation diffèrent-ils des réglages actuels ? */
export const reglagesDifferents = (e) => JSON.stringify(e.reglages) !== JSON.stringify(store.reglages());

function blocReglages(ctx) {
  const e = ctx.estimation;
  if (!reglagesDifferents(e)) {
    return h('p', { class: 'champ__aide centre' }, 'Calculée avec les réglages actuels.');
  }
  return h('section', { class: 'carte carte--info' },
    h('h2', { class: 'carte__titre' }, 'Grille de prix différente'),
    h('p', {}, 'Cette estimation a été calculée avec une grille ou des réglages qui ont changé depuis. Elle les conserve pour rester reproductible.'),
    h('button', {
      type: 'button', class: 'bouton bouton--secondaire bouton--plein',
      onclick: async () => {
        if (!await confirmer({
          titre: 'Recalculer avec les réglages actuels\u00a0?',
          texte: 'La grille de prix, les coefficients et les objectifs actuels remplaceront ceux de cette estimation. Les résultats peuvent changer.',
          libelle: 'Recalculer',
        })) return;
        ctx.changer((est) => { est.reglages = structuredClone(store.reglages()); }, { structure: true });
        notifier('Estimation recalculée');
      },
    }, 'Recalculer avec les réglages actuels'),
  );
}

/**
 * Préconisations : prix d'achat à viser selon les travaux, et budget travaux à ne pas dépasser
 * au prix retenu. Utiles dès que le prix de revente est connu.
 */
function preconisations(ctx) {
  const e = ctx.estimation;
  const cible = pct(e.reglages.objectifs.margeCible);
  const corps = h('div', { class: 'preconisations' });

  ctx.lier((r) => {
    if (r.prixAchatMax == null && r.budgetTravauxMax == null) {
      corps.replaceChildren(h('p', { class: 'champ__aide' }, 'Renseignez le prix de revente pour obtenir des préconisations.'));
      return;
    }
    const c = r.scenarios.central;
    const travauxEstimes = c.detail.travaux + c.detail.dommagesOuvrage;
    const base = r.prixNegocie ? 'négocié' : 'affiché';
    const blocs = [];

    if (r.prixAchatMax != null) {
      const ecart = r.prixAchatRetenu ? r.prixAchatRetenu - r.prixAchatMax : null;
      blocs.push(h('div', { class: 'preco' },
        h('span', { class: 'preco__libelle' }, 'Prix d’achat à viser'),
        h('strong', { class: 'preco__valeur chiffre' }, `${euros(r.prixAchatMax)} max.`),
        h('span', { class: 'preco__detail' },
          `Pour ${cible} de marge avec les travaux estimés (${euros(travauxEstimes)}).`,
          r.prixAchatMaxPrudent != null ? ` Prudent (travaux hauts, revente en baisse) : ${euros(Math.max(0, r.prixAchatMaxPrudent))}.` : ''),
        ecart != null ? h('span', { class: `preco__ecart preco__ecart--${ecart > 0 ? 'alerte' : 'ok'}` },
          ecart > 0
            ? `Le prix ${base} dépasse de ${euros(ecart)} : à négocier.`
            : `Le prix ${base} laisse ${euros(-ecart)} de marge de manœuvre.`) : null,
      ));
    }

    if (r.budgetTravauxMax != null) {
      const reste = r.budgetTravauxMax - travauxEstimes;
      const possible = r.budgetTravauxMax > 0;
      blocs.push(h('div', { class: 'preco' },
        h('span', { class: 'preco__libelle' }, 'Budget travaux à ne pas dépasser'),
        h('strong', { class: 'preco__valeur chiffre' }, possible ? euros(r.budgetTravauxMax) : 'Aucun'),
        h('span', { class: 'preco__detail' }, possible
          ? `Aléas compris, au prix ${base} de ${euros(r.prixAchatRetenu)}, pour ${cible} de marge.`
          : `Au prix ${base} de ${euros(r.prixAchatRetenu)}, la marge cible n’est pas atteignable même sans travaux.`),
        possible ? h('span', { class: `preco__ecart preco__ecart--${reste < 0 ? 'alerte' : 'ok'}` },
          reste < 0
            ? `Travaux estimés (${euros(travauxEstimes)}) au-dessus du budget de ${euros(-reste)}.`
            : `Travaux estimés (${euros(travauxEstimes)}) : il reste ${euros(reste)} de marge sur ce budget.`) : null,
      ));
    }
    corps.replaceChildren(...blocs);
  });

  return h('section', { class: 'carte' }, h('h2', { class: 'carte__titre' }, 'Préconisations'), corps);
}
