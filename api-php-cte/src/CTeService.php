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
            $stdIde->tpServ = '0';   // 0 = Normal
            
            // Municípios e UFs - garantir valores válidos
            $remetenteMunicipio = trim((string)($dados['remetente']['municipio'] ?? ''));
            $remetenteUF = strtoupper(trim((string)($dados['remetente']['uf'] ?? $uf)));
            $destinatarioMunicipio = trim((string)($dados['destinatario']['municipio'] ?? ''));
            $destinatarioUF = strtoupper(trim((string)($dados['destinatario']['uf'] ?? '')));
            
            // Se UF vazia, usar UF padrão
            if (empty($remetenteUF)) $remetenteUF = $uf;
            if (empty($destinatarioUF)) $destinatarioUF = $uf;
            
            // Códigos de município
            $cMunEnv = (string)$this->getCodigoMunicipio($remetenteMunicipio ?: 'SAO PAULO', $remetenteUF);
            $cMunIni = (string)$this->getCodigoMunicipio($remetenteMunicipio ?: 'SAO PAULO', $remetenteUF);
            $cMunFim = (string)$this->getCodigoMunicipio($destinatarioMunicipio ?: 'SAO PAULO', $destinatarioUF);
            
            $stdIde->cMunEnv = $cMunEnv;
            $stdIde->xMunEnv = $remetenteMunicipio ?: 'SAO PAULO';
            $stdIde->UFEnv = $remetenteUF;
            $stdIde->cMunIni = $cMunIni;
            $stdIde->xMunIni = $remetenteMunicipio ?: 'SAO PAULO';
            $stdIde->UFIni = $remetenteUF;
            $stdIde->cMunFim = $cMunFim;
            $stdIde->xMunFim = $destinatarioMunicipio ?: 'SAO PAULO';
            $stdIde->UFFim = $destinatarioUF;
            // Demais obrigatórios da ide
            $stdIde->retira = '0';
            $stdIde->indIEToma = '9';
            
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
            foreach ($camposObrigatorios as $campo) {
                if (!isset($stdIde->$campo) || $stdIde->$campo === '' || $stdIde->$campo === null) {
                    throw new Exception("Campo obrigatório '$campo' está faltando ou vazio na tag ide");
                }
            }
            
            // Log dos dados antes de criar a tag ide
            error_log("CTeService::emitir - Dados IDE: " . json_encode($stdIde, JSON_UNESCAPED_UNICODE));

            // Criar tag ide
            $make->tagide($stdIde);

            // Tomador do serviço (OBRIGATÓRIO no monta())
            // 3 = Destinatário (padrão)
            $stdToma3 = new \stdClass();
            $stdToma3->toma = '3';
            $make->tagtoma3($stdToma3);

            // EMIT - Emitente (sua empresa)
            $stdEmit = new \stdClass();
            $stdEmit->CNPJ = $cnpj;
            // Não incluir IE se vazio - pode causar problemas
            if (!empty($this->config['ie'] ?? '')) {
                $stdEmit->IE = (string)$this->config['ie'];
            }
            $stdEmit->xNome = $this->config['razaosocial'];
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
            $cnpjCpfRem = preg_replace('/\D/', '', $dados['remetente']['cnpjCpf'] ?? '');
            $stdRem = new \stdClass();
            if (strlen($cnpjCpfRem) === 14) {
                $stdRem->CNPJ = $cnpjCpfRem;
            } elseif (strlen($cnpjCpfRem) === 11) {
                $stdRem->CPF = $cnpjCpfRem;
            }
            $stdRem->xNome = (string)($dados['remetente']['nome'] ?? '');
            $stdRem->enderReme = new \stdClass();
            $remMun = trim((string)($dados['remetente']['municipio'] ?? ''));
            $remUF = strtoupper(trim((string)($dados['remetente']['uf'] ?? '')));
            if (empty($remUF)) $remUF = $uf;
            $stdRem->enderReme->cMun = (string)$this->getCodigoMunicipio($remMun ?: 'SAO PAULO', $remUF);
            $stdRem->enderReme->xMun = $remMun ?: 'SAO PAULO';
            $stdRem->enderReme->UF = $remUF;
            $make->tagrem($stdRem);

            // DEST - Destinatário
            $cnpjCpfDest = preg_replace('/\D/', '', $dados['destinatario']['cnpjCpf'] ?? '');
            $stdDest = new \stdClass();
            if (strlen($cnpjCpfDest) === 14) {
                $stdDest->CNPJ = $cnpjCpfDest;
            } elseif (strlen($cnpjCpfDest) === 11) {
                $stdDest->CPF = $cnpjCpfDest;
            }
            $stdDest->xNome = (string)($dados['destinatario']['nome'] ?? '');
            $stdDest->enderDest = new \stdClass();
            $destMun = trim((string)($dados['destinatario']['municipio'] ?? ''));
            $destUF = strtoupper(trim((string)($dados['destinatario']['uf'] ?? '')));
            if (empty($destUF)) $destUF = $uf;
            $stdDest->enderDest->cMun = (string)$this->getCodigoMunicipio($destMun ?: 'SAO PAULO', $destUF);
            $stdDest->enderDest->xMun = $destMun ?: 'SAO PAULO';
            $stdDest->enderDest->UF = $destUF;
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

            // Montar XML
            // WORKAROUND: Se tagide() não criou a tag corretamente, tentar chamar novamente antes de monta()
            // Isso pode resolver problemas de inicialização
            try {
                error_log("CTeService::emitir - Chamando monta()...");
                $make->monta();
                error_log("CTeService::emitir - monta() executado com sucesso");
            } catch (\TypeError $e) {
                // Se o erro for sobre tag ide não encontrada, tentar recriar
                if (strpos($e->getMessage(), 'ide') !== false || strpos($e->getMessage(), 'appChild') !== false) {
                    error_log("CTeService::emitir - Erro detectado relacionado à tag ide, tentando recriar...");
                    try {
                        // Tentar chamar tagide novamente
                        $make->tagide($stdIde);
                        error_log("CTeService::emitir - tagide() chamado novamente");
                        // Tentar monta() novamente
                        $make->monta();
                        error_log("CTeService::emitir - monta() executado com sucesso após recriar tag ide");
                    } catch (\Throwable $e2) {
                        error_log("CTeService::emitir - Erro ao tentar recriar tag ide: " . $e2->getMessage());
                        throw new Exception("Erro ao montar XML do CT-e: A tag 'ide' não pode ser criada. Verifique se todos os campos obrigatórios estão preenchidos corretamente. Erro original: " . $e->getMessage());
                    }
                } else {
                    throw $e;
                }
            } catch (\Throwable $e) {
                error_log("CTeService::emitir - Erro ao montar XML: " . $e->getMessage());
                error_log("CTeService::emitir - Tipo: " . get_class($e));
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
