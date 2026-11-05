// Étape 3 — Gros postes : travaux globaux au bien.
import { h, format } from './dom.js';
import { champNombre, choix, interrupteur, section, duo, legendeObligatoire } from './composants.js';
import { sortieCout } from './ecran-pieces.js';
import { quantitePoste } from '../calc/engine.js';

const MODES = [
  { valeur: 'artisan', libelle: 'Artisan' },
  { valeur: 'nous', libelle: 'Nous-mêmes' },
];
const SUFFIXE_PRIX = { m2hab: '/m² habitable', m2: '/m²', unite: '/unité', forfait: ' le forfait' };
const UNITE_QTE = { m2hab: 'm²', m2: 'm²', unite: 'u.', forfait: '×' };
const CHOIX_DO = [
  { valeur: 'auto', libelle: 'Auto' },
  { valeur: 'oui', libelle: 'Oui' },
  { valeur: 'non', libelle: 'Non' },
];

function lignePoste(ctx, poste) {
  const def = ctx.estimation.reglages.grille.postes[poste.cle];
  const p = (cle, opts) => ctx.poser(poste, cle, opts);
  const qteParDefaut = quantitePoste({ quantite: null }, def, ctx.estimation.bien);
  const prixUnitaire = `${format.euros(def.moyen)}${SUFFIXE_PRIX[def.unite]} (prix moyen)`;

  const details = poste.actif ? h('div', { class: 'poste__details' },
    duo(
      champNombre({
        libelle: def.unite === 'forfait' ? 'Nombre' : `Quantité (${UNITE_QTE[def.unite]})`,
        unite: UNITE_QTE[def.unite], valeur: poste.quantite,
        placeholder: qteParDefaut ? String(qteParDefaut) : '',
        aide: def.unite === 'm2hab' ? 'Vide : surface habitable' : null,
        // Sans quantité, seuls les forfaits (1) et les postes au m² habitable ont une valeur par défaut.
        obligatoire: def.unite !== 'forfait' && def.unite !== 'm2hab',
        onChange: p('quantite'), id: `qte-${poste.cle}`,
      }),
      poste.cle === 'divers'
        ? champNombre({
          libelle: 'Montant (moyen)', unite: '€', valeur: poste.prix?.moyen ?? null,
          aide: 'Bas −20 %, haut +30 %', obligatoire: true,
          onChange: (v) => ctx.changer(() => {
            poste.prix = v == null ? null : { bas: v * 0.8, moyen: v, haut: v * 1.3 };
          }),
        })
        : null,
    ),
    choix({ libelle: 'Réalisation', options: MODES, valeur: poste.mode, onChange: p('mode') }),
    interrupteur({
      libelle: 'Structurel', coche: poste.structurel, aide: 'Déclenche la dommages-ouvrage',
      onChange: p('structurel'),
    }),
    sortieCout(ctx, (r) => r.travaux.lignes.find((l) => l.id === poste.cle)),
  ) : null;

  return h('article', { class: `poste${poste.actif ? ' poste--actif' : ''}` },
    interrupteur({
      libelle: def.libelle,
      aide: poste.cle === 'divers' ? 'Montant libre' : prixUnitaire,
      coche: poste.actif,
      onChange: (v) => ctx.changer(() => { poste.actif = v; }, { structure: true, focus: v ? `#qte-${poste.cle}` : null }),
    }),
    details,
  );
}

export function ecranPostes(ctx) {
  const e = ctx.estimation;
  return [
    h('h1', {}, 'Gros postes'),
    legendeObligatoire(),
    h('p', { class: 'champ__aide' }, 'Cochez les postes à prévoir. Les prix viennent de la grille (modifiable dans les réglages).'),
    h('div', { class: 'carte liste-postes' }, e.postes.map((poste) => lignePoste(ctx, poste))),

    section('Travaux : paramètres',
      choix({
        libelle: 'Dommages-ouvrage', options: CHOIX_DO, valeur: e.travaux.dommagesOuvrage,
        onChange: ctx.poser(e.travaux, 'dommagesOuvrage'),
      }),
      h('p', { class: 'champ__aide' }, (() => {
        const t = h('span');
        ctx.lier((r) => {
          t.textContent = r.travaux.dommagesOuvrageActive
            ? `Incluse : ${format.euros(r.travaux.dommagesOuvrage.moyen)} (${format.pourcent(e.reglages.dommagesOuvrage.taux)} des travaux)`
            : 'Non incluse. « Auto » l’active dès qu’un poste est structurel.';
        });
        return t;
      })()),
      champNombre({
        libelle: 'Temps de travail estimé', unite: 'h', valeur: e.travaux.heuresEstimees,
        aide: 'Facultatif, pour la rémunération horaire implicite',
        onChange: ctx.poser(e.travaux, 'heuresEstimees'),
      }),
    ),

    h('div', { class: 'total' },
      h('span', {}, 'Total travaux avec aléas'),
      sortieCout(ctx, (r) => r.travaux.total),
    ),
  ];
}
