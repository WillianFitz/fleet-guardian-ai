<?php

namespace App;

use Exception;

// Carregar autoloader se ainda não foi carregado
if (!class_exists('Composer\Autoload\ClassLoader')) {
    if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
        require_once __DIR__ . '/../vendor/autoload.php';
    }
}

use NFePHP\CTe\MakeCTe;
use NFePHP\CTe\Tools;
use NFePHP\Common\Certificate;
use NFePHP\CTe\Common\Standardize;

/**
 * Serviço para emissão e consulta de CT-e usando sped-cte
 */
class CTeService
{
    private $config;
    private $certificate;
    private $tools;
    private $ambiente;

    /**
     * @param string $certPfxPath Caminho do arquivo .pfx do certificado
     * @param string $certPassword Senha do certificado
     * @param array $empresaDados Dados da empresa: cnpj, razaoSocial, siglaUF
     * @param string $ambiente 'homologacao' ou 'producao'
     */
    public function __construct($certPfxPath, $certPassword, $empresaDados, $ambiente = 'homologacao')
    {
        $this->ambiente = $ambiente;
        $tpAmb = $ambiente === 'producao' ? 1 : 2;

        // Criar configuração dinâmica
        $this->config = [
            'atualizacao' => date('Y-m-d H:i:s'),
            'tpAmb' => $tpAmb,
            'razaosocial' => $empresaDados['razaoSocial'] ?? 'EMPRESA LTDA',
            'siglaUF' => $empresaDados['siglaUF'] ?? 'SP',
            'cnpj' => preg_replace('/\D/', '', $empresaDados['cnpj'] ?? ''),
            'schemes' => 'PL_CTe_400',
            'versao' => '4.00',
            'tokenIBPT' => '',
            'CSC' => '',
            'CSCid' => '',
            'aProxyConf' => [
                'proxyIp' => '',
                'proxyPort' => '',
                'proxyUser' => '',
                'proxyPass' => ''
            ]
        ];

        // Carregar certificado
        // ATENÇÃO: Certificate::readPfx espera o CONTEÚDO binário do PFX, não o caminho do arquivo
        // Por isso precisamos ler o arquivo e passar o conteúdo para a biblioteca.
        $pfxContent = @file_get_contents($certPfxPath);
        if ($pfxContent === false) {
            throw new Exception("Não foi possível ler o arquivo de certificado PFX temporário.");
        }
        $this->certificate = Certificate::readPfx($pfxContent, $certPassword);

        // Criar instância do Tools
        $this->tools = new Tools(json_encode($this->config), $this->certificate);
    }

    /**
     * Emite um CT-e na SEFAZ
     * 
     * @param array $dados Dados do CT-e:
     *   - numero: número do CT-e
     *   - serie: série
     *   - veiculoPlaca: placa do veículo
     *   - dataEmissao: data de emissão (Y-m-d)
     *   - valorPrestacao: valor da prestação
     *   - remetente: array com nome, cnpjCpf, municipio, uf
     *   - destinatario: array com nome, cnpjCpf, municipio, uf
     * 
     * @return array ['chave' => string, 'protocolo' => string, 'xml' => string]
     */
    public function emitir($dados)
    {
        try {
            error_log("CTeService::emitir - Iniciando emissão de CT-e");
            
            // Validar dados obrigatórios
            if (empty($dados['numero'])) {
                throw new Exception("Número do CT-e é obrigatório");
            }
            if (empty($dados['remetente']['nome'])) {
                throw new Exception("Nome do remetente é obrigatório");
            }
            if (empty($dados['destinatario']['nome'])) {
                throw new Exception("Nome do destinatário é obrigatório");
            }
            
            // Criar instância do MakeCTe com a configuração
            $make = new MakeCTe(json_encode($this->config));

            // Extrair dados
            $numero = str_pad((string)$dados['numero'], 9, '0', STR_PAD_LEFT);
            $serie = str_pad((string)($dados['serie'] ?? '1'), 3, '0', STR_PAD_LEFT);
            $cnpj = $this->config['cnpj'];
            $uf = $this->config['siglaUF'];
            $tpAmb = $this->config['tpAmb'];

            // Gerar chave do CT-e
            $ano = date('y');
            $mes = date('m');
            $modelo = '57';
            $chave = $this->gerarChave($cnpj, $numero, $serie, $tpAmb);

            // IDE - Identificação do CT-e
            $stdIde = new \stdClass();
            $stdIde->cUF = (string)$this->getCodigoUF($uf);
            // cCT deve ser o número do CT-e com 8 dígitos (zeros à esquerda)
            $stdIde->cCT = str_pad((string)$dados['numero'], 8, '0', STR_PAD_LEFT);
            $stdIde->CFOP = '5353'; // Prestação de serviço de transporte
            $stdIde->natOp = 'PRESTACAO DE SERVICO DE TRANSPORTE';
            $stdIde->mod = '57'; // Modelo do CT-e (obrigatório)
            $stdIde->serie = (string)($dados['serie'] ?? '1');
            // nCT deve ser o número do CT-e (sem zeros à esquerda para nCT)
            $stdIde->nCT = (string)$dados['numero'];
            // dhEmi deve estar no formato correto (ISO 8601 com timezone)
            $dhEmi = new \DateTime();
            $stdIde->dhEmi = $dhEmi->format('c'); // ISO 8601
            $stdIde->tpImp = '1'; // Retrato
            $stdIde->tpEmis = '1'; // Normal
            $stdIde->tpAmb = (string)$tpAmb;
            $stdIde->tpCTe = '0'; // Normal
            $stdIde->procEmi = '0'; // Emissão própria
            $stdIde->verProc = 'FleetGuardianAI';
            
            // Campos de município e UF (obrigatórios)
            $remetenteMunicipio = $dados['remetente']['municipio'] ?? '';
            $remetenteUF = strtoupper($dados['remetente']['uf'] ?? $uf);
            $destinatarioMunicipio = $dados['destinatario']['municipio'] ?? '';
            $destinatarioUF = strtoupper($dados['destinatario']['uf'] ?? '');
            
            // Garantir que os códigos de município não sejam vazios
            $cMunEnv = $this->getCodigoMunicipio($remetenteMunicipio, $remetenteUF);
            $cMunIni = $this->getCodigoMunicipio($remetenteMunicipio, $remetenteUF);
            $cMunFim = $this->getCodigoMunicipio($destinatarioMunicipio, $destinatarioUF);
            
            $stdIde->cMunEnv = (string)$cMunEnv;
            $stdIde->xMunEnv = !empty($remetenteMunicipio) ? $remetenteMunicipio : 'NÃO INFORMADO';
            $stdIde->UFEnv = !empty($remetenteUF) ? $remetenteUF : $uf;
            $stdIde->cMunIni = (string)$cMunIni;
            $stdIde->xMunIni = !empty($remetenteMunicipio) ? $remetenteMunicipio : 'NÃO INFORMADO';
            $stdIde->UFIni = !empty($remetenteUF) ? $remetenteUF : $uf;
            $stdIde->cMunFim = (string)$cMunFim;
            $stdIde->xMunFim = !empty($destinatarioMunicipio) ? $destinatarioMunicipio : 'NÃO INFORMADO';
            // UFFim não pode ser vazio - usar UF do remetente como fallback
            $stdIde->UFFim = !empty($destinatarioUF) ? $destinatarioUF : $uf;
            
            // Validar campos obrigatórios antes de criar a tag
            $camposObrigatorios = ['cUF', 'cCT', 'CFOP', 'natOp', 'mod', 'serie', 'nCT', 'dhEmi', 'tpImp', 'tpEmis', 'tpAmb', 'tpCTe', 'procEmi', 'verProc'];
            foreach ($camposObrigatorios as $campo) {
                if (!isset($stdIde->$campo) || $stdIde->$campo === '' || $stdIde->$campo === null) {
                    throw new Exception("Campo obrigatório '$campo' está faltando ou vazio na tag ide");
                }
            }
            
            // Log dos dados antes de criar a tag ide
            error_log("CTeService::emitir - Dados IDE: " . json_encode($stdIde, JSON_UNESCAPED_UNICODE));
            
            // Chamar tagide e verificar resultado
            try {
                $resultadoTagide = $make->tagide($stdIde);
                // tagide pode retornar void ou true, verificar se houve erro
                error_log("CTeService::emitir - tagide() executado, retorno: " . (is_null($resultadoTagide) ? 'null' : ($resultadoTagide === true ? 'true' : gettype($resultadoTagide))));
            } catch (\Throwable $e) {
                error_log("CTeService::emitir - Erro ao criar tag ide: " . $e->getMessage());
                error_log("CTeService::emitir - Trace tagide: " . $e->getTraceAsString());
                throw new Exception("Erro ao criar tag ide: " . $e->getMessage());
            }

            // EMIT - Emitente (sua empresa)
            $stdEmit = new \stdClass();
            $stdEmit->CNPJ = $cnpj;
            $stdEmit->IE = '';
            $stdEmit->xNome = $this->config['razaosocial'];
            $stdEmit->xFant = '';
            $stdEmit->enderEmit = new \stdClass();
            $stdEmit->enderEmit->xLgr = 'RUA EXEMPLO';
            $stdEmit->enderEmit->nro = '123';
            $stdEmit->enderEmit->xBairro = 'CENTRO';
            $stdEmit->enderEmit->cMun = $this->getCodigoMunicipio('São Paulo', 'SP');
            $stdEmit->enderEmit->xMun = 'SAO PAULO';
            $stdEmit->enderEmit->UF = 'SP';
            $stdEmit->enderEmit->CEP = '01000000';
            $make->tagemit($stdEmit);

            // REM - Remetente
            $cnpjCpfRem = preg_replace('/\D/', '', $dados['remetente']['cnpjCpf'] ?? '');
            $stdRem = new \stdClass();
            $stdRem->CNPJ = strlen($cnpjCpfRem) === 14 ? $cnpjCpfRem : null;
            $stdRem->CPF = strlen($cnpjCpfRem) === 11 ? $cnpjCpfRem : null;
            $stdRem->IE = '';
            $stdRem->xNome = $dados['remetente']['nome'] ?? '';
            $stdRem->xFant = '';
            $stdRem->fone = '';
            $stdRem->email = '';
            $stdRem->enderReme = new \stdClass();
            $stdRem->enderReme->xLgr = '';
            $stdRem->enderReme->nro = '';
            $stdRem->enderReme->xBairro = '';
            $stdRem->enderReme->cMun = $this->getCodigoMunicipio($dados['remetente']['municipio'] ?? '', $dados['remetente']['uf'] ?? '');
            $stdRem->enderReme->xMun = $dados['remetente']['municipio'] ?? '';
            $stdRem->enderReme->UF = $dados['remetente']['uf'] ?? '';
            $stdRem->enderReme->CEP = '';
            $make->tagrem($stdRem);

            // DEST - Destinatário
            $cnpjCpfDest = preg_replace('/\D/', '', $dados['destinatario']['cnpjCpf'] ?? '');
            $stdDest = new \stdClass();
            $stdDest->CNPJ = strlen($cnpjCpfDest) === 14 ? $cnpjCpfDest : null;
            $stdDest->CPF = strlen($cnpjCpfDest) === 11 ? $cnpjCpfDest : null;
            $stdDest->IE = '';
            $stdDest->xNome = $dados['destinatario']['nome'] ?? '';
            $stdDest->xFant = '';
            $stdDest->fone = '';
            $stdDest->email = '';
            $stdDest->enderDest = new \stdClass();
            $stdDest->enderDest->xLgr = '';
            $stdDest->enderDest->nro = '';
            $stdDest->enderDest->xBairro = '';
            $stdDest->enderDest->cMun = $this->getCodigoMunicipio($dados['destinatario']['municipio'] ?? '', $dados['destinatario']['uf'] ?? '');
            $stdDest->enderDest->xMun = $dados['destinatario']['municipio'] ?? '';
            $stdDest->enderDest->UF = $dados['destinatario']['uf'] ?? '';
            $stdDest->enderDest->CEP = '';
            $make->tagdest($stdDest);

            // vPrest - Valores da Prestação
            $valorPrestacao = floatval($dados['valorPrestacao'] ?? 0);
            $stdVPrest = new \stdClass();
            $stdVPrest->vTPrest = $valorPrestacao;
            $stdVPrest->vRec = $valorPrestacao;
            $stdVPrest->Comp = [];
            $make->tagvPrest($stdVPrest);

            // rodo - Modal Rodoviário (obrigatório para CT-e rodoviário)
            $stdRodo = new \stdClass();
            $stdRodo->RNTRC = ''; // Registro Nacional de Transportadores Rodoviários de Carga (opcional)
            $make->tagrodo($stdRodo);

            // Montar XML
            try {
                $make->monta();
                error_log("CTeService::emitir - monta() executado com sucesso");
            } catch (\Exception $e) {
                error_log("CTeService::emitir - Erro ao montar XML: " . $e->getMessage());
                error_log("CTeService::emitir - Trace: " . $e->getTraceAsString());
                throw new Exception("Erro ao montar XML do CT-e: " . $e->getMessage());
            }

            // Obter XML
            $xml = $make->getXML();

            // Enviar para SEFAZ
            $response = $this->tools->sefazEnvia($xml, $tpAmb);

            // Padronizar resposta
            $std = new Standardize($response);
            $stdArr = $std->toArray();

            // Extrair chave e protocolo
            $chaveRetorno = $chave; // Usar a chave gerada
            $protocolo = $stdArr['protCTe']['infProt']['nProt'] ?? '';

            // Verificar se foi autorizado
            $cStat = $stdArr['protCTe']['infProt']['cStat'] ?? '';
            if ($cStat !== '100') {
                $xMotivo = $stdArr['protCTe']['infProt']['xMotivo'] ?? 'Erro desconhecido';
                throw new Exception("CT-e rejeitado: $xMotivo (Status: $cStat)");
            }

            return [
                'chave' => $chaveRetorno,
                'protocolo' => $protocolo,
                'xml' => $response,
                'ambiente' => $this->ambiente
            ];

        } catch (Exception $e) {
            throw new Exception("Erro ao emitir CT-e: " . $e->getMessage());
        }
    }

    /**
     * Consulta status de um CT-e na SEFAZ
     * 
     * @param string $chave Chave do CT-e (44 dígitos)
     * @return array ['status' => string, 'protocolo' => string, 'xml' => string]
     */
    public function consultar($chave)
    {
        try {
            $tpAmb = $this->config['tpAmb'];

            // Consultar na SEFAZ
            $response = $this->tools->sefazConsulta($chave, $tpAmb);

            // Padronizar resposta
            $std = new Standardize($response);
            $stdArr = $std->toArray();

            // Extrair status e protocolo
            $cStat = $stdArr['protCTe']['infProt']['cStat'] ?? '';
            $protocolo = $stdArr['protCTe']['infProt']['nProt'] ?? '';

            return [
                'status' => $cStat,
                'protocolo' => $protocolo,
                'xml' => $response,
                'ambiente' => $this->ambiente
            ];

        } catch (Exception $e) {
            throw new Exception("Erro ao consultar CT-e: " . $e->getMessage());
        }
    }

    /**
     * Gera chave do CT-e (44 dígitos)
     */
    private function gerarChave($cnpj, $numero, $serie, $tpAmb)
    {
        $cnpjLimpo = preg_replace('/\D/', '', $cnpj);
        $uf = $this->getCodigoUF($this->config['siglaUF']);
        $ano = date('y');
        $mes = date('m');
        $modelo = '57';
        $seriePadded = str_pad($serie, 3, '0', STR_PAD_LEFT);
        $numeroPadded = str_pad($numero, 9, '0', STR_PAD_LEFT);
        
        $chave = $uf . $ano . $mes . $cnpjLimpo . $modelo . $seriePadded . $numeroPadded . $tpAmb;
        
        // Calcular dígito verificador
        $soma = 0;
        $peso = 2;
        for ($i = strlen($chave) - 1; $i >= 0; $i--) {
            $soma += intval($chave[$i]) * $peso;
            $peso = $peso === 9 ? 2 : $peso + 1;
        }
        $dv = (($soma * 10) % 11) % 10;
        
        return $chave . $dv;
    }

    /**
     * Retorna código da UF
     */
    private function getCodigoUF($uf)
    {
        $ufs = [
            'AC' => '12', 'AL' => '27', 'AP' => '16', 'AM' => '13', 'BA' => '29',
            'CE' => '23', 'DF' => '53', 'ES' => '32', 'GO' => '52', 'MA' => '21',
            'MT' => '51', 'MS' => '50', 'MG' => '31', 'PA' => '15', 'PB' => '25',
            'PR' => '41', 'PE' => '26', 'PI' => '22', 'RJ' => '33', 'RN' => '24',
            'RS' => '43', 'RO' => '11', 'RR' => '14', 'SC' => '42', 'SP' => '35',
            'SE' => '28', 'TO' => '17'
        ];
        return $ufs[strtoupper($uf)] ?? '35';
    }

    /**
     * Retorna código do município (IBGE)
     * NOTA: Esta é uma função simplificada. Em produção, você deve usar uma tabela completa de municípios IBGE.
     */
    private function getCodigoMunicipio($municipio, $uf)
    {
        // Códigos comuns (você deve expandir isso com tabela IBGE completa)
        $codigos = [
            'SP' => ['SAO PAULO' => '3550308', 'CAMPINAS' => '3509502'],
            'RJ' => ['RIO DE JANEIRO' => '3304557'],
            'MG' => ['BELO HORIZONTE' => '3106200'],
            // Adicione mais conforme necessário
        ];
        
        $municipioUpper = strtoupper($municipio);
        if (isset($codigos[$uf][$municipioUpper])) {
            return $codigos[$uf][$municipioUpper];
        }
        
        // Fallback: retorna código genérico de São Paulo
        return '3550308';
    }
}
