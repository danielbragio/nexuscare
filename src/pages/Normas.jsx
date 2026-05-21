import { useState } from "react";
import { ClipboardList, Shield, Droplets, Leaf, AlertCircle, Folder, FileText } from "lucide-react";

// ─── Textos jurídicos completos ─────────────────────────────────────────────
// Conteúdo redigido com base na Lei 13.709/2018 (LGPD), Código de Ética Odontológica
// (Resolução CFO 118/2012), Código de Ética Médica (CFM 2.217/2018), Resolução CFM 2.314/2022
// (Telemedicina) e Lei 9.610/1998 (Direitos Autorais — uso de imagem).
//
// Os documentos cobrem os fluxos do sistema:
//   - Cadastro e tratamento de dados pessoais e sensíveis (LGPD).
//   - Atendimento clínico médico (Termo de Consentimento Informado).
//   - Atendimento odontológico (Termo de Consentimento Odontológico).
//   - Procedimento anestésico/sedativo (Termo Anestésico).
//   - Uso de imagem em prontuário (Termo de Imagem).
//   - Atendimento remoto (Termo de Telemedicina/Teleconsulta).
//
// IMPORTANTE: Antes de colocar em uso real com pacientes, a equipe jurídica e o DPO
// devem revisar e adequar à realidade da clínica. Os textos abaixo são abrangentes
// e atendem o padrão de mercado, mas não substituem revisão jurídica formal.

const TERMOS = [
  {
    id: "t1",
    titulo: "Termo de Consentimento — Tratamento de Dados Pessoais (LGPD)",
    descricao: "Política completa de privacidade e proteção de dados em conformidade com a Lei 13.709/2018 (LGPD), abrangendo coleta, finalidade, compartilhamento, retenção e direitos do titular.",
    versao: "v1.0",
    atualizacao: "20/05/2026",
    status: "ativo",
    responsavel: "Encarregado de Dados (DPO) — Vynor Clinic",
    proximaRevisao: "20/05/2027",
    conteudo: [
      {
        titulo: "1. Identificação do Controlador",
        paragrafos: [
          "A Vynor Clinic, doravante denominada \"Controladora\", é responsável pelas decisões referentes ao tratamento dos dados pessoais e sensíveis do paciente, nos termos do art. 5º, VI, da Lei 13.709/2018 (Lei Geral de Proteção de Dados — LGPD).",
          "Encarregado pelo Tratamento de Dados (DPO) disponível para contato no canal oficial da clínica, conforme art. 41 da LGPD.",
        ],
      },
      {
        titulo: "2. Dados pessoais coletados",
        paragrafos: [
          "Para a prestação de serviços de saúde, a Controladora coleta e trata as seguintes categorias de dados:",
          "• Dados de identificação: nome completo, CPF, RG, data de nascimento, sexo, estado civil, profissão.",
          "• Dados de contato: endereço, telefone, e-mail, contato de emergência.",
          "• Dados sensíveis de saúde (art. 5º, II, LGPD): histórico clínico, alergias, tipo sanguíneo, medicamentos em uso, resultados de exames, anamnese, prontuário eletrônico, prescrições, CID, procedimentos realizados.",
          "• Dados financeiros: convênio, plano de saúde, números de carteirinha, forma de pagamento.",
          "• Imagens clínicas: fotografias intraorais, radiografias, exames de imagem (quando aplicável e autorizado em termo específico).",
        ],
      },
      {
        titulo: "3. Finalidades do tratamento",
        paragrafos: [
          "Os dados serão tratados exclusivamente para as finalidades descritas a seguir, conforme art. 6º, I, e art. 11 da LGPD:",
          "• Prestação de cuidados de saúde, diagnóstico, tratamento e acompanhamento.",
          "• Manutenção legal do prontuário médico/odontológico (CFM 1.821/2007 — guarda mínima de 20 anos).",
          "• Faturamento, cobrança, emissão de recibo, nota fiscal e repasse a operadoras de plano de saúde.",
          "• Cumprimento de obrigações legais, regulatórias e fiscais (CFM, CRO, ANVISA, Receita Federal).",
          "• Comunicação operacional sobre agendamentos, retornos e orientações pós-procedimento.",
          "• Estatística e gestão interna de qualidade, sempre de forma anonimizada ou agregada.",
        ],
      },
      {
        titulo: "4. Bases legais",
        paragrafos: [
          "O tratamento se fundamenta em uma ou mais das seguintes bases legais previstas na LGPD:",
          "• Consentimento livre, informado e inequívoco do titular (art. 7º, I, e art. 11, I).",
          "• Cumprimento de obrigação legal ou regulatória pela Controladora (art. 7º, II).",
          "• Execução de contrato do qual o titular seja parte (art. 7º, V).",
          "• Tutela da saúde, exclusivamente em procedimento realizado por profissionais de saúde (art. 11, II, \"f\").",
          "• Proteção da vida ou da incolumidade física do titular ou de terceiro (art. 7º, VII, e art. 11, II, \"d\").",
          "• Exercício regular de direitos em processo judicial, administrativo ou arbitral (art. 7º, VI, e art. 11, II, \"e\").",
        ],
      },
      {
        titulo: "5. Compartilhamento de dados",
        paragrafos: [
          "A Controladora poderá compartilhar dados nas seguintes hipóteses, com salvaguardas contratuais e técnicas adequadas:",
          "• Profissionais de saúde da equipe responsável pelo atendimento.",
          "• Laboratórios, clínicas de imagem e prestadores de exames complementares solicitados.",
          "• Operadoras de planos de saúde e seguradoras, quando aplicável à cobertura contratada.",
          "• Autoridades sanitárias, regulatórias e judiciais, mediante requisição formal.",
          "• Fornecedores de tecnologia (hospedagem, e-mail, backup) submetidos a contrato de tratamento conforme art. 39 da LGPD.",
          "A Controladora NÃO comercializa, vende, aluga ou permuta dados pessoais com terceiros para fins de marketing.",
        ],
      },
      {
        titulo: "6. Prazo de retenção",
        paragrafos: [
          "Os dados serão retidos pelos prazos legais aplicáveis:",
          "• Prontuário médico e odontológico: 20 anos a partir do último registro (Resolução CFM 1.821/2007 e CFO 118/2012).",
          "• Documentos fiscais e contábeis: 5 anos a partir da emissão (Código Tributário Nacional).",
          "• Demais dados administrativos: até o término da relação assistencial e o cumprimento das obrigações legais.",
          "Após esse prazo, os dados serão anonimizados ou eliminados de forma segura, salvo nas hipóteses do art. 16 da LGPD.",
        ],
      },
      {
        titulo: "7. Direitos do titular",
        paragrafos: [
          "Nos termos do art. 18 da LGPD, o titular pode a qualquer tempo, por solicitação ao Encarregado:",
          "• Confirmar a existência de tratamento dos seus dados.",
          "• Acessar seus dados (cópia em formato eletrônico).",
          "• Corrigir dados incompletos, inexatos ou desatualizados.",
          "• Solicitar anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade.",
          "• Solicitar portabilidade dos dados a outro fornecedor de serviço ou produto.",
          "• Revogar o consentimento, ressalvadas as hipóteses em que o tratamento é necessário por outras bases legais (ex.: guarda obrigatória do prontuário).",
          "• Peticionar à Autoridade Nacional de Proteção de Dados (ANPD).",
        ],
      },
      {
        titulo: "8. Segurança da informação",
        paragrafos: [
          "A Controladora adota medidas técnicas e administrativas para proteger os dados contra acessos não autorizados, perda, alteração ou divulgação indevida, incluindo:",
          "• Controle de acesso por perfil (admin, recepção, médico, odonto, enfermagem, financeiro, estoque), com mascaramento de dados clínicos para perfis sem necessidade clínica.",
          "• Autenticação por usuário e senha individuais, registro de auditoria (audit logs).",
          "• Comunicação criptografada (HTTPS/TLS) e cookies httpOnly.",
          "• Cópias de segurança (backup) regulares, em meio segregado.",
          "• Plano de resposta a incidentes, com notificação à ANPD e ao titular em até prazo razoável quando aplicável (art. 48 da LGPD).",
        ],
      },
      {
        titulo: "9. Consentimento",
        paragrafos: [
          "Ao assinar este Termo, o titular declara estar ciente das informações acima e CONSENTE livremente, de forma informada e inequívoca, com o tratamento dos seus dados pessoais e sensíveis para as finalidades descritas, podendo revogar o consentimento a qualquer momento, respeitadas as hipóteses legais de retenção.",
          "Local: __________________________  Data: ___/___/______",
          "Paciente: _____________________________________________",
          "CPF: ______________________  Assinatura: __________________",
          "Responsável legal (se aplicável): ___________________________  Assinatura: __________________",
        ],
      },
    ],
  },
  {
    id: "t2",
    titulo: "Termo de Consentimento Informado — Odontologia",
    descricao: "Consentimento livre e esclarecido para procedimentos odontológicos, conforme Resolução CFO 118/2012 (Código de Ética Odontológica), com descrição de riscos, alternativas, custos e responsabilidades.",
    versao: "v1.0",
    atualizacao: "20/05/2026",
    status: "ativo",
    responsavel: "Coordenação de Odontologia",
    proximaRevisao: "20/05/2027",
    conteudo: [
      {
        titulo: "1. Identificação",
        paragrafos: [
          "Eu, _______________________________________________, portador(a) do CPF nº _________________, declaro, na qualidade de paciente (ou responsável legal pelo(a) paciente _____________________________), ter sido devidamente esclarecido(a) pelo(a) cirurgião(ã)-dentista CRO _______________ sobre o procedimento odontológico abaixo descrito.",
        ],
      },
      {
        titulo: "2. Procedimento proposto",
        paragrafos: [
          "Procedimento(s): _______________________________________________________________________",
          "Dente(s) / região: ______________________________________________________________________",
          "Justificativa clínica: ___________________________________________________________________",
        ],
      },
      {
        titulo: "3. Riscos e complicações possíveis",
        paragrafos: [
          "Fui informado(a) de que todo procedimento odontológico envolve riscos. Os riscos específicos relacionados ao(s) procedimento(s) acima incluem, mas não se limitam a:",
          "• Dor, edema, hematomas, sangramento e desconforto pós-operatório.",
          "• Reações adversas a anestésicos, antibióticos e analgésicos prescritos.",
          "• Possibilidade de necessidade de retratamento, troca de plano de tratamento ou extração futura do elemento dentário.",
          "• Em cirurgias: lesão de nervos, infecção, alveolite, comunicação buco-sinusal, fratura de instrumental ou óssea.",
          "• Em endodontia: fratura de instrumento, perfuração radicular, falha terapêutica e necessidade de retratamento.",
          "• Em prótese e implantes: insucesso da osseointegração, mucosite, peri-implantite, fratura de componentes.",
          "• Em ortodontia: reabsorção radicular, dor, recidiva, necessidade de retenção contínua.",
          "Os resultados estéticos podem variar e dependem de condições biológicas individuais, colaboração do paciente e manutenção adequada.",
        ],
      },
      {
        titulo: "4. Alternativas terapêuticas",
        paragrafos: [
          "Foram apresentadas as alternativas terapêuticas disponíveis, incluindo a possibilidade de não realização do tratamento, com as respectivas consequências clínicas.",
        ],
      },
      {
        titulo: "5. Responsabilidades do paciente",
        paragrafos: [
          "Comprometo-me a:",
          "• Fornecer informações verdadeiras e completas sobre meu estado de saúde, medicamentos em uso, alergias e gestação.",
          "• Seguir as orientações pré e pós-operatórias, dieta e prescrição medicamentosa.",
          "• Comparecer às consultas de retorno e manutenção.",
          "• Manter higiene oral conforme orientado.",
          "• Comunicar imediatamente qualquer intercorrência.",
        ],
      },
      {
        titulo: "6. Aspectos financeiros",
        paragrafos: [
          "Valor total estimado do tratamento: R$ ______________________________________________",
          "Condições de pagamento: ________________________________________________________",
          "Estou ciente de que retratamentos por descumprimento das orientações ou ausência às consultas de manutenção poderão gerar custos adicionais.",
        ],
      },
      {
        titulo: "7. Garantia e limites",
        paragrafos: [
          "A obrigação do profissional é de meio, não de resultado. O sucesso depende de fatores biológicos individuais e da colaboração do paciente. Eventuais ajustes serão tratados conforme as boas práticas clínicas.",
        ],
      },
      {
        titulo: "8. Declaração e consentimento",
        paragrafos: [
          "Declaro que recebi todas as informações de forma clara, em linguagem acessível, e que minhas dúvidas foram respondidas. CONSINTO livremente com a realização do(s) procedimento(s) descrito(s).",
          "Local: __________________________  Data: ___/___/______",
          "Paciente / Responsável: _________________________________  Assinatura: __________________",
          "Cirurgião-Dentista responsável: __________________________  CRO: _____________  Assinatura: __________________",
        ],
      },
    ],
  },
  {
    id: "t3",
    titulo: "Termo de Consentimento Informado — Clínica Médica",
    descricao: "Consentimento esclarecido para consultas, exames e procedimentos médicos, conforme Resolução CFM 2.217/2018 (Código de Ética Médica) e Resolução CFM 1.638/2002 (prontuário).",
    versao: "v1.0",
    atualizacao: "20/05/2026",
    status: "ativo",
    responsavel: "Diretoria Técnica Médica",
    proximaRevisao: "20/05/2027",
    conteudo: [
      {
        titulo: "1. Identificação",
        paragrafos: [
          "Eu, _______________________________________________, portador(a) do CPF nº _________________, na qualidade de paciente (ou responsável legal), declaro ter sido esclarecido(a) pelo(a) médico(a) Dr(a). ____________________________________, CRM _______________, sobre o ato médico proposto.",
        ],
      },
      {
        titulo: "2. Diagnóstico, conduta e exames",
        paragrafos: [
          "Hipótese diagnóstica: ____________________________________________________________",
          "Conduta proposta (consulta, exame, procedimento): _______________________________________",
          "Justificativa clínica: ____________________________________________________________",
        ],
      },
      {
        titulo: "3. Riscos, benefícios e alternativas",
        paragrafos: [
          "Fui informado(a) sobre os riscos inerentes ao ato médico, incluindo reações adversas a medicamentos prescritos, falhas diagnósticas inerentes a limitações da medicina, possibilidade de necessidade de exames complementares e da remota possibilidade de complicações graves, ainda que raras.",
          "Foram apresentados os benefícios esperados, as alternativas terapêuticas disponíveis e as consequências da não realização do tratamento.",
        ],
      },
      {
        titulo: "4. Responsabilidades do paciente",
        paragrafos: [
          "Comprometo-me a fornecer informações verídicas, seguir orientações terapêuticas, comparecer a consultas de retorno e comunicar intercorrências.",
        ],
      },
      {
        titulo: "5. Sigilo médico e prontuário",
        paragrafos: [
          "Estou ciente de que as informações prestadas integrarão meu prontuário médico, protegido por sigilo profissional (CFM 2.217/2018, art. 73) e pela LGPD, e serão acessadas apenas pela equipe de saúde envolvida no atendimento.",
        ],
      },
      {
        titulo: "6. Aspectos financeiros",
        paragrafos: [
          "Valor da consulta/procedimento: R$ ______________________________________________",
          "Convênio: _______________________________  Particular: (   )",
        ],
      },
      {
        titulo: "7. Declaração e consentimento",
        paragrafos: [
          "Declaro ter compreendido as informações prestadas e CONSINTO com a realização do ato médico proposto, podendo revogar este consentimento a qualquer momento, antes de sua execução.",
          "Local: __________________________  Data: ___/___/______",
          "Paciente / Responsável: _________________________________  Assinatura: __________________",
          "Médico(a) responsável: __________________________________  CRM: _____________  Assinatura: __________________",
        ],
      },
    ],
  },
  {
    id: "t4",
    titulo: "Termo de Consentimento — Procedimento Anestésico / Sedação",
    descricao: "Consentimento específico para anestesia local, regional ou sedação consciente em ambiente ambulatorial, conforme Resolução CFM 2.174/2017.",
    versao: "v1.0",
    atualizacao: "20/05/2026",
    status: "ativo",
    responsavel: "Anestesiologia / Cirurgia",
    proximaRevisao: "20/05/2027",
    conteudo: [
      {
        titulo: "1. Identificação",
        paragrafos: [
          "Eu, _______________________________________________, CPF nº _________________, declaro ter sido esclarecido(a) sobre o procedimento anestésico ou de sedação a ser realizado em conjunto com o ato clínico/cirúrgico previsto para a presente data.",
        ],
      },
      {
        titulo: "2. Tipo de anestesia proposto",
        paragrafos: [
          "(   ) Anestesia local",
          "(   ) Anestesia regional / bloqueio",
          "(   ) Sedação consciente / inalatória",
          "(   ) Outra: _________________________________________________",
        ],
      },
      {
        titulo: "3. Riscos e complicações",
        paragrafos: [
          "Estou ciente de que toda anestesia, mesmo local, envolve riscos, ainda que pequenos, incluindo:",
          "• Reações alérgicas leves a graves (incluindo, em casos raros, anafilaxia).",
          "• Hipotensão, bradicardia, arritmias.",
          "• Náuseas, vômitos, cefaleia, dormência prolongada.",
          "• Em sedação: alteração do nível de consciência, depressão respiratória e necessidade de manobras de suporte.",
          "• Riscos raros relacionados a condições clínicas preexistentes.",
        ],
      },
      {
        titulo: "4. Informações fornecidas",
        paragrafos: [
          "Informei alergias conhecidas, uso de medicamentos contínuos, episódios prévios de reação anestésica, gestação e condições clínicas relevantes:",
          "________________________________________________________________________",
          "________________________________________________________________________",
        ],
      },
      {
        titulo: "5. Orientações pós-procedimento",
        paragrafos: [
          "Comprometo-me a seguir as orientações pós-anestésicas, incluindo jejum (quando aplicável), repouso, abstenção de direção veicular após sedação, e comparecimento acompanhado quando indicado.",
        ],
      },
      {
        titulo: "6. Declaração e consentimento",
        paragrafos: [
          "CONSINTO com a realização do procedimento anestésico proposto, ciente dos riscos e benefícios.",
          "Local: __________________________  Data: ___/___/______",
          "Paciente / Responsável: _________________________________  Assinatura: __________________",
          "Profissional responsável: _______________________________  Registro: _____________  Assinatura: __________________",
        ],
      },
    ],
  },
  {
    id: "t5",
    titulo: "Termo de Autorização de Uso de Imagem",
    descricao: "Autorização específica para captura, armazenamento e uso de imagens (fotografias, radiografias, vídeos) para fins de prontuário, didáticos ou científicos, conforme Lei 9.610/1998 e LGPD.",
    versao: "v1.0",
    atualizacao: "20/05/2026",
    status: "ativo",
    responsavel: "Encarregado de Dados (DPO)",
    proximaRevisao: "20/05/2027",
    conteudo: [
      {
        titulo: "1. Identificação",
        paragrafos: [
          "Eu, _______________________________________________, CPF nº _________________, AUTORIZO a Vynor Clinic a realizar a captação, armazenamento e tratamento de imagens (fotografias intraorais, faciais, radiografias, vídeos e demais registros) referentes ao meu atendimento.",
        ],
      },
      {
        titulo: "2. Finalidades autorizadas (marcar)",
        paragrafos: [
          "(   ) Integrar exclusivamente o prontuário clínico, como parte da documentação assistencial.",
          "(   ) Estudo de caso interno, apresentações e formação da equipe da Vynor Clinic.",
          "(   ) Publicação em meios científicos, com supressão de quaisquer dados que permitam identificação direta.",
          "(   ) Divulgação institucional em redes sociais e materiais de marketing (somente se expressamente autorizado abaixo).",
        ],
      },
      {
        titulo: "3. Vedação e limites",
        paragrafos: [
          "É VEDADO o uso da imagem para fins distintos dos autorizados acima. O uso comercial ou publicitário só ocorrerá com autorização específica e separada.",
          "Posso revogar esta autorização a qualquer momento, por escrito, ressalvado o uso já realizado em conformidade com este Termo.",
        ],
      },
      {
        titulo: "4. Declaração",
        paragrafos: [
          "Declaro que recebi as informações necessárias e CONSINTO com o tratamento das imagens nos termos acima.",
          "Local: __________________________  Data: ___/___/______",
          "Paciente / Responsável: _________________________________  Assinatura: __________________",
        ],
      },
    ],
  },
  {
    id: "t6",
    titulo: "Termo de Consentimento — Telemedicina / Teleconsulta",
    descricao: "Consentimento para atendimento remoto por meios de tecnologia da informação e comunicação, conforme Resolução CFM 2.314/2022 e Resolução CFO 226/2020.",
    versao: "v1.0",
    atualizacao: "20/05/2026",
    status: "ativo",
    responsavel: "Diretoria Técnica",
    proximaRevisao: "20/05/2027",
    conteudo: [
      {
        titulo: "1. Identificação e natureza do atendimento",
        paragrafos: [
          "Eu, _______________________________________________, CPF nº _________________, declaro estar ciente de que o atendimento será realizado por meio de Tecnologia da Informação e Comunicação (TIC), sob a modalidade de teleconsulta, conforme regulamentação dos Conselhos Federais de Medicina e Odontologia.",
        ],
      },
      {
        titulo: "2. Limitações da teleconsulta",
        paragrafos: [
          "Reconheço que a teleconsulta tem limitações inerentes, incluindo a impossibilidade de exame físico direto, o que pode reduzir a precisão diagnóstica. Quando indicado, o(a) profissional poderá orientar a realização de atendimento presencial.",
        ],
      },
      {
        titulo: "3. Privacidade e segurança",
        paragrafos: [
          "A teleconsulta ocorrerá em plataforma adequada, com criptografia. O conteúdo da consulta integra meu prontuário e está submetido a sigilo profissional e à LGPD.",
          "É VEDADA a gravação não autorizada da consulta por qualquer das partes.",
        ],
      },
      {
        titulo: "4. Prescrição e atestados",
        paragrafos: [
          "Quando emitidos, prescrições e atestados serão entregues digitalmente, com assinatura eletrônica válida na forma da Lei 14.063/2020 e MP 2.200-2/2001.",
        ],
      },
      {
        titulo: "5. Declaração",
        paragrafos: [
          "CONSINTO com o atendimento na modalidade de teleconsulta nos termos acima.",
          "Local: __________________________  Data: ___/___/______",
          "Paciente / Responsável: _________________________________  Assinatura: __________________",
          "Profissional: ___________________________________________  Registro: _____________  Assinatura: __________________",
        ],
      },
    ],
  },
];

const CATEGORIAS = [
  {
    key: "protocolos",
    titulo: "Protocolos Assistenciais",
    Icone: ClipboardList,
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
    Icone: Shield,
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
    Icone: Droplets,
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
    Icone: Leaf,
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
    Icone: AlertCircle,
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
    key: "termos",
    titulo: "Termos de Consentimento e LGPD",
    Icone: FileText,
    cor: "#4f46e5",
    normas: TERMOS,
  },
  {
    key: "administrativas",
    titulo: "Normas Administrativas",
    Icone: Folder,
    cor: "#f59e0b",
    normas: [
      {
        id: "a1",
        titulo: "Política de Privacidade e LGPD",
        descricao: "Tratamento de dados pessoais e sensíveis dos pacientes conforme Lei Geral de Proteção de Dados (Lei 13.709/2018). O texto completo do Termo de Consentimento LGPD está disponível na categoria \"Termos de Consentimento e LGPD\".",
        versao: "v2.0",
        atualizacao: "01/01/2025",
        status: "ativo",
        responsavel: "Encarregado de Dados (DPO)",
        proximaRevisao: "Conforme alterações regulatórias da ANPD",
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

  // const totalNormas = CATEGORIAS.reduce((acc, c) => acc + c.normas.length, 0);

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
            <strong>{normaSelecionada.conteudo ? "Resumo" : "Descrição"}</strong>
            <div style={{ marginTop: "8px", lineHeight: "1.6" }}>{normaSelecionada.descricao}</div>
          </div>

          {Array.isArray(normaSelecionada.conteudo) && normaSelecionada.conteudo.length > 0 && (
            <div className="muted-box" style={{ marginBottom: "16px", background: "#fafafa" }}>
              <strong>Conteúdo integral do documento</strong>
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "16px" }}>
                {normaSelecionada.conteudo.map((secao, idx) => (
                  <section key={idx}>
                    <h3 style={{
                      margin: 0,
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#1e293b",
                      borderLeft: "3px solid #4f46e5",
                      paddingLeft: "10px",
                    }}>
                      {secao.titulo}
                    </h3>
                    <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {secao.paragrafos.map((p, i) => (
                        <p key={i} style={{
                          margin: 0,
                          fontSize: "13px",
                          color: "#334155",
                          lineHeight: "1.7",
                          whiteSpace: "pre-wrap",
                        }}>
                          {p}
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              <button
                className="secondary-btn"
                style={{ marginTop: "16px", fontSize: "12px" }}
                onClick={() => window.print()}
              >
                Imprimir documento
              </button>
            </div>
          )}

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
            <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 700, color: "#7C3AED", background: "#f5f3ff", border: "1px solid #ede9fe", padding: "2px 10px", borderRadius: "999px", fontSize: "13px" }}>
                {normaSelecionada.versao}
              </span>
            </div>
          </div>

          <div className="muted-box" style={{ marginBottom: "16px" }}>
            <strong>Última atualização</strong>
            <div style={{ marginTop: "6px" }}>{normaSelecionada.atualizacao}</div>
          </div>

          <div className="muted-box" style={{ marginBottom: "16px" }}>
            <strong>Responsável técnico</strong>
            <div style={{ marginTop: "6px", fontSize: "14px", color: "#374151" }}>
              {normaSelecionada.responsavel || "Comissão Técnica Multidisciplinar"}
            </div>
          </div>

          <div className="muted-box" style={{ marginBottom: "16px" }}>
            <strong>Próxima revisão</strong>
            <div style={{ marginTop: "6px", fontSize: "14px", color: "#374151" }}>
              {normaSelecionada.proximaRevisao || "Conforme cronograma anual de revisão documental"}
            </div>
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
                <cat.Icone size={20} color={cat.cor} />
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
