// Étape 4 — Financement, portage et revente.
import { h, format } from './dom.js';
import { champNombre, choix, interrupteur, section, duo } from './composants.js';

const MODES_REVENTE = [
  { valeur: 'saisi', libelle: 'Prix saisi' },
  { valeur: 'm2', libelle: 'Prix au m² du secteur' },
];

/** Petit texte calculé, mis à jour en direct. */
function calcule(ctx, texte) {
  const el = h('p', { class: 'calcule' });
  ctx.lier((r) => { el.textContent = texte(r); });
  return el;
}

export function ecranFinancement(ctx) {
  const e = ctx.estimation;
  const { financement: f, portage: po, revente: rv, reglages } = e;
  const pf = (cle, opts) => ctx.poser(f, cle, opts);
  const pp = (cle) => ctx.poser(po, cle);
  const pr = (cle, opts) => ctx.poser(rv, cle, opts);
  const central = (r) => r.scenarios.central;

  return [
    h('h1', {}, 'Financement & revente'),

    section('Acquisition',
      champNombre({ libelle: 'Frais d’agence acquéreur', unite: '€', valeur: f.fraisAgenceAcquereur, aide: 'Si à la charge de l’acheteur', onChange: pf('fraisAgenceAcquereur') }),
      calcule(ctx, (r) => `Frais d’acquisition (${format.pourcent(reglages.fraisAcquisition.RP)}) : ${format.euros(central(r).detail.fraisAcquisition)}`),
    ),

    section('Prêt',
      duo(
        champNombre({ libelle: 'Apport', unite: '€', valeur: f.apport, onChange: pf('apport') }),
        champNombre({ libelle: 'Montant emprunté', unite: '€', valeur: f.emprunt, onChange: pf('emprunt') }),
      ),
      duo(
        champNombre({ libelle: 'Taux nominal', unite: '%', echelle: 100, valeur: f.tauxAnnuel, onChange: pf('tauxAnnuel') }),
        champNombre({ libelle: 'Assurance prêt', unite: '%/an', aide: 'Taux annuel', echelle: 100, valeur: f.assuranceTauxAnnuel, onChange: pf('assuranceTauxAnnuel') }),
      ),
      duo(
        champNombre({ libelle: 'Frais de dossier', unite: '€', valeur: f.fraisDossier, onChange: pf('fraisDossier') }),
        champNombre({ libelle: 'Frais de garantie', unite: '€', valeur: f.fraisGarantie, onChange: pf('fraisGarantie') }),
      ),
      interrupteur({
        libelle: 'Indemnités de remboursement anticipé', coche: f.ira !== false,
        aide: 'Plafond légal : 6 mois d’intérêts ou 3 % du capital',
        onChange: pf('ira'),
      }),
      calcule(ctx, (r) => {
        const fin = central(r).detail.financement;
        return `Coût du crédit sur la durée : ${format.euros(fin.total)} (dont intérêts ${format.euros(fin.interets)}, IRA ${format.euros(fin.ira)})`;
      }),
      calcule(ctx, (r) => {
        const reste = central(r).resteAFinancer;
        return reste > 0.5 ? `Reste à financer : ${format.euros(reste)}` : 'Plan de financement bouclé';
      }),
    ),

    section('Portage',
      champNombre({ libelle: 'Durée de portage', unite: 'mois', valeur: f.dureeMois, aide: 'De l’achat à la revente', onChange: pf('dureeMois') }),
      duo(
        champNombre({ libelle: 'Taxe foncière', unite: '€/an', valeur: po.taxeFonciereAnnuelle, onChange: pp('taxeFonciereAnnuelle') }),
        champNombre({ libelle: 'Assurance', unite: '€/an', aide: 'PNO ou habitation', valeur: po.assuranceAnnuelle, onChange: pp('assuranceAnnuelle') }),
      ),
      duo(
        champNombre({ libelle: 'Énergie', unite: '€/mois', aide: 'Et abonnements', valeur: po.energieMensuelle, onChange: pp('energieMensuelle') }),
        champNombre({ libelle: 'Copropriété', unite: '€/mois', aide: 'Charges', valeur: po.coproMensuelle, onChange: pp('coproMensuelle') }),
      ),
      calcule(ctx, (r) => `Portage total : ${format.euros(central(r).detail.portage.total)}`),
    ),

    section('Revente',
      choix({ libelle: 'Prix de revente', options: MODES_REVENTE, valeur: rv.mode, onChange: pr('mode', { structure: true }) }),
      rv.mode === 'm2'
        ? champNombre({ libelle: 'Prix au m² du secteur', unite: '€/m²', valeur: rv.prixM2, onChange: pr('prixM2') })
        : champNombre({ libelle: 'Prix de revente', unite: '€', valeur: rv.prix, onChange: pr('prix') }),
      rv.mode === 'm2'
        ? calcule(ctx, (r) => (e.bien.surfaceHabitable
          ? `Soit ${format.euros(central(r).prixRevente)} pour ${format.surface(e.bien.surfaceHabitable)}`
          : 'Renseignez la surface habitable (étape « Le bien »)'))
        : null,
      duo(
        champNombre({ libelle: 'Frais d’agence', unite: '%', echelle: 100, valeur: rv.fraisAgencePct, onChange: pr('fraisAgencePct') }),
        champNombre({ libelle: 'Diagnostics', unite: '€', valeur: rv.diagnostics, onChange: pr('diagnostics') }),
      ),
      champNombre({ libelle: 'Déménagement', unite: '€', valeur: rv.demenagement, onChange: pr('demenagement') }),
      calcule(ctx, (r) => `Frais de vente : ${format.euros(central(r).detail.fraisVente.total)}`),
    ),
  ];
}
