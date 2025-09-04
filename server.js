// server.js - Node proxy para Airtable (recomendado para esconder o token)
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Variáveis de ambiente
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || "Clientes";

if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
  console.warn("[AVISO] Defina AIRTABLE_TOKEN e AIRTABLE_BASE_ID no ambiente de execução.");
}

const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

// Helper Axios
const api = axios.create({
  baseURL: AIRTABLE_API_URL,
  headers: {
    Authorization: `Bearer ${AIRTABLE_TOKEN}`,
    "Content-Type": "application/json"
  },
  timeout: 15000
});

// Utilitário para montar filterByFormula case-insensitive em {nome}
function buildFilterFormula(searchTerm) {
  if (!searchTerm) return undefined;
  const t = String(searchTerm).replace(/"/g, '\\"'); // escapar aspas
  // SEARCH retorna posição (>0) se encontrar; LOWER pra case-insensitive
  // Se você quer buscar em vários campos, junte com OR(...).
  return `SEARCH(LOWER("${t}"), LOWER({nome}))`;
}

// GET /api/records?search=&pageSize=10&offset=
app.get("/api/records", async (req, res) => {
  try {
    const { search = "", pageSize = 10, offset } = req.query;
    const params = {
      pageSize: Math.min(parseInt(pageSize, 10) || 10, 50),
      sort: [{ field: "nome", direction: "asc" }]
    };

    const formula = buildFilterFormula(search);
    if (formula) params.filterByFormula = formula;
    if (offset) params.offset = offset;

    const { data } = await api.get("", { params });
    res.json(data);
  } catch (err) {
    console.error("GET /api/records error:", err?.response?.data || err.message);
    res.status(err?.response?.status || 500).json({
      error: err?.response?.data || { message: "Falha ao listar registros" }
    });
  }
});

// POST /api/records  { nome, email, telefone }
app.post("/api/records", async (req, res) => {
  try {
    const { nome, email, telefone } = req.body;
    if (!nome || !email) {
      return res.status(400).json({ error: { message: "Campos obrigatórios: nome e email." } });
    }
    const payload = {
      fields: { nome, email, telefone }
    };
    const { data } = await api.post("", payload);
    res.status(201).json(data);
  } catch (err) {
    console.error("POST /api/records error:", err?.response?.data || err.message);
    res.status(err?.response?.status || 500).json({
      error: err?.response?.data || { message: "Falha ao criar registro" }
    });
  }
});

// PATCH /api/records/:id  { nome?, email?, telefone? }
app.patch("/api/records/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const fields = {};
    ["nome", "email", "telefone"].forEach((k) => {
      if (req.body[k] !== undefined) fields[k] = req.body[k];
    });
    if (!Object.keys(fields).length) {
      return res.status(400).json({ error: { message: "Nada para atualizar." } });
    }
    const { data } = await api.patch(`/${id}`, { fields });
    res.json(data);
  } catch (err) {
    console.error("PATCH /api/records/:id error:", err?.response?.data || err.message);
    res.status(err?.response?.status || 500).json({
      error: err?.response?.data || { message: "Falha ao editar registro" }
    });
  }
});

// DELETE /api/records/:id
app.delete("/api/records/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data } = await api.delete(`/${id}`);
    res.json(data);
  } catch (err) {
    console.error("DELETE /api/records/:id error:", err?.response?.data || err.message);
    res.status(err?.response?.status || 500).json({
      error: err?.response?.data || { message: "Falha ao excluir registro" }
    });
  }
});

// Saúde
app.get("/health", (_req, res) => {
  res.json({ ok: true, table: AIRTABLE_TABLE_NAME });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server rodando em http://localhost:${PORT}`);
});
