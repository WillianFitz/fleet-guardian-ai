<?php
// FleetGuardianAI CT-e API

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
            
            // Criar instância do MakeCTe
            // ATENÇÃO: MakeCTe recebe o SCHEMA (ex: PL_CTe_400), NÃO o JSON de config do Tools.
            $schema = $this->config['schemes'] ?? 'PL_CTe_400';
            $make = new MakeCTe($schema);

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
            $cDV = substr($chave, -1);

            // OBRIGATÓRIO: Criar o elemento raiz infCte ANTES de qualquer outra tag.
            // Sem isso, monta() falha com appChild(): Argument #1 ($parent) must be of type DOMElement, string given.
            $stdInfCte = new \stdClass();
            $stdInfCte->Id = $chave;
            $stdInfCte->versao = '4.00';
            $make->taginfCTe($stdInfCte);

            // IDE - Identificação do CT-e
            // SOLUÇÃO: Criar objeto limpo apenas com campos obrigatórios e válidos
            $stdIde = new \stdClass();
            
            // Campos básicos obrigatórios
            $stdIde->cUF = (string)$this->getCodigoUF($uf);
            $stdIde->cCT = str_pad((string)$dados['numero'], 8, '0', STR_PAD_LEFT);
            $stdIde->CFOP = '5353';
            $stdIde->natOp = 'PRESTACAO DE SERVICO DE TRANSPORTE';
            $stdIde->serie = (string)($dados['serie'] ?? '1');
            $stdIde->nCT = (string)$dados['numero'];
            
            // Data e hora de emissão
            $dhEmi = new \DateTime();
            $stdIde->dhEmi = $dhEmi->format('c');
            
            // Configurações
            $stdIde->tpImp = '1';
            $stdIde->tpEmis = '1';
            $stdIde->cDV = (string)$cDV;
            $stdIde->tpAmb = (string)$tpAmb;
            $stdIde->tpCTe = '0';
            $stdIde->procEmi = '0';
            $stdIde->verProc = 'FleetGuardianAI';
            // Campos obrigatórios do layout 4.00
            $stdIde->modal = '01';   // 01 = Rodoviário
            // tpServ: 0=Normal, 1=Subcontratação, 2=Redespacho, 3=Redespacho Intermediário (fluxo cte_outro)
            $fluxoOrigem = $dados['fluxoOrigem'] ?? 'manual';
            $stdIde->tpServ = ($fluxoOrigem === 'cte_outro' && !empty($dados['tpServ'])) ? (string)$dados['tpServ'] : '0';
            
            // Municípios e UFs - garantir valores válidos (nunca null)
            // Função auxiliar para garantir string não-nula
            $ensureString = function($value, $default = '') {
                return $value !== null ? (string)$value : (string)$default;
            };
            
            $remetenteMunicipio = $ensureString($dados['remetente']['municipio'] ?? null, 'SAO PAULO');
            $remetenteMunicipio = trim($remetenteMunicipio) ?: 'SAO PAULO';
            $remetenteUF = strtoupper(trim($ensureString($dados['remetente']['uf'] ?? null, $uf))) ?: $uf;
            
            $destinatarioMunicipio = $ensureString($dados['destinatario']['municipio'] ?? null, 'SAO PAULO');
            $destinatarioMunicipio = trim($destinatarioMunicipio) ?: 'SAO PAULO';
            $destinatarioUF = strtoupper(trim($ensureString($dados['destinatario']['uf'] ?? null, $uf))) ?: $uf;
            
            // Se UF vazia, usar UF padrão
            if (empty($remetenteUF)) $remetenteUF = $uf;
            if (empty($destinatarioUF)) $destinatarioUF = $uf;
            
            // Códigos de município - garantir que sempre retornem string válida
            $cMunEnv = (string)$this->getCodigoMunicipio($remetenteMunicipio, $remetenteUF);
            $cMunIni = (string)$this->getCodigoMunicipio($remetenteMunicipio, $remetenteUF);
            $cMunFim = (string)$this->getCodigoMunicipio($destinatarioMunicipio, $destinatarioUF);
            
            // Garantir que todos os campos sejam strings válidas (nunca null)
            $stdIde->cMunEnv = (string)$cMunEnv;
            $stdIde->xMunEnv = (string)$remetenteMunicipio;
            $stdIde->UFEnv = (string)$remetenteUF;
            $stdIde->cMunIni = (string)$cMunIni;
            $stdIde->xMunIni = (string)$remetenteMunicipio;
            $stdIde->UFIni = (string)$remetenteUF;
            $stdIde->cMunFim = (string)$cMunFim;
            $stdIde->xMunFim = (string)$destinatarioMunicipio;
            $stdIde->UFFim = (string)$destinatarioUF;
            // Demais obrigatórios da ide
            $stdIde->retira = '0';
            $stdIde->indIEToma = '9';
            // Campos opcionais do tagide - evitar trim(null) e elementos vazios que causam insertBefore com string
            $stdIde->indGlobalizado = $stdIde->indGlobalizado ?? '0';
            $stdIde->xDetRetira = $stdIde->xDetRetira ?? '';
            $stdIde->xJust = $stdIde->xJust ?? '';
            // NÃO passar dhCont - quando adicionado ao ide, força insertBefore que falha com string vazia
            
            // Validar campos obrigatórios antes de criar a tag
            // (baseado nos campos obrigatórios usados por MakeCTe::tagide)
            $camposObrigatorios = [
                'cUF',
                'cCT',
                'CFOP',
                'natOp',
                'serie',
                'nCT',
                'dhEmi',
                'tpImp',
                'tpEmis',
                'cDV',
                'tpAmb',
                'tpCTe',
                'procEmi',
                'verProc',
                'cMunEnv',
                'xMunEnv',
                'UFEnv',
                'modal',
                'tpServ',
                'cMunIni',
                'xMunIni',
                'UFIni',
                'cMunFim',
                'xMunFim',
                'UFFim',
                'retira',
                'indIEToma'
            ];
            
            // Validar e garantir que todos os campos sejam strings válidas (nunca null)
            foreach ($camposObrigatorios as $campo) {
                if (!isset($stdIde->$campo) || $stdIde->$campo === '' || $stdIde->$campo === null) {
                    throw new Exception("Campo obrigatório '$campo' está faltando ou vazio na tag ide");
                }
                // Garantir que seja string (nunca null)
                $stdIde->$campo = (string)$stdIde->$campo;
            }
            
            // Log dos dados antes de criar a tag ide
            error_log("CTeService::emitir - Dados IDE: " . json_encode($stdIde, JSON_UNESCAPED_UNICODE));

            // Criar tag ide - garantir que não há problemas de inicialização
            try {
                $make->tagide($stdIde);
                error_log("CTeService::emitir - tagide() executado com sucesso");
            } catch (\Throwable $e) {
                error_log("CTeService::emitir - Erro ao chamar tagide(): " . $e->getMessage());
                error_log("CTeService::emitir - Trace: " . $e->getTraceAsString());
                throw new Exception("Erro ao criar tag ide: " . $e->getMessage());
            }

            // Tomador do serviço será criado logo antes de monta() para garantir que não seja resetado

            // EMIT - Emitente (sua empresa)
            $stdEmit = new \stdClass();
            $stdEmit->CNPJ = (string)$cnpj;
            // Não incluir IE se vazio - pode causar problemas
            if (!empty($this->config['ie'] ?? '')) {
                $stdEmit->IE = (string)$this->config['ie'];
            }
            $stdEmit->xNome = (string)$this->config['razaosocial'];
            // Não incluir xFant se vazio
            if (!empty($this->config['nomeFantasia'] ?? '')) {
                $stdEmit->xFant = (string)$this->config['nomeFantasia'];
            }
            $stdEmit->enderEmit = new \stdClass();
            $stdEmit->enderEmit->xLgr = 'RUA EXEMPLO';
            $stdEmit->enderEmit->nro = '123';
            $stdEmit->enderEmit->xBairro = 'CENTRO';
            $stdEmit->enderEmit->cMun = (string)$this->getCodigoMunicipio('São Paulo', 'SP');
            $stdEmit->enderEmit->xMun = 'SAO PAULO';
            $stdEmit->enderEmit->UF = 'SP';
            $stdEmit->enderEmit->CEP = '01000000';
            $make->tagemit($stdEmit);

            // REM - Remetente
            $cnpjCpfRem = preg_replace('/\D/', '', $ensureString($dados['remetente']['cnpjCpf'] ?? null, ''));
            $stdRem = new \stdClass();
            if (strlen($cnpjCpfRem) === 14) {
                $stdRem->CNPJ = $cnpjCpfRem;
            } elseif (strlen($cnpjCpfRem) === 11) {
                $stdRem->CPF = $cnpjCpfRem;
            }
            $stdRem->xNome = $ensureString($dados['remetente']['nome'] ?? null, '');
            $stdRem->enderReme = new \stdClass();
            $remMun = trim($ensureString($dados['remetente']['municipio'] ?? null, 'SAO PAULO')) ?: 'SAO PAULO';
            $remUF = strtoupper(trim($ensureString($dados['remetente']['uf'] ?? null, $uf))) ?: $uf;
            $stdRem->enderReme->cMun = (string)$this->getCodigoMunicipio($remMun, $remUF);
            $stdRem->enderReme->xMun = (string)$remMun;
            $stdRem->enderReme->UF = (string)$remUF;
            $make->tagrem($stdRem);

            // DEST - Destinatário
            $cnpjCpfDest = preg_replace('/\D/', '', $ensureString($dados['destinatario']['cnpjCpf'] ?? null, ''));
            $stdDest = new \stdClass();
            if (strlen($cnpjCpfDest) === 14) {
                $stdDest->CNPJ = $cnpjCpfDest;
            } elseif (strlen($cnpjCpfDest) === 11) {
                $stdDest->CPF = $cnpjCpfDest;
            }
            $stdDest->xNome = $ensureString($dados['destinatario']['nome'] ?? null, '');
            $stdDest->enderDest = new \stdClass();
            $destMun = trim($ensureString($dados['destinatario']['municipio'] ?? null, 'SAO PAULO')) ?: 'SAO PAULO';
            $destUF = strtoupper(trim($ensureString($dados['destinatario']['uf'] ?? null, $uf))) ?: $uf;
            $stdDest->enderDest->cMun = (string)$this->getCodigoMunicipio($destMun, $destUF);
            $stdDest->enderDest->xMun = (string)$destMun;
            $stdDest->enderDest->UF = (string)$destUF;
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
            // Não incluir RNTRC se vazio - pode causar problemas
            // $stdRodo->RNTRC = ''; // Opcional
            $make->tagrodo($stdRodo);

            // Tomador do serviço (OBRIGATÓRIO no monta())
            // Usar tagtoma3 (estrutura simples) - toma=3 = Destinatário é o tomador
            // O patch em patches/makecte-fix.patch corrige bug da biblioteca quando toma3/toma4 está vazio
            $stdToma3 = new \stdClass();
            $stdToma3->toma = '3';

            try {
                $make->tagtoma3($stdToma3);
            } catch (\Throwable $e) {
                error_log("CTeService::emitir - Erro ao chamar tagtoma3(): " . $e->getMessage());
                throw new Exception("Erro ao criar tag toma3: " . $e->getMessage());
            }

            // Montar XML - ordem das tags já foi respeitada (ide, emit, rem, dest, vPrest, rodo, toma4)
            try {
                $make->monta();
            } catch (\Throwable $e) {
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
        // Garantir que os parâmetros sejam strings válidas
        $municipio = $municipio !== null ? (string)$municipio : 'SAO PAULO';
        $uf = $uf !== null ? strtoupper((string)$uf) : 'SP';
        
        // Códigos comuns (você deve expandir isso com tabela IBGE completa)
        $codigos = [
            'SP' => ['SAO PAULO' => '3550308', 'CAMPINAS' => '3509502'],
            'RJ' => ['RIO DE JANEIRO' => '3304557'],
            'MG' => ['BELO HORIZONTE' => '3106200'],
            'PR' => ['SAO JOAO' => '4125209', 'SAO JORGE DOESTE' => '4125308', 'SAO JORGE D\'OESTE' => '4125308'],
            // Adicione mais conforme necessário
        ];
        
        $municipioUpper = strtoupper(trim($municipio));
        if (isset($codigos[$uf][$municipioUpper])) {
            return (string)$codigos[$uf][$municipioUpper];
        }
        
        // Fallback: retorna código genérico baseado na UF
        $fallbacks = [
            'SP' => '3550308',
            'RJ' => '3304557',
            'MG' => '3106200',
            'PR' => '4125209',
        ];
        
        return (string)($fallbacks[$uf] ?? '3550308');
    }
}
