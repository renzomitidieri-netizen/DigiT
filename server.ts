import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
function getAi() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to handle large file uploads
  app.use(express.json({ limit: "50mb" }));

  // API Routes
  app.post("/api/extract", async (req, res) => {
    try {
      const { mimeType, base64Data, model } = req.body;

      if (!mimeType || !base64Data) {
        return res.status(400).json({ error: "Faltan datos de la imagen o del documento." });
      }

      const ai = getAi();
      const response = await ai.models.generateContent({
        model: model || "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: "Extrae todo el texto de este documento o imagen. Devuelve únicamente el texto extraído, tal como aparece. No incluyas comentarios, explicaciones, markdown de bloques de código, ni introducciones. Omití cualquier tipo de decoración.",
            },
          ],
        },
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error("Error extracted text:", err);
      res.status(500).json({ error: err.message || "Ocurrió un error en la extracción lado del servidor." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
