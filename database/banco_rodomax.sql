-- =====================================================================================
-- RODOMAX HUB — banco_rodomax.sql
-- Criação / migração NÃO DESTRUTIVA do banco central (PostgreSQL 13+).
--
-- • Pode ser executado mais de uma vez (idempotente): usa IF NOT EXISTS / OR REPLACE.
-- • NÃO apaga, NÃO renomeia e NÃO altera tabelas existentes. As tabelas da 1ª etapa
--   (hub_registros e hub_pendencias) são preservadas com os seus dados.
-- • Não contém DROP TABLE, TRUNCATE nem DELETE.
-- • Não armazena senhas nem tokens.
--
-- Como executar (PowerShell, container do PostgreSQL já existente):
--   Get-Content .\database\banco_rodomax.sql | docker exec -i <container_postgres> psql -U <usuario> -d <banco>
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0) Tabelas da 1ª ETAPA (preservadas). Só são criadas se ainda não existirem, para que
--    um banco novo fique com a mesma estrutura do workflow "ultimo". Nada é alterado
--    quando elas já existem.
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hub_registros (
    id                  SERIAL PRIMARY KEY,
    chave_registro      TEXT NOT NULL UNIQUE,
    canal_origem        TEXT NOT NULL,
    recebido_em         TIMESTAMPTZ NOT NULL,
    ambiente            TEXT,
    nome                TEXT,
    telefone            TEXT,
    email               TEXT,
    documento           TEXT,
    data_pedido         DATE,
    tipo                TEXT,
    observacao          TEXT,
    nota_fiscal         TEXT,
    categoria           TEXT,
    setor_responsavel   TEXT,
    regra_classificacao TEXT,
    status_validacao    TEXT NOT NULL,
    crm_status          TEXT,
    crm_fonte           TEXT,
    crm_id              TEXT,
    crm_nome            TEXT,
    criado_em           TIMESTAMPTZ DEFAULT now(),
    atualizado_em       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hub_pendencias (
    id               SERIAL PRIMARY KEY,
    chave_registro   TEXT NOT NULL UNIQUE,
    canal_origem     TEXT,
    recebido_em      TIMESTAMPTZ,
    ambiente         TEXT,
    status_validacao TEXT NOT NULL,
    motivos          TEXT,
    dados_originais  TEXT,
    status_revisao   TEXT,
    criado_em        TIMESTAMPTZ DEFAULT now(),
    atualizado_em    TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------------------------------------
-- 1) ARQUIVOS RECEBIDOS (PDF e CSV). Um CSV = 1 arquivo = 1 lote com N registros.
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hub_arquivos (
    id                    SERIAL PRIMARY KEY,
    nome_arquivo          TEXT NOT NULL,
    tipo_arquivo          TEXT NOT NULL CHECK (tipo_arquivo IN ('pdf', 'csv')),
    finalidade            TEXT NOT NULL CHECK (finalidade IN ('novas_demandas', 'historico', 'documento')),
    canal                 TEXT NOT NULL DEFAULT 'web',
    tamanho_bytes         INTEGER,
    hash_conteudo         TEXT,
    separador             TEXT,
    cabecalhos            JSONB,
    registros_total       INTEGER NOT NULL DEFAULT 0,
    registros_importados  INTEGER NOT NULL DEFAULT 0,
    registros_rejeitados  INTEGER NOT NULL DEFAULT 0,
    registros_duplicados  INTEGER NOT NULL DEFAULT 0,
    status                TEXT NOT NULL DEFAULT 'recebido'
                          CHECK (status IN ('recebido', 'processado', 'sem_texto', 'erro')),
    texto_extraido        TEXT,
    detalhe               TEXT,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_hub_arquivos_criado ON hub_arquivos (criado_em DESC);

-- -------------------------------------------------------------------------------------
-- 2) MODELOS DE IA treinados (árvore CART/Gini serializada em JSON + métricas reais).
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ia_modelos (
    id              SERIAL PRIMARY KEY,
    versao          TEXT NOT NULL,
    algoritmo       TEXT NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT false,
    parametros      JSONB NOT NULL,
    atributos       JSONB NOT NULL,
    arvore          JSONB NOT NULL,
    arvore_texto    TEXT,
    importancias    JSONB,
    metricas        JSONB NOT NULL,
    preparacao      JSONB,
    n_treino        INTEGER,
    n_teste         INTEGER,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- no máximo um modelo ativo
CREATE UNIQUE INDEX IF NOT EXISTS ux_ia_modelos_um_ativo ON ia_modelos (ativo) WHERE ativo;

-- -------------------------------------------------------------------------------------
-- 3) BASE HISTÓRICA ROTULADA (rodomax_demandas.csv). Usada SOMENTE para treino/avaliação.
--    Os valores são armazenados como vieram no arquivo (nada é alterado silenciosamente).
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ia_historico (
    id                  SERIAL PRIMARY KEY,
    id_demanda          INTEGER NOT NULL UNIQUE,
    canal               TEXT,
    produto             TEXT NOT NULL,
    uf_origem           TEXT NOT NULL,
    destino             TEXT NOT NULL,
    distancia_km        NUMERIC NOT NULL,
    frete_ton           NUMERIC NOT NULL,
    saldo_ton           NUMERIC NOT NULL,
    balanca             TEXT NOT NULL,
    estrada_chao_km     NUMERIC NOT NULL,
    antecedencia_h      NUMERIC NOT NULL,
    status_agendamento  TEXT,
    atendida            TEXT NOT NULL CHECK (atendida IN ('sim', 'nao')),
    arquivo_id          INTEGER REFERENCES hub_arquivos (id),
    importado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------------------
-- 4) DEMANDAS (gerais e logísticas) — tabela central do HUB.
-- -------------------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS hub_protocolo_seq START 1;

CREATE TABLE IF NOT EXISTS hub_demandas (
    id                   BIGSERIAL PRIMARY KEY,
    protocolo            TEXT NOT NULL UNIQUE
                         DEFAULT ('RDM-' || lpad(nextval('hub_protocolo_seq')::text, 6, '0')),
    chave_evento         TEXT NOT NULL UNIQUE,          -- evita duplicidade do mesmo evento
    canal                TEXT NOT NULL CHECK (canal IN ('web', 'telegram', 'email', 'pdf', 'csv', 'portal', 'teste')),
    tipo_demanda         TEXT NOT NULL CHECK (tipo_demanda IN ('geral', 'logistica')),
    status               TEXT NOT NULL CHECK (status IN ('processada', 'pendente', 'rejeitada', 'erro')),
    solicitante_nome     TEXT,
    solicitante_email    TEXT,
    solicitante_telefone TEXT,
    telegram_chat_id     BIGINT,
    assunto              TEXT,
    descricao            TEXT,
    categoria            TEXT,
    setor_responsavel    TEXT,
    regra_classificacao  TEXT,
    motivos              JSONB NOT NULL DEFAULT '[]'::jsonb,   -- erros/pendências de validação
    avisos               JSONB NOT NULL DEFAULT '[]'::jsonb,
    dados_originais      JSONB NOT NULL,                       -- conteúdo exatamente como chegou
    dados_normalizados   JSONB,
    arquivo_id           INTEGER REFERENCES hub_arquivos (id),
    linha_arquivo        INTEGER,
    resposta_status      TEXT NOT NULL DEFAULT 'pendente'
                         CHECK (resposta_status IN ('pendente', 'enviada', 'nao_enviada', 'nao_aplicavel')),
    resposta_detalhe     TEXT,
    ambiente             TEXT NOT NULL DEFAULT 'demonstracao',
    recebido_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_hub_demandas_criado  ON hub_demandas (criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_hub_demandas_canal   ON hub_demandas (canal);
CREATE INDEX IF NOT EXISTS ix_hub_demandas_tipo    ON hub_demandas (tipo_demanda, status);
CREATE INDEX IF NOT EXISTS ix_hub_demandas_arquivo ON hub_demandas (arquivo_id);

-- Atributos operacionais (mesma estrutura do dataset) + resultado da previsão da IA.
CREATE TABLE IF NOT EXISTS hub_demandas_logisticas (
    demanda_id       BIGINT PRIMARY KEY REFERENCES hub_demandas (id),
    produto          TEXT,
    uf_origem        TEXT,
    destino          TEXT,
    distancia_km     NUMERIC,
    frete_ton        NUMERIC,
    saldo_ton        NUMERIC,
    balanca          TEXT,
    estrada_chao_km  NUMERIC,
    antecedencia_h   NUMERIC,
    previsao         TEXT CHECK (previsao IN ('sim', 'nao')),   -- NULL = sem previsão
    prob_atendida    NUMERIC,      -- frequência suavizada na folha (não é probabilidade calibrada)
    explicacao       JSONB,        -- caminho na árvore, atributos decisivos, avisos
    modelo_id        INTEGER REFERENCES ia_modelos (id),
    previsto_em      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_hub_dl_previsao ON hub_demandas_logisticas (previsao);

-- -------------------------------------------------------------------------------------
-- 5) HISTÓRICO DE PROCESSAMENTO (linha do tempo de cada demanda/arquivo)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hub_eventos (
    id          BIGSERIAL PRIMARY KEY,
    demanda_id  BIGINT REFERENCES hub_demandas (id),
    arquivo_id  INTEGER REFERENCES hub_arquivos (id),
    etapa       TEXT NOT NULL,
    detalhe     TEXT,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_hub_eventos_demanda ON hub_eventos (demanda_id);

-- -------------------------------------------------------------------------------------
-- 6) CONVERSAS DO TELEGRAM (coleta progressiva de dados). Guarda só o necessário.
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telegram_conversas (
    chat_id        BIGINT PRIMARY KEY,
    estado         JSONB NOT NULL DEFAULT '{}'::jsonb,
    ultimo_update  BIGINT,
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================================
-- FUNÇÕES DE PERSISTÊNCIA E CONSULTA
-- As regras de negócio (validação, classificação, IA) ficam no n8n. Estas funções só
-- gravam/leem dados, para que cada node PostgreSQL do workflow tenha uma única linha SQL.
-- =====================================================================================

-- Converte texto em número com segurança (NULL quando não for número)
CREATE OR REPLACE FUNCTION hub_num(t TEXT) RETURNS NUMERIC
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF t IS NULL OR btrim(t) = '' THEN RETURN NULL; END IF;
    RETURN t::numeric;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

-- Registra uma demanda (geral ou logística). Recebe o JSON montado pelo n8n.
-- Se o mesmo evento (chave_evento) já foi registrado, NÃO duplica: devolve o protocolo existente.
CREATE OR REPLACE FUNCTION hub_registrar_demanda(p JSONB) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
    v_id        BIGINT;
    v_protocolo TEXT;
    v_existente BOOLEAN := false;
    l           JSONB := p -> 'logistica';
BEGIN
    SELECT id, protocolo INTO v_id, v_protocolo FROM hub_demandas WHERE chave_evento = p ->> 'chave_evento';
    IF v_id IS NOT NULL THEN
        v_existente := true;
        INSERT INTO hub_eventos (demanda_id, etapa, detalhe)
        VALUES (v_id, 'duplicidade', 'Evento recebido novamente; registro original mantido.');
    ELSE
        INSERT INTO hub_demandas (
            chave_evento, canal, tipo_demanda, status, solicitante_nome, solicitante_email,
            solicitante_telefone, telegram_chat_id, assunto, descricao, categoria, setor_responsavel,
            regra_classificacao, motivos, avisos, dados_originais, dados_normalizados, arquivo_id,
            linha_arquivo, resposta_status, resposta_detalhe, ambiente, recebido_em)
        VALUES (
            p ->> 'chave_evento', p ->> 'canal', p ->> 'tipo_demanda', p ->> 'status',
            p ->> 'solicitante_nome', p ->> 'solicitante_email', p ->> 'solicitante_telefone',
            (p ->> 'telegram_chat_id')::bigint, p ->> 'assunto', p ->> 'descricao', p ->> 'categoria',
            p ->> 'setor_responsavel', p ->> 'regra_classificacao',
            COALESCE(p -> 'motivos', '[]'::jsonb), COALESCE(p -> 'avisos', '[]'::jsonb),
            COALESCE(p -> 'dados_originais', '{}'::jsonb), p -> 'dados_normalizados',
            (p ->> 'arquivo_id')::int, (p ->> 'linha_arquivo')::int,
            COALESCE(p ->> 'resposta_status', 'pendente'), p ->> 'resposta_detalhe', COALESCE(p ->> 'ambiente', 'demonstracao'),
            COALESCE((p ->> 'recebido_em')::timestamptz, now()))
        RETURNING id, protocolo INTO v_id, v_protocolo;

        IF p ->> 'tipo_demanda' = 'logistica' THEN
            INSERT INTO hub_demandas_logisticas (
                demanda_id, produto, uf_origem, destino, distancia_km, frete_ton, saldo_ton, balanca,
                estrada_chao_km, antecedencia_h, previsao, prob_atendida, explicacao, modelo_id, previsto_em)
            VALUES (
                v_id, l ->> 'produto', l ->> 'uf_origem', l ->> 'destino', hub_num(l ->> 'distancia_km'),
                hub_num(l ->> 'frete_ton'), hub_num(l ->> 'saldo_ton'), l ->> 'balanca',
                hub_num(l ->> 'estrada_chao_km'), hub_num(l ->> 'antecedencia_h'),
                p -> 'previsao' ->> 'classe', hub_num(p -> 'previsao' ->> 'prob_atendida'),
                p -> 'previsao' -> 'explicacao', (p -> 'previsao' ->> 'modelo_id')::int,
                CASE WHEN p -> 'previsao' ->> 'classe' IS NOT NULL THEN now() END);
        END IF;

        INSERT INTO hub_eventos (demanda_id, arquivo_id, etapa, detalhe)
        SELECT v_id, (p ->> 'arquivo_id')::int, e ->> 'etapa', e ->> 'detalhe'
        FROM jsonb_array_elements(COALESCE(p -> 'eventos', '[]'::jsonb)) e;

        -- PDF que gerou a demanda passa a "processado"
        UPDATE hub_arquivos SET status = 'processado', registros_importados = 1, atualizado_em = now()
        WHERE id = (p ->> 'arquivo_id')::int AND tipo_arquivo = 'pdf' AND status = 'recebido';
    END IF;

    RETURN jsonb_build_object('id', v_id, 'protocolo', v_protocolo, 'duplicado', v_existente);
END $$;

-- Atualiza o resultado do envio da resposta (Telegram / e-mail / web). Nunca apaga a demanda.
CREATE OR REPLACE FUNCTION hub_registrar_resposta(p_id BIGINT, p_status TEXT, p_detalhe TEXT) RETURNS JSONB
LANGUAGE sql AS $$
    WITH u AS (
        UPDATE hub_demandas SET resposta_status = p_status, resposta_detalhe = p_detalhe, atualizado_em = now()
        WHERE id = p_id RETURNING id, protocolo
    ), e AS (
        INSERT INTO hub_eventos (demanda_id, etapa, detalhe)
        SELECT id, 'resposta', p_status || COALESCE(': ' || p_detalhe, '') FROM u
    )
    SELECT jsonb_build_object('id', id, 'protocolo', protocolo, 'resposta_status', p_status) FROM u;
$$;

-- Registra um arquivo recebido (PDF ou CSV) e devolve o id.
CREATE OR REPLACE FUNCTION hub_registrar_arquivo(p JSONB) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE v_id INTEGER;
BEGIN
    INSERT INTO hub_arquivos (nome_arquivo, tipo_arquivo, finalidade, canal, tamanho_bytes, hash_conteudo,
                              separador, cabecalhos, registros_total, registros_rejeitados, status,
                              texto_extraido, detalhe)
    VALUES (COALESCE(NULLIF(p ->> 'nome_arquivo', ''), 'sem_nome'), p ->> 'tipo_arquivo', p ->> 'finalidade',
            COALESCE(p ->> 'canal', 'web'), (p ->> 'tamanho_bytes')::int, p ->> 'hash_conteudo',
            p ->> 'separador', p -> 'cabecalhos', COALESCE((p ->> 'registros_total')::int, 0),
            COALESCE((p ->> 'registros_rejeitados')::int, 0), COALESCE(p ->> 'status', 'recebido'),
            left(p ->> 'texto_extraido', 20000), p ->> 'detalhe')
    RETURNING id INTO v_id;
    INSERT INTO hub_eventos (arquivo_id, etapa, detalhe)
    VALUES (v_id, 'arquivo_recebido', (p ->> 'tipo_arquivo') || ' / ' || (p ->> 'finalidade') || ' / ' || COALESCE(p ->> 'detalhe', ''));
    RETURN jsonb_build_object('arquivo_id', v_id);
END $$;

-- Recalcula os contadores de um arquivo a partir das demandas gravadas (idempotente).
CREATE OR REPLACE FUNCTION hub_atualizar_arquivo(p_arquivo_id INTEGER) RETURNS JSONB
LANGUAGE sql AS $$
    UPDATE hub_arquivos a SET
        registros_importados = s.importados,
        registros_rejeitados = s.rejeitados,
        status = CASE WHEN a.status = 'recebido' THEN 'processado' ELSE a.status END,
        atualizado_em = now()
    FROM (SELECT count(*) FILTER (WHERE status IN ('processada', 'pendente', 'erro')) AS importados,
                 count(*) FILTER (WHERE status = 'rejeitada') AS rejeitados
          FROM hub_demandas WHERE arquivo_id = p_arquivo_id) s
    WHERE a.id = p_arquivo_id
    RETURNING jsonb_build_object('arquivo_id', a.id, 'nome_arquivo', a.nome_arquivo, 'status', a.status,
        'registros_total', a.registros_total, 'registros_importados', a.registros_importados,
        'registros_rejeitados', a.registros_rejeitados);
$$;

-- Importa a base histórica rotulada (array JSON de registros já validados pelo n8n).
-- ON CONFLICT: reimportar o mesmo arquivo não duplica registros (chave = id_demanda).
CREATE OR REPLACE FUNCTION hub_importar_historico(p_arquivo_id INTEGER, p_registros JSONB,
                                                  p_rejeitados INTEGER DEFAULT 0, p_exemplos JSONB DEFAULT '[]'::jsonb) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE v_ins INTEGER; v_total INTEGER := jsonb_array_length(p_registros);
BEGIN
    INSERT INTO ia_historico (id_demanda, canal, produto, uf_origem, destino, distancia_km, frete_ton, saldo_ton,
                              balanca, estrada_chao_km, antecedencia_h, status_agendamento, atendida, arquivo_id)
    SELECT r.id_demanda, r.canal, r.produto, r.uf_origem, r.destino, r.distancia_km, r.frete_ton, r.saldo_ton,
           r.balanca, r.estrada_chao_km, r.antecedencia_h, r.status_agendamento, r.atendida, p_arquivo_id
    FROM jsonb_to_recordset(p_registros) AS r(
        id_demanda INTEGER, canal TEXT, produto TEXT, uf_origem TEXT, destino TEXT, distancia_km NUMERIC,
        frete_ton NUMERIC, saldo_ton NUMERIC, balanca TEXT, estrada_chao_km NUMERIC, antecedencia_h NUMERIC,
        status_agendamento TEXT, atendida TEXT)
    ON CONFLICT (id_demanda) DO NOTHING;
    GET DIAGNOSTICS v_ins = ROW_COUNT;

    UPDATE hub_arquivos SET registros_importados = v_ins, registros_duplicados = v_total - v_ins,
           registros_rejeitados = COALESCE(p_rejeitados, 0), status = 'processado', atualizado_em = now()
    WHERE id = p_arquivo_id;
    INSERT INTO hub_eventos (arquivo_id, etapa, detalhe)
    VALUES (p_arquivo_id, 'historico_importado', v_ins || ' novos registros; ' || (v_total - v_ins) || ' já existiam; '
            || COALESCE(p_rejeitados, 0) || ' linha(s) rejeitada(s)');

    RETURN jsonb_build_object('arquivo_id', p_arquivo_id, 'validos', v_total, 'inseridos', v_ins,
                              'ja_existentes', v_total - v_ins, 'rejeitados', COALESCE(p_rejeitados, 0),
                              'exemplos_rejeicao', p_exemplos,
                              'total_na_base', (SELECT count(*) FROM ia_historico));
END $$;

-- Salva um modelo treinado e o torna o modelo ativo (o anterior é apenas desativado).
CREATE OR REPLACE FUNCTION hub_salvar_modelo(p JSONB) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE v_id INTEGER;
BEGIN
    UPDATE ia_modelos SET ativo = false WHERE ativo;
    INSERT INTO ia_modelos (versao, algoritmo, ativo, parametros, atributos, arvore, arvore_texto,
                            importancias, metricas, preparacao, n_treino, n_teste)
    VALUES (p ->> 'versao', p ->> 'algoritmo', true, p -> 'parametros', p -> 'atributos', p -> 'arvore',
            p ->> 'arvore_texto', p -> 'importancias', p -> 'metricas', p -> 'preparacao',
            (p ->> 'n_treino')::int, (p ->> 'n_teste')::int)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('modelo_id', v_id, 'versao', p ->> 'versao');
END $$;

-- -------------------------------------------------------------------------------------
-- CONSULTAS (usadas pelos endpoints de leitura do n8n)
-- -------------------------------------------------------------------------------------

-- Indicadores do dashboard. Cada métrica tem a sua unidade (mensagens ≠ arquivos ≠ registros).
-- Demandas do ambiente 'teste' (execução manual de casos de teste) NÃO entram nos indicadores.
CREATE OR REPLACE FUNCTION hub_dashboard() RETURNS JSONB
LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object(
    'gerado_em', now(),
    'demandas', (SELECT jsonb_build_object(
        'total',       count(*),
        'gerais',      count(*) FILTER (WHERE tipo_demanda = 'geral'),
        'logisticas',  count(*) FILTER (WHERE tipo_demanda = 'logistica'),
        'processadas', count(*) FILTER (WHERE status = 'processada'),
        'pendentes',   count(*) FILTER (WHERE status = 'pendente'),
        'rejeitadas',  count(*) FILTER (WHERE status = 'rejeitada'),
        'com_erro',    count(*) FILTER (WHERE status = 'erro'),
        'hoje',        count(*) FILTER (WHERE criado_em::date = current_date)) FROM hub_demandas WHERE ambiente <> 'teste'),
    'por_canal', (SELECT COALESCE(jsonb_object_agg(canal, n), '{}'::jsonb)
                  FROM (SELECT canal, count(*) n FROM hub_demandas WHERE ambiente <> 'teste' GROUP BY canal) c),
    'mensagens', (SELECT jsonb_build_object(
        'telegram', count(*) FILTER (WHERE canal = 'telegram'),
        'email',    count(*) FILTER (WHERE canal = 'email'),
        'web',      count(*) FILTER (WHERE canal = 'web')) FROM hub_demandas WHERE ambiente <> 'teste'),
    'arquivos', (SELECT jsonb_build_object(
        'pdf',                     count(*) FILTER (WHERE tipo_arquivo = 'pdf'),
        'csv',                     count(*) FILTER (WHERE tipo_arquivo = 'csv'),
        'csv_novas_demandas',      count(*) FILTER (WHERE tipo_arquivo = 'csv' AND finalidade = 'novas_demandas'),
        'csv_historico',           count(*) FILTER (WHERE tipo_arquivo = 'csv' AND finalidade = 'historico'),
        -- registros dentro dos CSVs de NOVAS DEMANDAS (1 arquivo pode ter centenas de registros)
        'registros_csv_lidos',     COALESCE(sum(registros_total) FILTER (WHERE tipo_arquivo = 'csv' AND finalidade = 'novas_demandas'), 0),
        'registros_csv_importados',COALESCE(sum(registros_importados) FILTER (WHERE tipo_arquivo = 'csv' AND finalidade = 'novas_demandas'), 0),
        'registros_csv_rejeitados',COALESCE(sum(registros_rejeitados) FILTER (WHERE tipo_arquivo = 'csv' AND finalidade = 'novas_demandas'), 0),
        -- registros dos CSVs de BASE HISTÓRICA (vão para ia_historico, não viram demandas)
        'registros_historico_lidos', COALESCE(sum(registros_total) FILTER (WHERE tipo_arquivo = 'csv' AND finalidade = 'historico'), 0),
        'pdf_sem_texto',           count(*) FILTER (WHERE tipo_arquivo = 'pdf' AND status IN ('sem_texto', 'erro'))) FROM hub_arquivos),
    'previsoes', (SELECT jsonb_build_object(
        'total', count(previsao),
        'atendida', count(*) FILTER (WHERE previsao = 'sim'),
        'nao_atendida', count(*) FILTER (WHERE previsao = 'nao'))
                  FROM hub_demandas_logisticas l JOIN hub_demandas d ON d.id = l.demanda_id WHERE d.ambiente <> 'teste'),
    'por_setor', (SELECT COALESCE(jsonb_object_agg(setor_responsavel, n), '{}'::jsonb)
                  FROM (SELECT setor_responsavel, count(*) n FROM hub_demandas
                        WHERE tipo_demanda = 'geral' AND setor_responsavel IS NOT NULL AND ambiente <> 'teste' GROUP BY 1) s),
    'ultimos_14_dias', (SELECT COALESCE(jsonb_agg(jsonb_build_object('dia', d::date, 'total', n) ORDER BY d), '[]'::jsonb)
                  FROM (SELECT g.d, count(h.id) n
                        FROM generate_series(current_date - 13, current_date, interval '1 day') g(d)
                        LEFT JOIN hub_demandas h ON h.criado_em::date = g.d::date AND h.ambiente <> 'teste' GROUP BY g.d) x),
    'historico_ia', (SELECT jsonb_build_object('registros', count(*),
                        'atendida_sim', count(*) FILTER (WHERE atendida = 'sim'),
                        'atendida_nao', count(*) FILTER (WHERE atendida = 'nao')) FROM ia_historico),
    'modelo_ativo', (SELECT jsonb_build_object('id', id, 'versao', versao, 'criado_em', criado_em,
                        'acuracia', metricas -> 'arvore' ->> 'acuracia',
                        'acuracia_linha_base', metricas -> 'linha_base' ->> 'acuracia')
                     FROM ia_modelos WHERE ativo)
);
$$;

-- Lista de demandas com filtros simples (canal, tipo_demanda, status, previsao, busca) e paginação.
CREATE OR REPLACE FUNCTION hub_listar_demandas(f JSONB) RETURNS JSONB
LANGUAGE sql STABLE AS $$
WITH base AS (
    SELECT d.id, d.protocolo, d.criado_em, d.canal, d.tipo_demanda, d.status, d.solicitante_nome,
           d.setor_responsavel, d.categoria, d.resposta_status, l.previsao, l.prob_atendida,
           l.produto, l.uf_origem, l.destino, a.nome_arquivo
    FROM hub_demandas d
    LEFT JOIN hub_demandas_logisticas l ON l.demanda_id = d.id
    LEFT JOIN hub_arquivos a ON a.id = d.arquivo_id
    WHERE (d.ambiente <> 'teste' OR f ->> 'incluir_testes' = 'true')
      AND (NULLIF(f ->> 'canal', '')  IS NULL OR d.canal = f ->> 'canal')
      AND (NULLIF(f ->> 'tipo_demanda', '') IS NULL OR d.tipo_demanda = f ->> 'tipo_demanda')
      AND (NULLIF(f ->> 'status', '') IS NULL OR d.status = f ->> 'status')
      AND (NULLIF(f ->> 'previsao', '') IS NULL OR l.previsao = f ->> 'previsao')
      AND (NULLIF(f ->> 'busca', '')  IS NULL
           OR d.protocolo ILIKE '%' || (f ->> 'busca') || '%'
           OR d.solicitante_nome ILIKE '%' || (f ->> 'busca') || '%'
           OR d.descricao ILIKE '%' || (f ->> 'busca') || '%'
           OR l.destino ILIKE '%' || (f ->> 'busca') || '%')
)
SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM base),
    'itens', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.criado_em DESC, b.id DESC) FROM (
        SELECT * FROM base ORDER BY criado_em DESC, id DESC
        LIMIT LEAST(COALESCE(NULLIF(f ->> 'limite', '')::int, 50), 200)
        OFFSET COALESCE(NULLIF(f ->> 'offset', '')::int, 0)) b), '[]'::jsonb));
$$;

-- Detalhe completo de uma demanda pelo protocolo.
CREATE OR REPLACE FUNCTION hub_detalhe_demanda(p_protocolo TEXT) RETURNS JSONB
LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object(
    'demanda', to_jsonb(d) - 'chave_evento',
    'logistica', (SELECT to_jsonb(l) FROM hub_demandas_logisticas l WHERE l.demanda_id = d.id),
    'arquivo', (SELECT jsonb_build_object('id', a.id, 'nome_arquivo', a.nome_arquivo, 'tipo_arquivo', a.tipo_arquivo)
                FROM hub_arquivos a WHERE a.id = d.arquivo_id),
    'modelo', (SELECT jsonb_build_object('id', m.id, 'versao', m.versao) FROM hub_demandas_logisticas l
               JOIN ia_modelos m ON m.id = l.modelo_id WHERE l.demanda_id = d.id),
    'eventos', COALESCE((SELECT jsonb_agg(jsonb_build_object('etapa', e.etapa, 'detalhe', e.detalhe, 'criado_em', e.criado_em)
                ORDER BY e.id) FROM hub_eventos e WHERE e.demanda_id = d.id), '[]'::jsonb))
FROM hub_demandas d WHERE upper(d.protocolo) = upper(btrim(p_protocolo));
$$;

-- Arquivos recebidos (últimos 100).
CREATE OR REPLACE FUNCTION hub_listar_arquivos() RETURNS JSONB
LANGUAGE sql STABLE AS $$
SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.criado_em DESC), '[]'::jsonb) FROM (
    SELECT id, nome_arquivo, tipo_arquivo, finalidade, canal, tamanho_bytes, separador, cabecalhos,
           registros_total, registros_importados, registros_rejeitados, registros_duplicados, status,
           detalhe, left(texto_extraido, 600) AS texto_previa, criado_em
    FROM hub_arquivos ORDER BY criado_em DESC LIMIT 100) x;
$$;

-- Modelo ativo (sem a árvore completa na lista; a árvore vem no detalhe).
CREATE OR REPLACE FUNCTION hub_modelo_ativo() RETURNS JSONB
LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object(
    'ativo', (SELECT to_jsonb(m) FROM ia_modelos m WHERE m.ativo),
    'versoes', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'versao', versao, 'ativo', ativo, 'criado_em', criado_em,
                'acuracia', metricas -> 'arvore' ->> 'acuracia') ORDER BY id DESC) FROM ia_modelos), '[]'::jsonb),
    'historico', (SELECT jsonb_build_object('registros', count(*),
                'atendida_sim', count(*) FILTER (WHERE atendida = 'sim'),
                'atendida_nao', count(*) FILTER (WHERE atendida = 'nao')) FROM ia_historico));
$$;

COMMIT;

-- Verificação rápida (opcional):
--   SELECT hub_dashboard();
--   \dt hub_*
