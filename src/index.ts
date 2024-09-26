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
app.use(express.static(path.join(__dirname, '..', 'public')));

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

// Fonction pour vérifier les champs obligatoires
function checkRequiredFields(data: any): string[] {
    const requiredFields = ['nom', 'prenom', 'societe', 'email', 'telephone', 'type_acquereur'];
    return requiredFields.filter(field => !data[field]);
}

// Fonction pour extraire le JSON valide de la réponse
function extractValidJSON(text: string): any {
    const jsonRegex = /{[\s\S]*}/;
    const match = text.match(jsonRegex);
    if (match) {
        try {
            return JSON.parse(match[0]);
        } catch (error) {
            console.error(chalk.red("Error parsing extracted JSON:", error));
            return null;
        }
    }
    return null;
}

// Endpoint modifié pour analyser une histoire et extraire les informations structurées
app.post('/analyze-story', async (req, res) => {
    console.log(chalk.green("Received request to /analyze-story"));
    const { story } = req.body;

    if (!story) {
        console.log(chalk.red("No story provided in the request"));
        return res.status(400).json({ error: "A story is required." });
    }

    try {
        console.log(chalk.yellow("Analyzing story..."));

        const prompt = `Analyze the following story and extract the information into a structured JSON format. Return ONLY the JSON, without any additional text before or after. Follow this exact structure:

{
  "nom": "",
  "prenom": "",
  "societe": "",
  "email": "",
  "telephone": "",
  "type_acquereur": "",
  "cible_recherchee": {
    "secteur": "",
    "code_NAF": ""
  },
  "nombre_collaborateurs": "",
  "localisations_geographiques": [],
  "niveau_CA": {
    "minimum": 0,
    "maximum": 0,
    "unite": ""
  },
  "calendrier": "",
  "fonds_disponibles": {
    "montant": 0,
    "unite": ""
  },
  "elements_importants": []
}

Fill in the JSON structure with the information from the story. If a field is not mentioned in the story, leave it as an empty string or array. For numerical values, use 0 if not specified. Here's the story:

${story}`;

        let responseText = "";
        await session.prompt(prompt, {
            onTextChunk(chunk) {
                responseText += chunk;
            }
        });

        // Extract and parse the JSON response
        const extractedInfo = extractValidJSON(responseText);

        if (!extractedInfo) {
            return res.status(500).json({ error: "Failed to extract valid JSON from the response." });
        }

        console.log(chalk.green("Analysis complete. Information extracted:", JSON.stringify(extractedInfo, null, 2)));

        // Check for missing required fields
        const missingFields = checkRequiredFields(extractedInfo);

        if (missingFields.length > 0) {
            return res.status(400).json({
                error: "Missing required information",
                missingFields: missingFields
            });
        }

        // Insérer les données extraites dans la base de données
        const query = `INSERT INTO analyzed_stories (
            nom, prenom, societe, email, telephone, type_acquereur,
            secteur, code_NAF, nombre_collaborateurs, localisations_geographiques,
            niveau_CA_minimum, niveau_CA_maximum, niveau_CA_unite,
            calendrier, fonds_disponibles_montant, fonds_disponibles_unite, elements_importants
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [
            extractedInfo.nom,
            extractedInfo.prenom,
            extractedInfo.societe,
            extractedInfo.email,
            extractedInfo.telephone,
            extractedInfo.type_acquereur,
            extractedInfo.cible_recherchee.secteur,
            extractedInfo.cible_recherchee.code_NAF,
            extractedInfo.nombre_collaborateurs,
            JSON.stringify(extractedInfo.localisations_geographiques),
            extractedInfo.niveau_CA.minimum,
            extractedInfo.niveau_CA.maximum,
            extractedInfo.niveau_CA.unite,
            extractedInfo.calendrier,
            extractedInfo.fonds_disponibles.montant,
            extractedInfo.fonds_disponibles.unite,
            JSON.stringify(extractedInfo.elements_importants)
        ];

        db.run(query, values, function(err) {
            if (err) {
                console.error(chalk.red("Error inserting data into database:", err));
                return res.status(500).json({ error: "An error occurred while saving the analyzed data." });
            }
            console.log(chalk.green("Data inserted successfully. ID:", this.lastID));
            res.json({ ...extractedInfo, id: this.lastID });
        });
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

// home route
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Route formulaire acquereur
app.get('/acquereur', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'acquereur.html'));
});

// Endpoint API pour poser une question au LLM
app.post('/ask', async (req, res) => {
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ error: "A question is required." });
    }

    try {
        console.log(chalk.yellow("User: ") + question);

        let responseText = "";
        const answer = await session.prompt(question, {
            onTextChunk(chunk) {
                responseText += chunk;
            }
        });

        // Optionnel : renvoyer la réponse consolidée ou la réponse streamée
        res.json({ answer: responseText });
    } catch (error) {
        console.error("Error during LLM processing:", error);
        res.status(500).json({ error: "An error occurred while processing the question." });
    }
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
