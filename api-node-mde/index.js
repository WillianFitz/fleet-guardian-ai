const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { DistribuicaoDFe } = require("node-mde");

const UF_TO_CUF = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28",
  BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41", SC: "42", RS: "43",
  MS: "50", MT: "51", GO: "52", DF: "53"
};

function mapUfToCuf(sigla) {
  if (!sigla) return "35";
  const s = String(sigla).toUpperCase();
  return UF_TO_CUF[s] || "35";
}

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "20mb" }));

app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.post("/nfe/consultar", async (req, res) => {
  try {
    const body = req.body || {};
    const chave = body.chave;
    if (!chave) return res.status(400).json({ error: "chave é obrigatória" });

    const ambiente = (body.ambiente || "homologacao").toLowerCase();
    const tpAmb = ambiente === "producao" ? "1" : "2";

    // Simple token validation (optional): if NODE_AUTH_TOKEN is set, require Authorization header
    const expectedToken = process.env.NODE_AUTH_TOKEN;
    if (expectedToken) {
      const auth = (req.headers.authorization || "");
      if (!auth.startsWith("Bearer ") || auth.slice(7) !== expectedToken) {
        return res.status(401).json({ error: "unauthorized" });
      }
    }

    const empresa = body.empresa || {};
    const siglaUF = (empresa.siglaUF || empresa.uf || "SP").toUpperCase();
    const cUFAutor = body.cUFAutor || mapUfToCuf(siglaUF);

    const certificado = body.certificado || {};
    let pfxBuffer = null;
    if (certificado.pfxBase64) {
      pfxBuffer = Buffer.from(certificado.pfxBase64, "base64");
    } else {
      return res.status(400).json({ error: "certificado.pfxBase64 é obrigatório" });
    }
    const passphrase = certificado.password || certificado.passphrase || "";

    const distribuicao = new DistribuicaoDFe({
      pfx: pfxBuffer,
      passphrase,
      cUFAutor,
      cnpj: String(empresa.cnpj || ""),
      tpAmb
    });

    // tentar consulta por chNFe
    const result = await distribuicao.consultaChNFe(chave);
    // result structure: { data: { ... }, reqXml, resXml, status }
    if (!result || !result.data) {
      return res.status(502).json({ error: "Resposta inválida da Distribuição DFe", raw: result });
    }

    // If docZip exists, try to return nfeProc or resNFe entries
    const docZip = result.data.docZip || [];
    const parsedItems = [];
    for (const d of docZip) {
      // d.xml may contain nfeProc or resNFe
      parsedItems.push({
        nsu: d.nsu || null,
        schema: d.schema || null,
        xml: d.xml || null,
        json: d.json || null
      });
    }

    return res.json({
      status: result.status || 200,
      data: result.data,
      docZip: parsedItems,
      reqXml: result.reqXml,
      resXml: result.resXml
    });
  } catch (err) {
    console.error("nfe/consultar error:", err);
    return res.status(500).json({ error: String(err.message || err), stack: err.stack ? String(err.stack) : undefined });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`node-mde service listening on ${PORT}`));

