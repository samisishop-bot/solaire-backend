 const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Connexion à la base de données PostgreSQL Neon.tech
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Route de test
app.get('/', (req, res) => {
  res.json({ status: "OK", message: "API Solaire Sam Business GROUP opérationnelle" });
});

// Route principale : Calcul du dimensionnement
app.post('/api/dimensionner', async (req, res) => {
  try {
    const { appareils } = req.body; 

    if (!appareils || !Array.isArray(appareils) || appareils.length === 0) {
      return res.status(400).json({ error: "Veuillez fournir une liste d'appareils valide." });
    }

    let energieTotaleWh = 0;
    let puissancePointeW = 0;
    let aDesChargeInductives = false;

    appareils.forEach(app => {
      const qte = app.quantite || 1;
      const pUnit = app.puissance_w;
      const hJour = app.heures_jour;
      
      // Facteur de démarrage (x3 pour appareils inductifs / moteurs)
      const facteurDemarrage = app.est_inductif ? 3 : 1;
      if (app.est_inductif) aDesChargeInductives = true;

      energieTotaleWh += (pUnit * qte * hJour);
      puissancePointeW += (pUnit * qte * facteurDemarrage);
    });

    // Seuil de tension système (Togo / Standard off-grid)
    let tensionBatterieV = 24;
    if (puissancePointeW > 6000 || (aDesChargeInductives && puissancePointeW > 3000)) {
      tensionBatterieV = 48;
    } else if (puissancePointeW <= 1500) {
      tensionBatterieV = 12;
    }

    // Récupération des équipements compatibles en BDD (Neon)
    const onduleursRes = await pool.query(
      "SELECT * FROM equipements WHERE type = 'onduleur' AND puissance_va >= $1 AND tension_v = $2 ORDER BY puissance_va ASC LIMIT 1",
      [puissancePointeW, tensionBatterieV]
    );

    const batteriesRes = await pool.query(
      "SELECT * FROM equipements WHERE type = 'batterie' AND tension_v = $1 ORDER BY capacite_ah DESC",
      [tensionBatterieV]
    );

    res.json({
      succes: true,
      bilan_energetique: {
        energie_journaliere_wh: energieTotaleWh,
        puissance_pointe_w: puissancePointeW,
        tension_systeme_recommandee_v: tensionBatterieV,
        contrainte_inductive: aDesChargeInductives
      },
      recommandations: {
        onduleur: onduleursRes.rows[0] || "Aucun onduleur exact trouvé en stock, privilégier la gamme supérieure.",
        batteries_compatibles: batteriesRes.rows
      }
    });

  } catch (err) {
    console.error("Erreur calcul backend:", err);
    res.status(500).json({ error: "Erreur interne lors du calcul du dimensionnement." });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
