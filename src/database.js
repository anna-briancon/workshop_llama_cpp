import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtenir le chemin absolu du répertoire courant
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Chemin vers le fichier de la base de données SQLite
const dbPath = path.join(__dirname, 'database', 'xlinks.db');

// Créer une connexion avec la base de données SQLite
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Erreur lors de l'ouverture de la base de données :", err);
    } else {
        console.log("Connexion à la base de données SQLite réussie.");
    }
});

// Créer une table pour stocker les informations de l'entreprise
// Dans database.js
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS analyzed_stories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT,
            prenom TEXT,
            societe TEXT,
            email TEXT,
            telephone TEXT,
            type_acquereur TEXT,
            secteur TEXT,
            code_NAF TEXT,
            nombre_collaborateurs TEXT,
            localisations_geographiques TEXT,
            niveau_CA_minimum INTEGER,
            niveau_CA_maximum INTEGER,
            niveau_CA_unite TEXT,
            calendrier TEXT,
            fonds_disponibles_montant INTEGER,
            fonds_disponibles_unite TEXT,
            elements_importants TEXT
        )
    `, (err) => {
        if (err) {
            console.error("Erreur lors de la création de la table :", err);
        } else {
            console.log("Table 'analyzed_stories' créée ou déjà existante.");
        }
    });
});

export default db;
