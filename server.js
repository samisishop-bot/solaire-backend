const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.post('/api/dimensionner', async (req, res) => {
  try {
    const { appareils } = req.body;

    if (!appareils || !Array.isArray(appareils) || appareils.length === 0) {
      return res.status(400).json({ error: "Veuillez fournir une liste d'appareils validée." });
    }

    let energieJournaliereWh = 0;
    let puissancePointeW = 0;
    let aDesChargesInductives = false;

    // Calcul sécurisé
    appareils.forEach(app => {
      const qte = Number(app.quantite) || 1;
      const puissance = Number(app.puissance_w || app.puissance_watts) || 0;
      const heures = Number(app.heures_jour) || 0;

      energieJournaliereWh += puissance * heures;

      if (app.est_inductif) {
        puissancePointeW += puissance * 3; // Coefficient x3 pour surtension
        aDesChargesInductives = true;
      } else {
        puissancePointeW += puissance;
      }
    });

    // Seuil de tension selon le matériel Felicity en stock
    let tensionRecommandee = 12;
    if (puissancePointeW > 3200) {
      tensionRecommandee = 48;
    } else if (puissancePointeW > 1000) {
      tensionRecommandee = 24;
    }

    // 1. Sélection de l'onduleur
    const onduleurQuery = `
      SELECT * FROM equipements 
      WHERE type = 'onduleur' 
        AND puissance_va >= $1 
        AND tension_v = $2
      ORDER BY puissance_va ASC, prix_fcfa ASC 
      LIMIT 1;
    `;
    let onduleurRes = await pool.query(onduleurQuery, [puissancePointeW, tensionRecommandee]);
    let onduleur = onduleurRes.rows[0];

    // Fallback si aucun modèle ne correspond exactement à la tension
    if (!onduleur) {
      const fallbackQuery = `
        SELECT * FROM equipements 
        WHERE type = 'onduleur' 
          AND puissance_va >= $1 
        ORDER BY puissance_va ASC, prix_fcfa ASC 
        LIMIT 1;
      `;
      const fallbackRes = await pool.query(fallbackQuery, [puissancePointeW]);
      onduleur = fallbackRes.rows[0] || "Aucun onduleur correspondant en stock";
    }

    // 2. Sélection de la batterie SUNC
    const tensionBatterie = (onduleur && onduleur.tension_v) ? onduleur.tension_v : tensionRecommandee;
    const batterieQuery = `
      SELECT * FROM equipements 
      WHERE type = 'batterie' 
        AND tension_v = $1
      ORDER BY capacite_wh DESC 
      LIMIT 1;
    `;
    const batterieRes = await pool.query(batterieQuery, [tensionBatterie]);
    const batterie = batterieRes.rows[0] || "Aucune batterie correspondante en stock";

    res.json({
      succes: true,
      bilan_energetique: {
        energie_journaliere_wh: energieJournaliereWh,
        puissance_pointe_w: puissancePointeW,
        tension_systeme_recommandee_v: tensionBatterie,
        contrainte_inductive: aDesChargesInductives
      },
      recommandations: {
        onduleur: onduleur,
        batterie: batterie
      }
    });

  } catch (err) {
    console.error("Erreur calcul backend:", err);
    res.status(500).json({ error: "Erreur interne lors du calcul du dimensionnement.", details: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
