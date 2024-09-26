import {fileURLToPath} from "url";
import path from "path";
import chalk from "chalk";
// @ts-ignore
import express from "express";
import {getLlama, LlamaChatSession} from "node-llama-cpp";

const app = express();
app.use(express.json());

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

// Lancer le serveur
const PORT = 3068;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
