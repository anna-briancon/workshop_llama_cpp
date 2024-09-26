import {fileURLToPath} from "url";
import path from "path";
import chalk from "chalk";
// @ts-ignore
import express from "express";
import {getLlama, LlamaChatSession} from "node-llama-cpp";
import db from './database.js';

const bodyParser = require('body-parser');

const app = express();
app.use(express.json());
// Middleware pour traiter les requêtes JSON
app.use(bodyParser.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsFolderDirectory = path.join(__dirname, "..", "models");

// Charger le modèle et le contexte au démarrage du serveur
const llama = await getLlama();

console.log(chalk.yellow("Loading model..."));
const model = await llama.loadModel({
    modelPath: path.join(modelsFolderDirectory, "Meta-Llama-3.1-8B-Instruct.Q8_0.gguf")
});

console.log(chalk.yellow("Creating context..."));
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});

// Endpoint modifié pour analyser une histoire et extraire les informations dans un seul paragraphe
app.post('/analyze-story', async (req, res) => {
    console.log(chalk.green("Received request to /analyze-story"));
    const { story } = req.body;

    if (!story) {
        console.log(chalk.red("No story provided in the request"));
        return res.status(400).json({ error: "A story is required." });
    }

    try {
        console.log(chalk.yellow("Analyzing story..."));

        const prompt = `Analyze the following story and extract these specific information:
Coordonnées de l'acquéreur (nom, prénom, société, email, téléphone), type d'acquéreur, cible recherchée (secteurs d'activité avec code NAF, nombre de collaborateurs, localisations géographiques, niveau moyen de CA), autres informations pertinentes (calendrier, fonds disponibles, éléments importants).
Return ONLY the extracted information in a single paragraph, without any additional phrases or explanations. Here's the story:

${story}

Extracted information:`;

        let responseText = "";
        await session.prompt(prompt, {
            onTextChunk(chunk) {
                responseText += chunk;
            }
        });

        console.log(chalk.green("Analysis complete. Information extracted:", responseText));
        res.json({ text_story: responseText.trim() });
    } catch (error) {
        console.error(chalk.red("Error during story analysis:", error));
        res.status(500).json({ error: "An error occurred while analyzing the story." });
    }
});

// Route formulaire cédant
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Récupèrer les info de cédant ici
app.post('/submit-info', (req, res) => {
    // On stock les infos dans la bd 
    const { companyStory } = req.body;

    if (!companyStory) {
        return res.status(400).json({ error: "Le champ 'companyStory' est requis." });
    }

    const query = `INSERT INTO company (story) VALUES (?)`;

    db.run(query, [companyStory], function (err) {
        if (err) {
            console.error("Erreur lors de l'insertion dans la base de données :", err);
            return res.status(500).json({ error: "Erreur lors de l'enregistrement de l'histoire." });
        }

        console.log("Histoire de l'entreprise enregistrée avec succès, ID:", this.lastID);
        res.status(200).json({ message: "Histoire de l'entreprise enregistrée avec succès." });
    });
});

// Route formulaire acquereur
app.get('/acquereur', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'acquereur.html'));
});

// Route pour traiter la question et envoyer une réponse de l'IA
app.post('/submit-question', async (req, res) => {
    const userQuestion = req.body.question;

    try {
        // Simuler une requête à votre modèle IA (vous devez remplacer cela par la vraie implémentation)
        const aiResponse = await fetch('http://localhost:3068/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question: userQuestion }),
        });

        const data = await aiResponse.json();

        // Retourner la réponse à la requête du front-end
        res.json({ answer: data.answer });
    } catch (error) {
        console.error(error);
        res.status(500).json({ answer: 'Erreur lors de la communication avec l\'IA.' });
    }
});

// Lancer le serveur
const PORT = 3068;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
