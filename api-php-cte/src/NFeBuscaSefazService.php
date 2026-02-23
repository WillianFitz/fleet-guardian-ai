<?php
/**
 * Serviço para buscar NF-e na SEFAZ via Distribuição DFe
 * Retorna NF-e disponíveis para o CNPJ da empresa (transportador, destinatário, etc.)
 */

namespace App;

use NFePHP\NFe\Tools;
use NFePHP\Common\Certificate;

class NFeBuscaSefazService
{
    private $tools;
    private $cnpj;

    public function __construct(string $certPfxPath, string $certPassword, array $empresaDados, string $ambiente = 'homologacao')
    {
        // Normalizar tipos para evitar problemas de validação na biblioteca nfephp
        $tpAmb = $ambiente === 'producao' ? 1 : 2;
        $razaoSocial = isset($empresaDados['razaoSocial']) ? (string)$empresaDados['razaoSocial'] : '';
        $siglaUF = isset($empresaDados['siglaUF']) ? strtoupper((string)$empresaDados['siglaUF']) : 'SP';
        if ($siglaUF === '' || strlen($siglaUF) > 2) $siglaUF = 'SP';
        $cnpj = isset($empresaDados['cnpj']) ? preg_replace('/\D/', '', (string)$empresaDados['cnpj']) : '';

        $config = [
            'atualizacao' => date('Y-m-d H:i:s'),
            'tpAmb' => (int)$tpAmb,
            'razaosocial' => $razaoSocial,
            'siglaUF' => $siglaUF,
            'cnpj' => $cnpj,
            'schemes' => 'PL_009_V4',
            'versao' => '4.00',
        ];
        $pfxContent = @file_get_contents($certPfxPath);
        if ($pfxContent === false) {
            throw new \Exception('Não foi possível ler o certificado.');
        }
        $certificate = Certificate::readPfx($pfxContent, $certPassword);
        $this->cnpj = $config['cnpj'];
        $this->tools = new Tools(json_encode($config), $certificate);
        $this->tools->model('55');
    }

    /**
     * Busca NF-e na SEFAZ (Distribuição DFe)
     * Faz várias chamadas (enquanto ultNSU < maxNSU) para trazer todas as NF-e disponíveis.
     * @param int $ultNSU Último NSU recebido (0 para primeira consulta)
     * @return array ['nfe' => [...], 'ultNSU' => int, 'maxNSU' => int, 'cStat' => string, 'xMotivo' => string]
     */
    /**
     * @param int $ultNSU Último NSU recebido (0 para primeira consulta)
     * @param int $maxIter Máximo de iterações/páginas a buscar nesta chamada (1 = somente 1 página)
     * @return array ['nfe' => [...], 'ultNSU' => int, 'maxNSU' => int, 'cStat' => string, 'xMotivo' => string]
     */
    public function buscar(int $ultNSU = 0, int $maxIter = 1): array
    {
        $ultNSU = (int) $ultNSU;
        $allNfe = [];
        $maxNSU = 0;
        $cStat = '';
        $xMotivo = '';
        // Segurança: limitar máximo absoluto para evitar varreduras massivas
        $absoluteMax = 50;
        $maxIter = max(1, min((int)$maxIter, $absoluteMax));
        $iter = 0;

        do {
            $response = $this->tools->sefazDistDFe($ultNSU, 0, null, 'AN');
            $parsed = $this->parseResponse($response);
            $cStat = $parsed['cStat'] ?? '';
            $xMotivo = $parsed['xMotivo'] ?? '';
            // Se SEFAZ retornou consumo indevido (cStat 656), abortamos e devolvemos a informação
            if ($cStat === '656') {
                return [
                    'nfe' => $allNfe,
                    'ultNSU' => $ultNSU,
                    'maxNSU' => $maxNSU,
                    'cStat' => $cStat,
                    'xMotivo' => $xMotivo,
                ];
            }
            if (!empty($parsed['nfe'])) {
                $allNfe = array_merge($allNfe, $parsed['nfe']);
            }
            $ultNSU = (int) $parsed['ultNSU'];
            $maxNSU = (int) $parsed['maxNSU'];
            if ($ultNSU >= $maxNSU || $cStat === '137') {
                break;
            }
            // Evitar ráfagas muito rápidas contra a SEFAZ
            // Pequena pausa entre páginas (200ms) — ajustável conforme necessidade
            usleep(200000);
            $iter++;
        } while ($iter < $maxIter);

        return [
            'nfe' => $allNfe,
            'ultNSU' => $ultNSU,
            'maxNSU' => $maxNSU,
            'cStat' => $cStat,
            'xMotivo' => $xMotivo,
        ];
    }

    /**
     * Consulta diretamente a SEFAZ pela chave da NF-e (consulta por chave).
     * Tenta múltiplos nomes de método que podem existir na versão da biblioteca.
     * Retorna array com 'raw' => resposta bruta (XML/soap) e, se possível, 'parsed' => resultado do parseResNFe().
     *
     * @param string $chave
     * @return array
     */
    public function consultarPorChave(string $chave): array
    {
        $response = null;
        $possible = ['sefazConsulta', 'sefazConsultaNFe', 'sefazConsNFe', 'sefazConsultaChave', 'sefazConsultaNfe'];
        foreach ($possible as $m) {
            if (method_exists($this->tools, $m)) {
                try {
                    $response = $this->tools->{$m}($chave);
                    break;
                } catch (\Throwable $e) {
                    // tentar próximo método
                }
            }
        }

        if ($response === null) {
            throw new \Exception("Consulta por chave não suportada pela biblioteca nfephp utilizada.");
        }

        // Tentar extrair/parsear uma NF-e dentro da resposta (pode vir como envelope SOAP ou docZip)
        $parsed = null;
        try {
            // Se a resposta contém docZip base64, tentamos usar parseResponse para extrair resNFe
            $tmp = $this->parseResponse((string)$response);
            if (!empty($tmp['nfe'])) {
                // selecionar possível item com chave
                foreach ($tmp['nfe'] as $item) {
                    if (!empty($item['chave']) && $item['chave'] === $chave) {
                        $parsed = $item;
                        break;
                    }
                }
                if ($parsed === null) {
                    $parsed = $tmp['nfe'][0];
                }
            } else {
                // fallback: tentar parseResNFe diretamente se a resposta contiver um XML resNFe/infNFe
                $maybe = $this->parseResNFe((string)$response);
                if ($maybe) $parsed = $maybe;
            }
        } catch (\Throwable $e) {
            // ignora parse errors
        }

        // Se não encontramos nada ainda, tentar uma varredura mais completa na Distribuição DFe (maior alcance)
        if ($parsed === null) {
            try {
                // tentar buscar usando buscarPorChave com maior número de iterações/páginas
                $found = $this->buscarPorChave($chave, 200);
                if ($found) {
                    $parsed = $found;
                }
            } catch (\Throwable $e) {
                // ignora erros de segunda tentativa
            }
        }

        return ['raw' => (string)$response, 'parsed' => $parsed];
    }

    /**
     * Busca uma NF-e específica pela chave (chNFe) na Distribuição DFe.
     * Retorna o item (mesma estrutura de parseResNFe) ou null se não encontrada.
     * @param string $chaveNF
     * @param int $maxIter
     * @return array|null
     */
    public function buscarPorChave(string $chaveNF, int $maxIter = 50): ?array
    {
        $ultNSU = 0;
        $absoluteMax = 200;
        $maxIter = max(1, min((int)$maxIter, $absoluteMax));
        $iter = 0;

        do {
            $response = $this->tools->sefazDistDFe($ultNSU, 0, null, 'AN');
            $parsed = $this->parseResponse($response);
            // Checar itens retornados
            foreach ($parsed['nfe'] ?? [] as $item) {
                if (!empty($item['chave']) && $item['chave'] === $chaveNF) {
                    return $item;
                }
            }
            $ultNSU = (int)($parsed['ultNSU'] ?? $ultNSU);
            if (!empty($parsed['maxNSU'])) {
                $maxNSU = (int)$parsed['maxNSU'];
                if ($ultNSU >= $maxNSU) break;
            }
            usleep(200000);
            $iter++;
        } while ($iter < $maxIter);

        return null;
    }

    private function parseResponse(string $xml): array
    {
        $result = ['nfe' => [], 'ultNSU' => 0, 'maxNSU' => 0, 'cStat' => '', 'xMotivo' => ''];
        libxml_use_internal_errors(true);
        $dom = new \DOMDocument();
        if (!@$dom->loadXML($xml)) {
            throw new \Exception('Resposta inválida da SEFAZ.');
        }
        $xpath = new \DOMXPath($dom);
        $xpath->registerNamespace('dfe', 'http://www.portalfiscal.inf.br/nfe');
        $xpath->registerNamespace('soap', 'http://www.w3.org/2003/05/soap-envelope');
        $xpath->registerNamespace('ns', 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe');

        $cStat = $this->firstNodeValue($xpath, ['//cStat', '//dfe:cStat', '//*[local-name()="cStat"]']);
        $xMotivo = $this->firstNodeValue($xpath, ['//xMotivo', '//dfe:xMotivo', '//*[local-name()="xMotivo"]']) ?: 'Erro desconhecido';
        $result['cStat'] = $cStat;
        $result['xMotivo'] = $xMotivo;

        // cStat 656 => consumo indevido / bloqueio temporário para o CNPJ.
        // Não lançamos exceção aqui para permitir que o caller trate o bloqueio e persista estado.
        if ($cStat === '656') {
            return $result;
        }

        if ($cStat !== '138' && $cStat !== '137') {
            throw new \Exception("SEFAZ: $xMotivo (cStat: $cStat)");
        }

        $ret = $xpath->query('//dfe:retDistDFeInt');
        if ($ret->length === 0) {
            $ret = $xpath->query('//retDistDFeInt');
        }
        if ($ret->length === 0) {
            $ret = $xpath->query('//*[local-name()="retDistDFeInt"]');
        }
        if ($ret->length === 0) {
            $result['ultNSU'] = (int) $this->firstNodeValue($xpath, ['//ultNSU', '//*[local-name()="ultNSU"]']);
            $result['maxNSU'] = (int) $this->firstNodeValue($xpath, ['//maxNSU', '//*[local-name()="maxNSU"]']);
            return $result;
        }

        $retNode = $ret->item(0);
        $result['ultNSU'] = (int) $this->firstNodeValue($xpath, ['.//ultNSU', './/dfe:ultNSU', './/*[local-name()="ultNSU"]'], $retNode);
        $result['maxNSU'] = (int) $this->firstNodeValue($xpath, ['.//maxNSU', './/dfe:maxNSU', './/*[local-name()="maxNSU"]'], $retNode);

        $docZips = $xpath->query('.//dfe:docZip');
        if ($docZips->length === 0) {
            $docZips = $xpath->query('.//docZip');
        }
        if ($docZips->length === 0) {
            $docZips = $xpath->query('.//*[local-name()="docZip"]');
        }

        foreach ($docZips as $docZip) {
            $schema = $docZip->getAttribute('schema') ?: '';
            $schema = $docZip->getAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'schemaLocation') ?: $schema;
            $content = base64_decode(trim($docZip->nodeValue ?? $docZip->textContent ?? ''));
            if ($content === false || $content === '') {
                continue;
            }
            $decoded = @gzuncompress($content);
            if ($decoded !== false) {
                $content = $decoded;
            }
            $isResNFe = stripos($schema, 'resNFe') !== false || stripos($content, 'resNFe') !== false || preg_match('/<resNFe\b/i', $content);
            if ($isResNFe) {
                $item = $this->parseResNFe($content);
                if ($item) {
                    // incluir o XML completo (decodificado / descomprimido) no resultado
                    $item['xml'] = $content;
                    $result['nfe'][] = $item;
                }
            }
        }
        return $result;
    }

    /** @param \DOMXPath $xpath
     * @param string[] $queries
     * @param \DOMNode|null $context
     * @return string
     */
    private function firstNodeValue(\DOMXPath $xpath, array $queries, $context = null): string
    {
        foreach ($queries as $q) {
            $nodes = $context ? $xpath->query($q, $context) : $xpath->query($q);
            if ($nodes && $nodes->length > 0 && $nodes->item(0)->nodeValue !== null) {
                return trim($nodes->item(0)->nodeValue);
            }
        }
        return '';
    }

    private function parseResNFe(string $xml): ?array
    {
        $dom = new \DOMDocument();
        if (!@$dom->loadXML($xml)) return null;
        $xpath = new \DOMXPath($dom);
        $xpath->registerNamespace('nfe', 'http://www.portalfiscal.inf.br/nfe');
        $chNFe = $xpath->query('//nfe:chNFe')->item(0)?->nodeValue ?? $xpath->query('//chNFe')->item(0)?->nodeValue ?? '';
        if (!$chNFe) return null;
        $xNomeEmit = $xpath->query('//nfe:resNFe/nfe:emit/nfe:xNome')->item(0)?->nodeValue
            ?? $xpath->query('//resNFe/emit/xNome')->item(0)?->nodeValue
            ?? $xpath->query('//nfe:xNome')->item(0)?->nodeValue ?? '';
        $xNomeDest = $xpath->query('//nfe:resNFe/nfe:dest/nfe:xNome')->item(0)?->nodeValue
            ?? $xpath->query('//resNFe/dest/xNome')->item(0)?->nodeValue
            ?? $xpath->query('//nfe:xNome')->item(1)?->nodeValue ?? '';
        $dhEmi = $xpath->query('//nfe:dhEmi')->item(0)?->nodeValue ?? $xpath->query('//dhEmi')->item(0)?->nodeValue ?? '';
        $vNF = (float)($xpath->query('//nfe:vNF')->item(0)?->nodeValue ?? $xpath->query('//vNF')->item(0)?->nodeValue ?? 0);
        $nfe = substr($chNFe, 25, 9);
        return [
            'chave' => $chNFe,
            'nfe' => $nfe,
            'dhEmi' => $dhEmi,
            'xNomeEmit' => $xNomeEmit,
            'xNomeDest' => $xNomeDest,
            'vNF' => $vNF,
        ];
    }
}
