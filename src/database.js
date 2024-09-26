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
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS company (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            story TEXT NOT NULL
        )
    `, (err) => {
        if (err) {
            console.error("Erreur lors de la création de la table :", err);
        } else {
            console.log("Table 'company' créée ou déjà existante.");
        }
    });
});

export default db;
