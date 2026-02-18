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
        $tpAmb = $ambiente === 'producao' ? 1 : 2;
        $config = [
            'atualizacao' => date('Y-m-d H:i:s'),
            'tpAmb' => $tpAmb,
            'razaosocial' => $empresaDados['razaoSocial'] ?? '',
            'siglaUF' => $empresaDados['siglaUF'] ?? 'SP',
            'cnpj' => preg_replace('/\D/', '', $empresaDados['cnpj'] ?? ''),
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
     * @param int $ultNSU Último NSU recebido (0 para primeira consulta)
     * @return array ['nfe' => [...], 'ultNSU' => int, 'maxNSU' => int]
     */
    public function buscar(int $ultNSU = 0): array
    {
        // Assinatura NFePHP: sefazDistDFe(int $ultNSU, int $numNSU, ?string $chave, string $fonte). CNPJ vem do config do Tools.
        $ultNSU = (int) $ultNSU;
        $response = $this->tools->sefazDistDFe($ultNSU, 0, null, 'AN');
        return $this->parseResponse($response);
    }

    private function parseResponse(string $xml): array
    {
        $result = ['nfe' => [], 'ultNSU' => 0, 'maxNSU' => 0];
        libxml_use_internal_errors(true);
        $dom = new \DOMDocument();
        if (!@$dom->loadXML($xml)) {
            throw new \Exception('Resposta inválida da SEFAZ.');
        }
        $xpath = new \DOMXPath($dom);
        $xpath->registerNamespace('dfe', 'http://www.portalfiscal.inf.br/nfe');
        $ret = $xpath->query('//dfe:retDistDFeInt');
        if ($ret->length === 0) {
            $ret = $xpath->query('//retDistDFeInt');
        }
        if ($ret->length === 0) {
            $cStat = $xpath->query('//cStat')->item(0)?->nodeValue ?? '';
            $xMotivo = $xpath->query('//xMotivo')->item(0)?->nodeValue ?? 'Erro desconhecido';
            if ($cStat !== '138' && $cStat !== '137') {
                throw new \Exception("SEFAZ: $xMotivo (cStat: $cStat)");
            }
            return $result;
        }
        $retNode = $ret->item(0);
        $result['ultNSU'] = (int)($xpath->query('.//ultNSU', $retNode)->item(0)?->nodeValue ?? 0);
        $result['maxNSU'] = (int)($xpath->query('.//maxNSU', $retNode)->item(0)?->nodeValue ?? 0);

        $docZips = $xpath->query('.//docZip');
        foreach ($docZips as $docZip) {
            $schema = $docZip->getAttribute('schema') ?: '';
            $content = base64_decode($docZip->nodeValue ?? '');
            if ($content === false || $content === '') continue;
            $content = @gzuncompress($content);
            if ($content === false) continue;
            if (stripos($schema, 'resNFe') !== false || stripos($content, 'resNFe') !== false) {
                $item = $this->parseResNFe($content);
                if ($item) $result['nfe'][] = $item;
            }
        }
        return $result;
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
