const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Catalogue et Tarifs sécurisés (uniquement visibles côté serveur)
const stockFelicitySunc = {
  onduleurs: [
    { model: "Onduleur 1kVA 12V IVCM Monophasé Felicity", kva: 1, price: 115000 },
    { model: "Onduleur 2kVA 24V PRO IVCM Monophasé Felicity", kva: 2, price: 144500 },
    { model: "Onduleur 3kVA 24V IVCM Monophasé Felicity", kva: 3, price: 185000 },
    { model: "Onduleur 3.2kVA 24V IVCM Monophasé Felicity", kva: 3.2, price: 180000 },
    { model: "Onduleur 3kVA 24V IVEM Monophasé Felicity", kva: 3, price: 195000 },
    { model: "Onduleur 6kVA 48V IVAM WiFi 2-MPPT Monophasé Felicity", kva: 6, price: 293000 },
    { model: "Onduleur 8kVA 48V Monophasé Felicity", kva: 8, price: 395000 },
    { model: "Onduleur 8kVA 48V IVBM Monophasé Felicity", kva: 423000 },
    { model: "Onduleur 10kVA 48V IVBM IP65 Monophasé Felicity", kva: 10, price: 478000 },
    { model: "Onduleur 12kVA 48V IVEM Monophasé Felicity", kva: 12, price: 505000 },
    { model: "Onduleur 10kVA 48V IVPM Monophasé Felicity", kva: 10, price: 515000 },
    { model: "Onduleur 10kVA 48V IVGM Triphasé Felicity", kva: 10, price: 790000 },
    { model: "Onduleur Hybride 30kVA IVGM Triphasé Felicity", kva: 30, price: "Sur devis" },
    { model: "Onduleur Hybride 50kVA IVGM Triphasé Felicity", kva: 50, price: "Sur devis" }
  ],
  batteries: [
    { model: "BATTERIE LITHIUM 12,8V 100Ah SUNC", kwh: 1.28, price: 88500 },
    { model: "BATTERIE LITHIUM 12,8V 200Ah SUNC", kwh: 2.56, price: 142000 },
    { model: "BATTERIE LITHIUM 12,8V 300Ah SUNC", kwh: 3.84, price: 165000 },
    { model: "Batterie Lithium Sunc 48V 10kWh", kwh: 10, price: 680000 },
    { model: "Batterie Lithium Sunc Écran Tactile 48V 10kWh", kwh: 10, price: 705000 },
    { model: "Batterie Lithium Sunc Écran Tactile 48V 15kWh", kwh: 15, price: 835000 }
  ]
};

// Route API sécurisée
app.post('/api/dimensionner', (req, res) => {
  const { appareils, psh = 4.8, autonomie = 1, pr = 0.85 } = req.body;

  let puissanceNominale = 0;
  let puissanceInrush = 0;
  let energieWh = 0;

  appareils.forEach(app => {
    const pTotal = app.puissance * app.qte;
    puissanceNominale += pTotal;
    energieWh += pTotal * app.heures;
    const facteur = app.inductif ? 3.5 : 1.0;
    puissanceInrush += pTotal * facteur;
  });

  const perteVideWh = 60 * 24;
  const energieEfficace = (energieWh + perteVideWh) / pr;
  const puissancePvWc = Math.ceil(energieEfficace / psh);
  const nbPanneaux = Math.ceil(puissancePvWc / 550);

  const onduleur = stockFelicitySunc.onduleurs.find(o => (o.kva * 1000) >= puissanceInrush) || stockFelicitySunc.onduleurs[stockFelicitySunc.onduleurs.length - 1];
  const besoinBatterieKwh = ((energieEfficace * autonomie) / 1000) / 0.8;
  const batterie = stockFelicitySunc.batteries.find(b => b.kwh >= besoinBatterieKwh) || stockFelicitySunc.batteries[stockFelicitySunc.batteries.length - 1];

  res.json({
    puissanceNominale,
    puissanceInrush: Math.round(puissanceInrush),
    energieKwh: (energieWh / 1000).toFixed(2),
    puissancePvWc,
    nbPanneaux,
    onduleur,
    batterie
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur actif sur le port ${PORT}`));
