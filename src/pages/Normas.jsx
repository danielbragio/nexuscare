import { useState } from "react";

const CATEGORIAS = [
  {
    key: "protocolos",
    titulo: "Protocolos Assistenciais",
    icone: "📋",
    cor: "#2563eb",
    normas: [
      {
        id: "p1",
        titulo: "Protocolo de Triagem Manchester",
        descricao: "Classificação de risco e prioridade de atendimento para urgência e emergência conforme o Sistema Manchester.",
        versao: "v3.2",
        atualizacao: "10/01/2025",
        status: "ativo",
      },
      {
        id: "p2",
        titulo: "Protocolo de Sepse",
        descricao: "Identificação precoce, bundle de sepse (1h, 3h e 6h) e manejo inicial do paciente séptico.",
        versao: "v2.1",
        atualizacao: "15/02/2025",
        status: "ativo",
      },
      {
        id: "p3",
        titulo: "Protocolo de Dor Torácica",
        descricao: "Avaliação clínica, eletrocardiograma, marcadores cardíacos e fluxo de encaminhamento para síndrome coronariana aguda.",
        versao: "v1.8",
        atualizacao: "22/03/2025",
        status: "ativo",
      },
      {
        id: "p4",
        titulo: "Protocolo de AVC",
        descricao: "Reconhecimento precoce (FAST), ativação do time de AVC, janela terapêutica e contraindicações à trombólise.",
        versao: "v2.0",
        atualizacao: "01/04/2025",
        status: "ativo",
      },
    ],
  },
  {
    key: "seguranca",
    titulo: "Segurança do Paciente",
    icone: "🛡️",
    cor: "#0f766e",
    normas: [
      {
        id: "s1",
        titulo: "Identificação Correta do Paciente",
        descricao: "Uso de pulseiras, confirmação de nome e data de nascimento antes de qualquer procedimento, medicação ou exame.",
        versao: "v2.5",
        atualizacao: "05/01/2025",
        status: "ativo",
      },
      {
        id: "s2",
        titulo: "Cirurgia Segura — Checklist da OMS",
        descricao: "Verificações pré-operatórias, no momento da indução anestésica, incisão cirúrgica e saída da sala.",
        versao: "v1.4",
        atualizacao: "18/02/2025",
        status: "ativo",
      },
      {
        id: "s3",
        titulo: "Comunicação Efetiva no Passagem de Plantão",
        descricao: "Técnica SBAR (Situação, Histórico, Avaliação, Recomendação) para transferência segura de informações.",
        versao: "v1.2",
        atualizacao: "10/03/2025",
        status: "ativo",
      },
      {
        id: "s4",
        titulo: "Prevenção de Quedas",
        descricao: "Escala de Morse, classificação de risco, medidas preventivas e ações após ocorrência de queda.",
        versao: "v2.0",
        atualizacao: "25/03/2025",
        status: "ativo",
      },
      {
        id: "s5",
        titulo: "Notificação de Incidentes e Eventos Adversos",
        descricao: "Fluxo de notificação interna, preenchimento do formulário de ocorrência e comunicação à ANVISA.",
        versao: "v1.6",
        atualizacao: "08/04/2025",
        status: "ativo",
      },
    ],
  },
  {
    key: "higienizacao",
    titulo: "Higienização e Controle de Infecção",
    icone: "🧼",
    cor: "#7c3aed",
    normas: [
      {
        id: "h1",
        titulo: "Higienização das Mãos — 5 Momentos da OMS",
        descricao: "Técnica correta de lavagem com água e sabão, uso de álcool gel 70% e os cinco momentos obrigatórios.",
        versao: "v3.0",
        atualizacao: "03/01/2025",
        status: "ativo",
      },
      {
        id: "h2",
        titulo: "Higienização do Ambiente Hospitalar",
        descricao: "Limpeza concorrente, terminal e de isolamento. Produtos saneantes, diluições e frequências.",
        versao: "v2.2",
        atualizacao: "20/02/2025",
        status: "ativo",
      },
      {
        id: "h3",
        titulo: "Esterilização de Artigos e Instrumentais",
        descricao: "Classificação de Spaulding (crítico, semicrítico, não crítico), métodos de esterilização e rastreabilidade.",
        versao: "v2.4",
        atualizacao: "14/03/2025",
        status: "ativo",
      },
      {
        id: "h4",
        titulo: "Uso de EPI e Precauções Padrão",
        descricao: "Seleção, colocação e retirada de EPIs (luvas, máscara, óculos, avental). Precauções por contato, gotícula e aerossol.",
        versao: "v2.1",
        atualizacao: "02/04/2025",
        status: "ativo",
      },
    ],
  },
  {
    key: "residuos",
    titulo: "Gestão de Resíduos",
    icone: "♻️",
    cor: "#16a34a",
    normas: [
      {
        id: "r1",
        titulo: "Classificação e Segregação de RSS",
        descricao: "Grupos A, B, C, D e E conforme RDC 222/2018 da ANVISA. Identificação de recipientes e sacos coloridos.",
        versao: "v1.9",
        atualizacao: "07/01/2025",
        status: "ativo",
      },
      {
        id: "r2",
        titulo: "Manejo e Transporte Interno de Resíduos",
        descricao: "Rotas de coleta, horários, equipamentos de transporte e áreas de armazenamento temporário.",
        versao: "v1.5",
        atualizacao: "25/02/2025",
        status: "ativo",
      },
      {
        id: "r3",
        titulo: "Descarte de Perfurocortantes",
        descricao: "Uso obrigatório de caixas rígidas homologadas, volume máximo de preenchimento e procedimentos pós-exposição.",
        versao: "v2.3",
        atualizacao: "12/03/2025",
        status: "ativo",
      },
    ],
  },
  {
    key: "emergencias",
    titulo: "Emergências e Urgências",
    icone: "🚨",
    cor: "#dc2626",
    normas: [
      {
        id: "e1",
        titulo: "Parada Cardiorrespiratória — RCP Básica e Avançada",
        descricao: "Algoritmos do ACLS 2023, técnica de compressão torácica, uso do DEA e cuidados pós-PCR.",
        versao: "v4.0",
        atualizacao: "12/01/2025",
        status: "ativo",
      },
      {
        id: "e2",
        titulo: "Anafilaxia",
        descricao: "Critérios diagnósticos, administração de adrenalina, via de administração e monitorização.",
        versao: "v2.2",
        atualizacao: "28/02/2025",
        status: "ativo",
      },
      {
        id: "e3",
        titulo: "Código Azul — Ativação de Emergência Interna",
        descricao: "Acionamento do código azul, funções de cada membro da equipe de resposta rápida e registro da ocorrência.",
        versao: "v1.7",
        atualizacao: "20/03/2025",
        status: "ativo",
      },
    ],
  },
  {
    key: "administrativas",
    titulo: "Normas Administrativas",
    icone: "📁",
    cor: "#f59e0b",
    normas: [
      {
        id: "a1",
        titulo: "Política de Privacidade e LGPD",
        descricao: "Tratamento de dados pessoais e sensíveis dos pacientes conforme Lei Geral de Proteção de Dados (Lei 13.709/2018).",
        versao: "v2.0",
        atualizacao: "01/01/2025",
        status: "ativo",
      },
      {
        id: "a2",
        titulo: "Acesso ao Prontuário Eletrônico",
        descricao: "Níveis de acesso por perfil, sigilo de dados, vedação de acesso indevido e penalidades aplicáveis.",
        versao: "v1.3",
        atualizacao: "10/02/2025",
        status: "ativo",
      },
      {
        id: "a3",
        titulo: "Presença e Pontualidade",
        descricao: "Registro de ponto, comunicação de ausências, cobertura de escalas e justificativas.",
        versao: "v1.1",
        atualizacao: "05/03/2025",
        status: "ativo",
      },
      {
        id: "a4",
        titulo: "Uso de Dispositivos Móveis e Redes Sociais",
        descricao: "Restrições de uso de celulares em áreas assistenciais, proibição de fotografias de pacientes e conduta em redes sociais.",
        versao: "v1.4",
        atualizacao: "15/03/2025",
        status: "ativo",
      },
    ],
  },
];

export default function Normas() {
  const [categoriasAbertas, setCategoriasAbertas] = useState({ protocolos: true });
  const [busca, setBusca] = useState("");
  const [normaSelecionada, setNormaSelecionada] = useState(null);

  function toggleCategoria(key) {
    setCategoriasAbertas((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const categoriasFiltradas = CATEGORIAS.map((cat) => ({
    ...cat,
    normas: cat.normas.filter((n) => {
      if (!busca) return true;
      const termo = busca.toLowerCase();
      return (
        n.titulo.toLowerCase().includes(termo) ||
        n.descricao.toLowerCase().includes(termo)
      );
    }),
  })).filter((cat) => cat.normas.length > 0);

  const totalNormas = CATEGORIAS.reduce((acc, c) => acc + c.normas.length, 0);

  if (normaSelecionada) {
    return (
      <div>
        <div className="page-header" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            className="med-back-btn"
            onClick={() => setNormaSelecionada(null)}
          >
            ←
          </button>
          <div>
            <h1>{normaSelecionada.titulo}</h1>
            <p className="page-subtitle">
              Versão {normaSelecionada.versao} · Atualização: {normaSelecionada.atualizacao}
            </p>
          </div>
        </div>

        <div className="page-card" style={{ marginTop: "16px" }}>
          <div className="muted-box" style={{ marginBottom: "16px" }}>
            <strong>Descrição</strong>
            <div style={{ marginTop: "8px", lineHeight: "1.6" }}>{normaSelecionada.descricao}</div>
          </div>

          <div className="muted-box" style={{ marginBottom: "16px" }}>
            <strong>Status</strong>
            <div style={{ marginTop: "6px" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  background: "#f0fdf4",
                  color: "#16a34a",
                }}
              >
                Ativo
              </span>
            </div>
          </div>

          <div className="muted-box" style={{ marginBottom: "16px" }}>
            <strong>Versão</strong>
            <div style={{ marginTop: "6px" }}>{normaSelecionada.versao}</div>
          </div>

          <div className="muted-box">
            <strong>Última atualização</strong>
            <div style={{ marginTop: "6px" }}>{normaSelecionada.atualizacao}</div>
          </div>

          <div
            className="muted-box"
            style={{ marginTop: "16px", background: "#fffbeb", borderLeft: "4px solid #f59e0b", borderRadius: "8px", padding: "12px 16px" }}
          >
            <strong style={{ color: "#92400e" }}>Importante</strong>
            <div style={{ marginTop: "6px", color: "#78350f", fontSize: "13px", lineHeight: "1.6" }}>
              Este documento é de consulta interna. Em caso de dúvidas sobre aplicação, consulte o setor de qualidade ou a supervisão técnica.
            </div>
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: "16px" }}>
          <button className="secondary-btn" onClick={() => setNormaSelecionada(null)}>
            Voltar às normas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Normas e Protocolos</h1>
        <p className="page-subtitle">
          Documentos, protocolos assistenciais e orientações internas organizados por categoria.
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-box" style={{ borderTop: "4px solid var(--primary)" }}>
          <div className="stat-label">Total de documentos</div>
          <div className="stat-value">{totalNormas}</div>
          <div className="stat-info">Protocolos e normas</div>
        </div>
        <div className="stat-box" style={{ borderTop: "4px solid #2563eb" }}>
          <div className="stat-label">Categorias</div>
          <div className="stat-value">{CATEGORIAS.length}</div>
          <div className="stat-info">Áreas cobertas</div>
        </div>
        <div className="stat-box" style={{ borderTop: "4px solid #16a34a" }}>
          <div className="stat-label">Documentos ativos</div>
          <div className="stat-value">{totalNormas}</div>
          <div className="stat-info">Em vigor</div>
        </div>
        <div className="stat-box" style={{ borderTop: "4px solid #f59e0b" }}>
          <div className="stat-label">Última atualização</div>
          <div className="stat-value" style={{ fontSize: "18px" }}>Abr/25</div>
          <div className="stat-info">Revisão mais recente</div>
        </div>
      </div>

      <div className="page-card" style={{ marginTop: "20px" }}>
        <div className="toolbar">
          <input
            className="input search-input"
            placeholder="Buscar norma ou protocolo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button className="secondary-btn" onClick={() => setBusca("")}>
              Limpar
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {categoriasFiltradas.map((cat) => (
          <div key={cat.key} className="page-card" style={{ padding: 0, overflow: "hidden" }}>
            <button
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                background: "none",
                border: "none",
                cursor: "pointer",
                borderLeft: `4px solid ${cat.cor}`,
              }}
              onClick={() => toggleCategoria(cat.key)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "20px" }}>{cat.icone}</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
                    {cat.titulo}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    {cat.normas.length} documento(s)
                  </div>
                </div>
              </div>
              <span style={{ fontSize: "18px", color: "#64748b", fontWeight: 700 }}>
                {categoriasAbertas[cat.key] ? "▾" : "▸"}
              </span>
            </button>

            {categoriasAbertas[cat.key] && (
              <div style={{ borderTop: "1px solid #e2e8f0", padding: "12px 20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {cat.normas.map((norma) => (
                    <div
                      key={norma.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        borderRadius: "10px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        gap: "12px",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "13px", color: "#1e293b" }}>
                          {norma.titulo}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", lineHeight: "1.5" }}>
                          {norma.descricao}
                        </div>
                        <div style={{ display: "flex", gap: "12px", marginTop: "8px", fontSize: "11px", color: "#94a3b8" }}>
                          <span>Versão: {norma.versao}</span>
                          <span>·</span>
                          <span>Atualizado: {norma.atualizacao}</span>
                          <span>·</span>
                          <span
                            style={{
                              background: "#f0fdf4",
                              color: "#16a34a",
                              padding: "1px 8px",
                              borderRadius: "6px",
                              fontWeight: 700,
                            }}
                          >
                            Ativo
                          </span>
                        </div>
                      </div>
                      <button
                        className="secondary-btn"
                        style={{ whiteSpace: "nowrap", fontSize: "12px", padding: "6px 14px" }}
                        onClick={() => setNormaSelecionada(norma)}
                      >
                        Ver documento
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {categoriasFiltradas.length === 0 && (
          <div className="page-card" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            Nenhuma norma encontrada para "{busca}".
          </div>
        )}
      </div>
    </div>
  );
}
